import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { applicationSnapshots, criterionEvaluations, db, researchExperiences, studentEvidence, studentProfiles } from "@/db";
import type { ResumeAnalysisResult } from "@/lib/ai/resume-analysis";

/**
 * The model reading is replaced with a controllable stand-in, so these tests
 * cover the plain-text path for real and the model path without a network.
 */
let modelResult: ResumeAnalysisResult | null = null;
let modelCalls = 0;
vi.mock("@/lib/ai/resume-analysis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/resume-analysis")>();
  return {
    ...actual,
    analyzeResume: async (input: { resumeText: string; experienceText: string }) => {
      modelCalls += 1;
      const inputHash = actual.resumeInputHash(input.resumeText, input.experienceText);
      return modelResult ? { ...modelResult, inputHash } : { ok: false as const, reason: "disabled" as const, inputHash };
    },
  };
});

const { refreshStudentEvidence, staleEvidenceStudentIds } = await import("@/lib/evidence/refresh");
const { rescoreDeterministicCriteria } = await import("@/lib/criteria/rescore");
const { loadStudentProfile } = await import("@/lib/queries/student");
const { studentMatchInput } = await import("@/lib/queries/recommendations");
const { scoreMatch } = await import("@/lib/matching");
const { storeFile } = await import("@/lib/storage");
const { addCriterion, createApplication, createOpportunity, createResearcher, createStudent } = await import("../fixtures");

/** A small but real PDF, one line of text per entry. */
function pdfOf(lines: string[]): string {
  const escape = (value: string) => value.replace(/[\\()]/g, (char) => `\\${char}`);
  const stream = `BT /F1 10 Tf 14 TL 50 780 Td ${lines.map((line) => `(${escape(line)}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Plain ASCII throughout, so the string encodes to exactly these bytes.
  return body;
}

const RESUME_LINES = [
  "Research Experience",
  "Summer Research Student, Population Health Research Institute, 2025",
  "Built a REDCap database and cleaned cohort data in R",
  "Undergraduate Research Assistant, Cardiac Imaging Lab, 2024",
  "Publications",
  "Example J, Smith A, et al. Readmission after PCI in older adults. Can J Cardiol. 2025;41:210-218.",
  "Presentations",
  "Poster: Frailty screening before TAVI. Health Sciences Research Day, 2025.",
];

async function studentWithResume(lines = RESUME_LINES) {
  const student = await createStudent();
  const file = new File([pdfOf(lines)], "resume.pdf", { type: "application/pdf" });
  const stored = await storeFile({ file, purpose: "resume", ownerId: student.id });
  await db.update(studentProfiles).set({ resumeFileId: stored.id }).where(eq(studentProfiles.userId, student.id));
  return student;
}

beforeEach(() => {
  modelResult = null;
  modelCalls = 0;
});

describe("reading a student's resume into evidence", () => {
  it("reads research roles, publications, and skills out of an uploaded PDF", async () => {
    const student = await studentWithResume();
    const result = await refreshStudentEvidence(student.id, { useModel: false });
    expect(result.outcome).toBe("updated");

    const [row] = await db.select().from(studentEvidence).where(eq(studentEvidence.studentId, student.id));
    expect(row.source).toBe("resume_text");
    expect(row.resumeReadable).toBe(true);
    expect(row.researchCount).toBe(2);
    expect(row.peerReviewedCount).toBe(1);
    expect(row.presentationCount).toBe(1);
    expect(row.resumeText).toContain("REDCap");
  });

  it("feeds matching: the research record shows up in the match and its reasons", async () => {
    const student = await studentWithResume();
    await refreshStudentEvidence(student.id, { useModel: false });
    const bundle = await loadStudentProfile(student.id);
    const input = studentMatchInput(bundle!);
    expect(input.documented.researchCount).toBe(2);

    const result = scoreMatch(input, {
      fieldNames: [],
      skillNames: ["REDCap"],
      durations: [],
      compensationType: "other",
      hoursPerWeekMin: null,
      locationMode: "hybrid",
      beginnerFriendly: false,
      priorResearchRequired: false,
    });
    expect(result.reasons.join(" ")).toContain("Your resume shows 2 research positions, 1 publication and 1 poster or presentation");
    expect(result.reasons.join(" ")).toContain("Your resume shows REDCap");
  });

  it("uses the model reading when it is available, and does not pay for it twice", async () => {
    const student = await studentWithResume();
    modelResult = {
      ok: true,
      model: "test-model",
      inputHash: "",
      analysis: {
        skills: [{ name: "Echocardiography", evidence: "Segmented echocardiograms" }],
        researchRoles: [
          { role: "Summer Research Student", organization: "PHRI", evidence: "Summer Research Student, PHRI" },
          { role: "Research Assistant", organization: "Cardiac Imaging Lab", evidence: "Research Assistant" },
          { role: "Thesis student", organization: "Frailty Lab", evidence: "Honours thesis" },
        ],
        publications: [{ citation: "Readmission after PCI. Can J Cardiol. 2025.", kind: "peer_reviewed" }],
        summary: "Two years of cardiovascular outcomes research.",
        warnings: [],
      },
    };

    await refreshStudentEvidence(student.id);
    const [row] = await db.select().from(studentEvidence).where(eq(studentEvidence.studentId, student.id));
    expect(row.source).toBe("resume_ai");
    expect(row.researchCount).toBe(3);
    expect(row.skills.map((skill) => skill.name)).toEqual(expect.arrayContaining(["Echocardiography"]));
    expect(row.summary).toContain("cardiovascular");
    expect(modelCalls).toBe(1);

    const again = await refreshStudentEvidence(student.id);
    expect(again.outcome).toBe("unchanged");
    expect(modelCalls).toBe(1);
  });

  it("reads again when the research entries change", async () => {
    const student = await studentWithResume();
    modelResult = {
      ok: true,
      model: "test-model",
      inputHash: "",
      analysis: { skills: [], researchRoles: [], publications: [], summary: "", warnings: [] },
    };
    await refreshStudentEvidence(student.id);
    await db.insert(researchExperiences).values({ studentId: student.id, organization: "Frailty Lab", title: "Volunteer" });
    const result = await refreshStudentEvidence(student.id);
    expect(result.outcome).toBe("updated");
    expect(modelCalls).toBe(2);
  });

  it("finds students whose resume has changed since it was read", async () => {
    const student = await studentWithResume();
    await refreshStudentEvidence(student.id, { useModel: false });
    expect(await staleEvidenceStudentIds({ includeModelPending: false })).not.toContain(student.id);

    const file = new File([pdfOf(["Research Assistant, New Lab, 2026"])], "new.pdf", { type: "application/pdf" });
    const stored = await storeFile({ file, purpose: "resume", ownerId: student.id });
    await db.update(studentProfiles).set({ resumeFileId: stored.id }).where(eq(studentProfiles.userId, student.id));
    expect(await staleEvidenceStudentIds({ includeModelPending: false })).toContain(student.id);
  });

  it("judges a skill criterion on a submitted application from the resume, not the typed list", async () => {
    const student = await studentWithResume();
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id);
    const shown = await addCriterion(opportunity.id, {
      type: "skill",
      label: "REDCap",
      required: false,
      importance: "high",
      config: { skillSlug: "redcap", skillName: "REDCap" },
    });
    const typedOnly = await addCriterion(opportunity.id, {
      type: "skill",
      label: "Western blot",
      required: false,
      importance: "medium",
      config: { skillSlug: "western-blot", skillName: "Western blot" },
      sortOrder: 1,
    });
    const application = await createApplication(opportunity.id, student.id, { status: "submitted", submittedAt: new Date() });
    // Submitted before the resume was read, claiming a skill the resume never shows.
    await db.insert(applicationSnapshots).values({
      applicationId: application.id,
      profile: { skills: [{ name: "Western blot" }], courses: [] },
    });

    await refreshStudentEvidence(student.id, { useModel: false });
    await rescoreDeterministicCriteria({ studentId: student.id });

    const status = async (criterionId: string) =>
      (
        await db
          .select({ status: criterionEvaluations.status, evidence: criterionEvaluations.evidence })
          .from(criterionEvaluations)
          .where(and(eq(criterionEvaluations.applicationId, application.id), eq(criterionEvaluations.criterionId, criterionId)))
      )[0];
    expect((await status(shown.id)).status).toBe("met");
    expect((await status(shown.id)).evidence?.[0]).toContain("REDCap");
    expect((await status(typedOnly.id)).status).toBe("not_met");
    expect((await status(typedOnly.id)).evidence?.[0]).toContain("not used for matching");
  });
});
