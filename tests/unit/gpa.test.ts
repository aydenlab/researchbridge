import { describe, expect, it } from "vitest";
import {
  GRADE_SCALES,
  academicStrength,
  compareToMinimum,
  toFourPointEquivalent,
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

describe("4.0 equivalents", () => {
  it("reads the same letter grade as the same number on every scale", () => {
    // An A- is 80 percent, 10 on the 12 point scale, and 3.7 on a 4.0.
    expect(toFourPointEquivalent({ ...percentage, value: 80 })).toBeCloseTo(3.7);
    expect(toFourPointEquivalent({ ...institutionScale, value: 10 })).toBeCloseTo(3.7);
    expect(toFourPointEquivalent({ ...fourPoint, value: 3.7 })).toBeCloseTo(3.7);
  });

  it("does not rank a percentage student a band below a 4.0 student with the same grade", () => {
    // The old fraction-of-maximum comparison put 84 percent at 0.84 and 3.8 at 0.95.
    const fromPercent = toFourPointEquivalent(percentage) ?? 0;
    const fromFour = toFourPointEquivalent(fourPoint) ?? 0;
    expect(Math.abs(fromPercent - fromFour)).toBeLessThan(0.2);
  });

  it("interpolates between letter grades", () => {
    const value = toFourPointEquivalent(institutionScale) ?? 0;
    expect(value).toBeGreaterThan(3.7);
    expect(value).toBeLessThan(3.9);
  });

  it("caps the 4.3 scale at a 4.0 A+", () => {
    expect(toFourPointEquivalent({ type: "gpa", value: 4.3, scaleMax: 4.3, institutionScaleName: null })).toBe(4);
  });

  it("reports an unreadable scale as unknown rather than guessing", () => {
    expect(toFourPointEquivalent({ type: "gpa", value: 6, scaleMax: 7, institutionScaleName: null })).toBeNull();
  });

  it("grades strength gently at the bottom and fully at the top", () => {
    expect(academicStrength(4)).toBe(1);
    expect(academicStrength(3.0)).toBeGreaterThan(0.4);
    expect(academicStrength(1.5)).toBe(0);
  });
});

describe("minimums across scales", () => {
  it("compares a 4.0 student against a 12 point minimum", () => {
    expect(compareToMinimum(fourPoint, { value: 9, scaleMax: 12, type: "institution_scale" })?.meets).toBe(true);
    expect(compareToMinimum({ ...fourPoint, value: 3.0 }, { value: 10, scaleMax: 12, type: "institution_scale" })?.meets).toBe(false);
  });

  it("compares a percentage student against a 4.0 minimum", () => {
    expect(compareToMinimum(percentage, { value: 3.3, scaleMax: 4, type: "gpa" })?.meets).toBe(true);
  });

  it("reports how far short a near miss is", () => {
    const outcome = compareToMinimum({ ...institutionScale, value: 9 }, { value: 10, scaleMax: 12, type: "institution_scale" });
    expect(outcome?.meets).toBe(false);
    expect(outcome?.gap).toBeCloseTo(0.4);
  });
});
