import { describe, expect, it } from "vitest";
import {
  GRADE_SCALES,
  academicStrength,
  compareToMinimum,
  FAIR_TWELVE_POINT,
  STRONG_TWELVE_POINT,
  toTwelvePointEquivalent,
  formatMetric,
  fractionOfScale,
  isValidMetric,
  meetsThreshold,
  scaleById,
  scaleForMetric,
  type AcademicMetric,
} from "@/lib/gpa";

const institutionScale: AcademicMetric = {
  type: "institution_scale",
  value: 10.5,
  scaleMax: 12,
  institutionScaleName: "12 point",
};

const fourPoint: AcademicMetric = { type: "gpa", value: 3.8, scaleMax: 4, institutionScaleName: null };
const percentage: AcademicMetric = { type: "percentage", value: 84, scaleMax: null, institutionScaleName: null };

describe("grading scales", () => {
  it("never assumes a 4.0 maximum", () => {
    const defaults = GRADE_SCALES.filter((scale) => scale.max === 4);
    expect(defaults).toHaveLength(1);
    expect(GRADE_SCALES.map((scale) => scale.max)).toEqual(expect.arrayContaining([12, 4, 4.3, 9, 100]));
  });

  it("supports the 12 point scale explicitly", () => {
    const scale = scaleById("institution_12");
    expect(scale?.max).toBe(12);
    expect(scale?.institutionScaleName).toBe("12 point");
  });

  it("resolves the scale for a stored metric by its institution scale name", () => {
    expect(scaleForMetric(institutionScale)?.id).toBe("institution_12");
    expect(scaleForMetric(fourPoint)?.id).toBe("gpa_4");
  });
});

describe("metric validation", () => {
  it("accepts a value at the top of its own scale", () => {
    expect(isValidMetric({ ...institutionScale, value: 12 })).toBe(true);
  });

  it("rejects a value above its own scale", () => {
    expect(isValidMetric({ ...institutionScale, value: 12.1 })).toBe(false);
    expect(isValidMetric({ ...fourPoint, value: 4.5 })).toBe(false);
  });

  it("rejects a percentage above one hundred", () => {
    expect(isValidMetric({ ...percentage, value: 101 })).toBe(false);
  });

  it("rejects negative values", () => {
    expect(isValidMetric({ ...fourPoint, value: -1 })).toBe(false);
  });
});

describe("metric presentation", () => {
  it("names the institution scale rather than implying a 4.0", () => {
    expect(formatMetric(institutionScale)).toBe("10.5 on the 12 point scale");
    expect(formatMetric(fourPoint)).toBe("3.8 on a 4 scale");
    expect(formatMetric(percentage)).toBe("84 percent");
  });

  it("computes the fraction relative to the correct maximum", () => {
    expect(fractionOfScale(institutionScale)).toBeCloseTo(10.5 / 12);
    expect(fractionOfScale(fourPoint)).toBeCloseTo(0.95);
    expect(fractionOfScale(percentage)).toBeCloseTo(0.84);
  });
});

describe("thresholds", () => {
  it("compares only within the same scale", () => {
    expect(meetsThreshold(institutionScale, { value: 9, scaleMax: 12, type: "institution_scale" })).toBe(true);
    expect(meetsThreshold(institutionScale, { value: 11, scaleMax: 12, type: "institution_scale" })).toBe(false);
  });

  it("returns unknown rather than converting between scales", () => {
    expect(meetsThreshold(fourPoint, { value: 9, scaleMax: 12, type: "institution_scale" })).toBeNull();
    expect(meetsThreshold(percentage, { value: 3, scaleMax: 4, type: "gpa" })).toBeNull();
  });
});

describe("12 point equivalents", () => {
  it("reads each McMaster band from its percentage range", () => {
    // From the published table: A+ 90-100, A 85-89, A- 80-84, B+ 77-79, F 0-49.
    expect(toTwelvePointEquivalent({ ...percentage, value: 90 })).toBe(12);
    expect(toTwelvePointEquivalent({ ...percentage, value: 85 })).toBe(11);
    expect(toTwelvePointEquivalent({ ...percentage, value: 80 })).toBe(10);
    expect(toTwelvePointEquivalent({ ...percentage, value: 77 })).toBe(9);
    expect(toTwelvePointEquivalent({ ...percentage, value: 73 })).toBe(8);
    expect(toTwelvePointEquivalent({ ...percentage, value: 50 })).toBe(1);
    expect(toTwelvePointEquivalent({ ...percentage, value: 40 })).toBe(0);
  });

  it("leaves a 12 point average exactly as entered", () => {
    expect(toTwelvePointEquivalent(institutionScale)).toBe(10.5);
  });

  it("reads the same letter grade as the same number on every scale", () => {
    // An A is 85 percent, 11 on the 12 point scale, and 3.9 on a 4.0.
    expect(toTwelvePointEquivalent({ ...percentage, value: 85 })).toBe(11);
    expect(toTwelvePointEquivalent({ ...fourPoint, value: 3.9 })).toBe(11);
    expect(toTwelvePointEquivalent({ type: "gpa", value: 4.0, scaleMax: 4.3, institutionScaleName: null })).toBe(11);
  });

  it("reports an unreadable scale as unknown rather than guessing", () => {
    expect(toTwelvePointEquivalent({ type: "gpa", value: 6, scaleMax: 7, institutionScaleName: null })).toBeNull();
  });
});

describe("academic strength", () => {
  it("treats an 11 or 12 as strong, a 10 as middling, and below that as weak", () => {
    expect(academicStrength(12)).toBe(1);
    expect(academicStrength(11)).toBeGreaterThanOrEqual(0.8);
    expect(academicStrength(10)).toBeLessThan(0.5);
    expect(academicStrength(9)).toBeLessThanOrEqual(0.1);
    expect(academicStrength(8)).toBe(0);
  });

  it("separates 11 from 10 by far more than 10 from 9", () => {
    expect(academicStrength(11) - academicStrength(10)).toBeGreaterThan(0.3);
  });

  it("sets the met and partly met lines at an A and an A-", () => {
    expect(STRONG_TWELVE_POINT).toBe(11);
    expect(FAIR_TWELVE_POINT).toBe(10);
  });
});

describe("minimums across scales", () => {
  it("compares a 4.0 student against a 12 point minimum", () => {
    expect(compareToMinimum(fourPoint, { value: 10, scaleMax: 12, type: "institution_scale" })?.meets).toBe(true);
    expect(compareToMinimum({ ...fourPoint, value: 3.3 }, { value: 11, scaleMax: 12, type: "institution_scale" })?.meets).toBe(false);
  });

  it("compares a percentage student against a 12 point minimum", () => {
    expect(compareToMinimum({ ...percentage, value: 86 }, { value: 11, scaleMax: 12, type: "institution_scale" })?.meets).toBe(true);
    expect(compareToMinimum(percentage, { value: 11, scaleMax: 12, type: "institution_scale" })?.meets).toBe(false);
  });

  it("reports how far short a near miss is, in 12 point units", () => {
    const outcome = compareToMinimum({ ...institutionScale, value: 10.6 }, { value: 11, scaleMax: 12, type: "institution_scale" });
    expect(outcome?.meets).toBe(false);
    expect(outcome?.gap).toBeCloseTo(0.4);
  });
});
