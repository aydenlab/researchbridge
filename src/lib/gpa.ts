export type AcademicMetricType = "gpa" | "percentage" | "institution_scale";

export type AcademicMetric = {
  type: AcademicMetricType;
  value: number;
  scaleMax: number | null;
  institutionScaleName: string | null;
};

export type GradeScale = {
  id: string;
  label: string;
  metricType: AcademicMetricType;
  max: number;
  institutionScaleName: string | null;
  step: number;
};

export const GRADE_SCALES: GradeScale[] = [
  {
    id: "institution_12",
    label: "12 point scale",
    metricType: "institution_scale",
    max: 12,
    institutionScaleName: "12 point",
    step: 0.01,
  },
  { id: "gpa_4", label: "4.0 scale", metricType: "gpa", max: 4, institutionScaleName: null, step: 0.01 },
  { id: "gpa_4_3", label: "4.3 scale", metricType: "gpa", max: 4.3, institutionScaleName: null, step: 0.01 },
  { id: "gpa_9", label: "9 point scale", metricType: "institution_scale", max: 9, institutionScaleName: "9 point", step: 0.01 },
  { id: "percentage", label: "Percentage", metricType: "percentage", max: 100, institutionScaleName: null, step: 0.1 },
];

export function scaleById(id: string): GradeScale | null {
  return GRADE_SCALES.find((scale) => scale.id === id) ?? null;
}

export function scaleForMetric(metric: AcademicMetric): GradeScale | null {
  if (metric.institutionScaleName) {
    const byName = GRADE_SCALES.find((scale) => scale.institutionScaleName === metric.institutionScaleName);
    if (byName) return byName;
  }
  return GRADE_SCALES.find((scale) => scale.metricType === metric.type && scale.max === metric.scaleMax) ?? null;
}

export function isValidMetric(metric: AcademicMetric): boolean {
  if (!Number.isFinite(metric.value) || metric.value < 0) return false;
  if (metric.scaleMax === null) return metric.type === "percentage" ? metric.value <= 100 : true;
  return metric.scaleMax > 0 && metric.value <= metric.scaleMax;
}

export function formatMetric(metric: AcademicMetric): string {
  if (metric.type === "percentage") return `${trim(metric.value)} percent`;
  const scaleLabel = metric.institutionScaleName
    ? `on the ${metric.institutionScaleName} scale`
    : metric.scaleMax
      ? `on a ${trim(metric.scaleMax)} scale`
      : "";
  return `${trim(metric.value)}${scaleLabel ? ` ${scaleLabel}` : ""}`;
}

export function fractionOfScale(metric: AcademicMetric): number | null {
  if (!isValidMetric(metric)) return null;
  const max = metric.type === "percentage" ? 100 : metric.scaleMax;
  if (!max || max <= 0) return null;
  return metric.value / max;
}

export function meetsThreshold(metric: AcademicMetric, threshold: { value: number; scaleMax: number | null; type: AcademicMetricType }): boolean | null {
  const sameScale =
    metric.type === threshold.type && (metric.scaleMax ?? null) === (threshold.scaleMax ?? null);
  if (!sameScale) return null;
  return metric.value >= threshold.value;
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/**
 * The pilot runs at McMaster, so the 12 point scale is the reference every
 * other scale is read onto. The bands are McMaster's published equivalences:
 * A+ is 12 (90 to 100 percent), A is 11 (85 to 89), A- is 10 (80 to 84), B+ is
 * 9 (77 to 79), and so on down to F at 0 (below 50). Values between anchors
 * interpolate, so a 10.5 average sits halfway between an A- and an A.
 *
 * A plain fraction of the maximum is the wrong comparison: 85 percent and an 11
 * are the same grade, but 0.85 and 0.92 would rank them a band apart.
 */
const TWELVE_POINT_ANCHORS: Record<string, [number, number][]> = {
  institution_12: [[0, 0], [12, 12]],
  percentage: [
    [0, 0], [49, 0], [50, 1], [53, 2], [57, 3], [60, 4], [63, 5], [67, 6],
    [70, 7], [73, 8], [77, 9], [80, 10], [85, 11], [90, 12], [100, 12],
  ],
  // The usual letter-grade reading of a 4.0: A+ 4.0, A 3.9, A- 3.7, B+ 3.3.
  gpa_4: [
    [0, 0], [0.7, 1], [1.0, 2], [1.3, 3], [1.7, 4], [2.0, 5], [2.3, 6],
    [2.7, 7], [3.0, 8], [3.3, 9], [3.7, 10], [3.9, 11], [4.0, 12],
  ],
  gpa_4_3: [
    [0, 0], [0.7, 1], [1.0, 2], [1.3, 3], [1.7, 4], [2.0, 5], [2.3, 6],
    [2.7, 7], [3.0, 8], [3.3, 9], [3.7, 10], [4.0, 11], [4.3, 12],
  ],
  // York's 9 point scale: A+ 9, A 8 (80 to 89 percent), B+ 7, B 6, C+ 5, C 4.
  gpa_9: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 5], [5, 6], [6, 8], [7, 9], [8, 10.5], [9, 12]],
};

function interpolate(anchors: [number, number][], value: number): number {
  if (value <= anchors[0][0]) return anchors[0][1];
  for (let index = 1; index < anchors.length; index += 1) {
    const [x1, y1] = anchors[index];
    if (value <= x1) {
      const [x0, y0] = anchors[index - 1];
      return x1 === x0 ? y1 : y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return anchors[anchors.length - 1][1];
}

/**
 * A grade on any supported scale as its McMaster 12 point equivalent, or null
 * when the scale is one ResearchBridge does not know how to read. An unknown
 * scale is reported as unknown rather than guessed at.
 */
export function toTwelvePointEquivalent(metric: AcademicMetric): number | null {
  if (!isValidMetric(metric)) return null;
  const scale = metric.type === "percentage" ? scaleById("percentage") : scaleForMetric(metric);
  const anchors = scale ? TWELVE_POINT_ANCHORS[scale.id] : undefined;
  if (!anchors) return null;
  return Math.round(interpolate(anchors, metric.value) * 100) / 100;
}

/**
 * How strong a 12 point average is, from 0 to 1, for students competing for
 * research positions. It is deliberately steep: in health and life sciences an
 * 11 or a 12 is common and is what supervisors look for, a 10 is middling, and
 * anything below that counts for very little.
 */
const STRENGTH_ANCHORS: [number, number][] = [
  [0, 0], [8, 0], [9, 0.1], [10, 0.4], [10.5, 0.6], [11, 0.8], [11.5, 0.92], [12, 1],
];

/** At or above this a GPA counts as met: an A average. */
export const STRONG_TWELVE_POINT = 11;
/** At or above this it counts as partly met: an A- average. */
export const FAIR_TWELVE_POINT = 10;

export function academicStrength(twelvePoint: number): number {
  return Math.round(interpolate(STRENGTH_ANCHORS, Math.max(0, Math.min(12, twelvePoint))) * 1000) / 1000;
}

/**
 * Compares a grade against a minimum that may be on a different scale. Same
 * scale compares the raw numbers; different scales compare 12 point
 * equivalents. The gap is in 12 point units. Null only when either side is on
 * a scale that cannot be read.
 */
export function compareToMinimum(
  metric: AcademicMetric,
  minimum: { value: number; scaleMax: number | null; type: AcademicMetricType },
): { meets: boolean; gap: number } | null {
  const direct = meetsThreshold(metric, minimum);
  const student = toTwelvePointEquivalent(metric);
  const required = toTwelvePointEquivalent({
    type: minimum.type,
    value: minimum.value,
    scaleMax: minimum.type === "percentage" ? null : minimum.scaleMax,
    institutionScaleName: null,
  });
  const gap = student !== null && required !== null ? Math.max(0, Math.round((required - student) * 100) / 100) : null;
  if (direct !== null) return { meets: direct, gap: direct ? 0 : (gap ?? 0) };
  if (student === null || required === null) return null;
  return { meets: student >= required, gap: gap ?? 0 };
}
