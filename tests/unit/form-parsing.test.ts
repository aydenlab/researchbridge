import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseForm } from "@/lib/action-utils";
import { arrayField } from "@/lib/validation/shared";
import { projectStepSchema } from "@/lib/validation/opportunity";
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

  it("rejects a summary that is too short to be useful on a card", () => {
    const parsed = parseForm(
      projectStepSchema,
      form([...base.filter(([key]) => key !== "summary"), ["summary", "Short"], ["researchFieldIds", uuid]]),
    );
    expect(parsed.ok).toBe(false);
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
  ];

  it("saves with a single research area selected", () => {
    const parsed = parseForm(researcherProfileSchema, form([...base, ["researchFieldIds", uuid]]));
    expect(parsed.ok).toBe(true);
  });

  it("rejects a lab website that is not a full web address", () => {
    const parsed = parseForm(
      researcherProfileSchema,
      form([...base, ["researchFieldIds", uuid], ["labWebsite", "example.mcmaster.ca"]]),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.labWebsite?.[0]).toContain("http");
  });
});

describe("student availability step", () => {
  it("accepts a single semester selection", () => {
    const parsed = parseForm(
      studentAvailabilitySchema,
      form([["weeklyHours", "8"], ["locationPreference", "hybrid"], ["semesters", "Fall"]]),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.semesters).toEqual(["Fall"]);
  });

  it("rejects negative hours", () => {
    const parsed = parseForm(
      studentAvailabilitySchema,
      form([["weeklyHours", "-4"], ["locationPreference", "hybrid"]]),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok || parsed.result.ok) return;
    expect(parsed.result.fieldErrors?.weeklyHours?.[0]).toBe("Hours cannot be negative.");
  });
});
