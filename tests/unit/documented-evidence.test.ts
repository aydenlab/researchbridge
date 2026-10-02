import { describe, expect, it } from "vitest";
import {
  combineResearchCount,
  countPublications,
  describeTrackRecord,
  documentsSkill,
  EMPTY_DOCUMENTED,
  findQuote,
  readResumeText,
  researchStrength,
} from "@/lib/evidence/documented";

const RESUME = [
  "Jordan Example",
  "Bachelor of Health Sciences (Honours), McMaster University, 2023 - present",
  "Research Experience",
  "Summer Research Student, Population Health Research Institute, May 2025 - Aug 2025",
  "Built a REDCap database and cleaned cohort data in R",
  "Undergraduate Research Assistant, Cardiac Imaging Lab, Sept 2024 - Apr 2025",
  "Segmented echocardiograms and ran statistics in Python",
  "Publications",
  "Example J, Smith A, et al. Readmission after PCI in older adults. Can J Cardiol. 2025;41(3):210-218.",
  "Example J, Lee B. Frailty and outcomes after TAVI: a systematic review. Submitted to BMJ Open, 2025.",
  "Presentations",
  "Poster: Frailty screening before TAVI. Health Sciences Research Day, McMaster University, 2025.",
  "Oral presentation: Readmission trends. Canadian Cardiovascular Congress, 2025.",
  "Work Experience",
  "Barista, Campus Coffee, 2022 - 2024",
  "Skills",
  "R, Python, REDCap, SPSS",
].join("\n");

const KNOWN = ["R", "Python", "REDCap", "SPSS", "Western blot", "MATLAB", "C"];

describe("reading a resume without a model", () => {
  const read = readResumeText(RESUME, KNOWN);

  it("finds research roles by title and under the research heading", () => {
    expect(read.researchRoles.length).toBe(2);
    expect(read.researchRoles[0].role).toContain("Summer Research Student");
    // A job that is not research is not counted.
    expect(read.researchRoles.some((role) => role.role.includes("Barista"))).toBe(false);
  });

  it("tells a published paper apart from a submitted manuscript and a poster", () => {
    const kinds = read.publications.map((item) => item.kind);
    expect(kinds).toEqual(["peer_reviewed", "manuscript", "poster", "oral_presentation"]);
    expect(countPublications(read.publications)).toEqual({ peerReviewedCount: 1, presentationCount: 2 });
  });

  it("quotes the line each known skill appears on, and skips ones that do not appear", () => {
    const names = read.skills.map((skill) => skill.name);
    expect(names).toEqual(expect.arrayContaining(["R", "Python", "REDCap", "SPSS"]));
    expect(names).not.toContain("Western blot");
    expect(names).not.toContain("MATLAB");
    expect(read.skills.find((skill) => skill.name === "REDCap")?.quote).toContain("Built a REDCap database");
  });

  it("does not mistake a stray capital letter for a one-letter skill name", () => {
    expect(findQuote("Wrote firmware in C and Python", "C")).not.toBeNull();
    expect(findQuote("Collaborated with clinicians", "C")).toBeNull();
    expect(findQuote("worked in r and d", "R")).toBeNull();
  });
});

describe("judging a track record", () => {
  it("weighs a publication on top of research roles", () => {
    const roleOnly = researchStrength({ researchCount: 1, peerReviewedCount: 0, presentationCount: 0 });
    const published = researchStrength({ researchCount: 1, peerReviewedCount: 1, presentationCount: 0 });
    const nothing = researchStrength({ researchCount: 0, peerReviewedCount: 0, presentationCount: 0 });
    expect(nothing).toBe(0);
    expect(published).toBeGreaterThan(roleOnly);
    expect(researchStrength({ researchCount: 3, peerReviewedCount: 2, presentationCount: 2 })).toBe(1);
  });

  it("describes the record in plain words", () => {
    expect(describeTrackRecord({ researchCount: 2, peerReviewedCount: 1, presentationCount: 0 })).toBe(
      "2 research positions and 1 publication",
    );
    expect(describeTrackRecord({ researchCount: 0, peerReviewedCount: 0, presentationCount: 0 })).toBeNull();
  });

  it("does not double count a role that is on both the resume and the profile", () => {
    expect(combineResearchCount(2, 2)).toBe(2);
    expect(combineResearchCount(1, 3)).toBe(3);
  });
});

describe("whether evidence documents a skill", () => {
  it("finds a skill a listing asks for even when it is not in the taxonomy", () => {
    const evidence = { ...EMPTY_DOCUMENTED, hasResume: true, text: "Performed optical coherence tomography scans" };
    expect(documentsSkill(evidence, "Optical coherence tomography")).toContain("optical coherence tomography");
    expect(documentsSkill(evidence, "Flow cytometry")).toBeNull();
  });
});
