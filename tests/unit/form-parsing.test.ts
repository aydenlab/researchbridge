import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseForm } from "@/lib/action-utils";
import { arrayField } from "@/lib/validation/shared";
import { logisticsStepSchema, projectStepSchema, reviewPostingSchema } from "@/lib/validation/opportunity";
import { researcherProfileSchema, studentAvailabilitySchema } from "@/lib/validation/profile";

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const uuid = "11111111-1111-4111-8111-111111111111";
const otherUuid = "22222222-2222-4222-8222-222222222222";

describe("array fields from HTML forms", () => {
  const schema = z.object({ picks: arrayField(z.string(), { min: 1, message: "Choose at least one." }) });

  it("accepts a single checked box, which HTML sends as one value not an array", () => {
    const parsed = parseForm(schema, form([["picks", "a"]]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.picks).toEqual(["a"]);
  });

  it("accepts several checked boxes", () => {
    const parsed = parseForm(schema, form([["picks", "a"], ["picks", "b"], ["picks", "c"]]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.picks).toEqual(["a", "b", "c"]);
  });

  it("reports a field error when nothing is checked and one is required", () => {
    const parsed = parseForm(schema, form([]));
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.picks?.[0]).toBe("Choose at least one.");
  });

  it("treats an absent optional array as empty rather than missing", () => {
    const optional = z.object({ picks: arrayField(z.string()) });
    const parsed = parseForm(optional, form([]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.picks).toEqual([]);
  });
});

describe("opportunity project step", () => {
  const base: [string, string][] = [
    ["title", "Undergraduate Research Assistant, Respiratory Outcomes"],
    ["summary", "Analyze routinely collected respiratory admission data to understand readmission patterns."],
    [
      "description",
      "Our group works with a de-identified extract of respiratory admissions across four regional hospitals, and most of the work is careful data preparation before any analysis is possible.",
    ],
    ["department", "Health Research Methods, Evidence, and Impact"],
  ];

  it("saves when exactly one research field is selected", () => {
    const parsed = parseForm(projectStepSchema, form([...base, ["researchFieldIds", uuid]]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.researchFieldIds).toEqual([uuid]);
  });

  it("saves when several research fields are selected", () => {
    const parsed = parseForm(projectStepSchema, form([...base, ["researchFieldIds", uuid], ["researchFieldIds", otherUuid]]));
    expect(parsed.ok).toBe(true);
  });

  it("asks for a research field when none is selected", () => {
    const parsed = parseForm(projectStepSchema, form(base));
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.researchFieldIds?.[0]).toBe("Choose at least one research field.");
  });

  it("saves without a summary, since supervisors asked for it to be optional", () => {
    const parsed = parseForm(
      projectStepSchema,
      form([...base.filter(([key]) => key !== "summary"), ["researchFieldIds", uuid]]),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.summary).toBeNull();
  });
});

describe("researcher profile step", () => {
  const base: [string, string][] = [
    ["firstName", "Amara"],
    ["lastName", "Okonjo"],
    ["researcherType", "principal_investigator"],
    ["department", "Health Research Methods, Evidence, and Impact"],
    ["biography", "My group studies cardiovascular outcomes using routinely collected clinical data."],
    ["recruitingOnBehalfOf", "personally"],
    ["disciplines", "health-medicine"],
  ];

  it("saves with a single research area selected", () => {
    const parsed = parseForm(researcherProfileSchema, form([...base, ["researchFieldIds", uuid]]));
    expect(parsed.ok).toBe(true);
  });

  it("saves without a biography", () => {
    const withoutBio = base.filter(([key]) => key !== "biography");
    const parsed = parseForm(researcherProfileSchema, form([...withoutBio, ["researchFieldIds", uuid]]));
    expect(parsed.ok).toBe(true);
  });

  it("requires a discipline", () => {
    const withoutDiscipline = base.filter(([key]) => key !== "disciplines");
    const parsed = parseForm(researcherProfileSchema, form([...withoutDiscipline, ["researchFieldIds", uuid]]));
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.disciplines?.[0]).toContain("discipline");
  });

  it("asks for the discipline when Other is chosen", () => {
    const parsed = parseForm(
      researcherProfileSchema,
      form([...base, ["disciplines", "other"], ["researchFieldIds", uuid]]),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.disciplineOther?.[0]).toBe("Please specify your discipline.");
  });

  it("accepts a specified Other research area in place of a listed one", () => {
    const parsed = parseForm(
      researcherProfileSchema,
      form([...base, ["researchAreaOtherSelected", "on"], ["researchAreaOther", "Sleep medicine"]]),
    );
    expect(parsed.ok).toBe(true);
  });

  it("asks for the research area when Other is ticked but left blank", () => {
    const parsed = parseForm(researcherProfileSchema, form([...base, ["researchAreaOtherSelected", "on"]]));
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.researchAreaOther?.[0]).toBe("Please specify your research area.");
  });

  it("rejects a lab website that is not a full web address", () => {
    const parsed = parseForm(
      researcherProfileSchema,
      form([...base, ["researchFieldIds", uuid], ["labWebsite", "lab.example.edu"]]),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.labWebsite?.[0]).toContain("http");
  });
});

describe("student availability step", () => {
  const availabilityBase: [string, string][] = [
    ["weeklyHours", "8"],
    ["locationPreference", "hybrid"],
    ["preferredDurations", "one_semester"],
    ["compensationPreferences", "paid"],
  ];

  it("accepts a single semester selection", () => {
    const parsed = parseForm(studentAvailabilitySchema, form([...availabilityBase, ["semesters", "Fall"]]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.semesters).toEqual(["Fall"]);
  });

  it("rejects negative hours", () => {
    const parsed = parseForm(
      studentAvailabilitySchema,
      form([...availabilityBase.filter(([key]) => key !== "weeklyHours"), ["weeklyHours", "-4"]]),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.weeklyHours?.[0]).toBe("Hours cannot be negative.");
  });

  it("keeps every duration a student selects", () => {
    const parsed = parseForm(
      studentAvailabilitySchema,
      form([
        ["weeklyHours", "8"],
        ["locationPreference", "hybrid"],
        ["compensationPreferences", "paid"],
        ["compensationPreferences", "volunteer"],
        ["preferredDurations", "one_semester"],
        ["preferredDurations", "summer_only"],
        ["preferredDurations", "multi_year"],
      ]),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.preferredDurations).toEqual(["one_semester", "summer_only", "multi_year"]);
    expect(parsed.data.compensationPreferences).toEqual(["paid", "volunteer"]);
  });

  it("asks for a duration when none is chosen", () => {
    const parsed = parseForm(
      studentAvailabilitySchema,
      form([["weeklyHours", "8"], ["locationPreference", "hybrid"], ["compensationPreferences", "paid"]]),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.preferredDurations?.[0]).toContain("at least one length");
  });

  it("asks whether the student needs paid work", () => {
    const parsed = parseForm(
      studentAvailabilitySchema,
      form([["weeklyHours", "8"], ["locationPreference", "hybrid"], ["preferredDurations", "one_year"]]),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.compensationPreferences?.[0]).toContain("at least one");
  });
});

describe("review posting form", () => {
  it("accepts the four fields a review needs", () => {
    const parsed = parseForm(
      reviewPostingSchema,
      form([
        ["title", "Scoping review of remote cardiac rehabilitation"],
        ["summary", "We are screening about nine hundred abstracts and need a second reviewer for the next six weeks."],
        ["authorshipOffered", "true"],
        ["reviewTasks", "screening"],
        ["reviewTasks", "data_extraction"],
      ]),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.authorshipOffered).toBe(true);
    expect(parsed.data.reviewTasks).toEqual(["screening", "data_extraction"]);
  });

  it("requires at least one task, since that is what a student is signing up for", () => {
    const parsed = parseForm(
      reviewPostingSchema,
      form([
        ["title", "Systematic review of sleep interventions"],
        ["summary", "A review of behavioural sleep interventions in adolescents, currently at the extraction stage."],
        ["authorshipOffered", "false"],
      ]),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.reviewTasks?.[0]).toContain("at least one part");
  });
});

describe("opportunity logistics step", () => {
  const logisticsBase: [string, string][] = [
    ["numberOfOpenings", "1"],
    ["hoursPerWeekMin", "6"],
    ["hoursPerWeekMax", "10"],
    ["deadline", "2027-01-31"],
    ["locationMode", "hybrid"],
    ["compensationType", "academic_credit"],
  ];

  it("records every duration the position is open to", () => {
    const parsed = parseForm(
      logisticsStepSchema,
      form([...logisticsBase, ["preferredDurations", "two_semesters"], ["preferredDurations", "one_year"]]),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.preferredDurations).toEqual(["two_semesters", "one_year"]);
  });

  it("will not let a position be saved without a duration", () => {
    const parsed = parseForm(logisticsStepSchema, form(logisticsBase));
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.preferredDurations?.[0]).toContain("at least one length");
  });
});
