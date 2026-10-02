import { describe, expect, it } from "vitest";
import { buildFutureOpportunity, type FutureOpportunityInput } from "@/lib/future-opportunity";

function input(overrides: Partial<FutureOpportunityInput> = {}): FutureOpportunityInput {
  return {
    researcherName: "Amara Okonjo",
    researcherTitle: "Associate Professor",
    department: "Health Research Methods",
    labName: "Cardiovascular Outcomes Group",
    areaNames: ["Cardiology", "Clinical Epidemiology"],
    biography: "We study recovery after cardiac procedures.",
    recruitingNeeds: null,
    note: null,
    ...overrides,
  };
}

describe("writing a Future Research Opportunity from a profile", () => {
  it("names the research areas in the title", () => {
    expect(buildFutureOpportunity(input()).title).toBe("Future Research Opportunity: Cardiology and Clinical Epidemiology");
  });

  it("keeps a long list of areas short in the title and summary", () => {
    const content = buildFutureOpportunity(
      input({ areaNames: ["Cardiology", "Nephrology", "Public Health", "Global Health", "Nutrition"] }),
    );
    expect(content.title).toBe("Future Research Opportunity: Cardiology, Nephrology, and related areas");
    expect(content.summary).toContain("Cardiology, Nephrology, Public Health, and related areas");
    expect(content.summary.length).toBeLessThanOrEqual(400);
  });

  it("says plainly that there is no start date or guaranteed position", () => {
    const content = buildFutureOpportunity(input());
    expect(content.summary).toContain("No fixed start date or guaranteed position");
    expect(content.description).toContain("There is no fixed start date and no guaranteed immediate position");
    expect(content.description).toContain("This is not a posting for a specific project");
  });

  it("carries the profile into the description so nothing has to be invented", () => {
    const content = buildFutureOpportunity(
      input({ recruitingNeeds: "Students comfortable with spreadsheets.", note: "I usually take students in May." }),
    );
    expect(content.description).toContain("Amara Okonjo (Associate Professor, Health Research Methods, Cardiovascular Outcomes Group)");
    expect(content.description).toContain("What they look for in a student: Students comfortable with spreadsheets.");
    expect(content.description).toContain("About their research: We study recovery after cardiac procedures.");
    expect(content.description).toContain("I usually take students in May.");
  });

  it("falls back to the department when no research area is known yet", () => {
    const content = buildFutureOpportunity(input({ areaNames: [] }));
    expect(content.title).toBe("Future Research Opportunity: Health Research Methods");
    expect(content.summary).toContain("Health Research Methods research");
  });

  it("stays inside the limits the edit form enforces", () => {
    const content = buildFutureOpportunity(
      input({ areaNames: ["A".repeat(120), "B".repeat(120)], biography: "x ".repeat(5000), note: "y ".repeat(2000) }),
    );
    expect(content.title.length).toBeLessThanOrEqual(180);
    expect(content.summary.length).toBeLessThanOrEqual(400);
    expect(content.description.length).toBeLessThanOrEqual(8000);
  });
});
