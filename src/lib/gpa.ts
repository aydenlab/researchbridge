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
 * Anchor points from each supported scale onto a 4.0 equivalent, taken from the
 * letter-grade bands most Canadian programs (and OMSAS) publish: A+ is 4.0, A is
 * 3.9, A- is 3.7, B+ is 3.3, and so on. Values between anchors interpolate, so
 * a 10.5 average on the 12 point scale sits between an A- and an A.
 *
 * A plain fraction of the maximum is the wrong comparison: 80 percent and a 3.7
 * are the same grade, but 0.80 and 0.925 would rank them a full band apart, and
 * every percentage student would look weaker than every 4.0 student.
 */
const FOUR_POINT_ANCHORS: Record<string, [number, number][]> = {
  institution_12: [
    [0, 0], [1, 0.7], [2, 1.0], [3, 1.3], [4, 1.7], [5, 2.0], [6, 2.3],
    [7, 2.7], [8, 3.0], [9, 3.3], [10, 3.7], [11, 3.9], [12, 4.0],
  ],
  gpa_9: [
    [0, 0], [1, 0.7], [2, 1.0], [3, 1.3], [4, 2.0], [5, 2.3], [6, 3.0], [7, 3.3], [8, 3.8], [9, 4.0],
  ],
  gpa_4: [[0, 0], [4, 4]],
  gpa_4_3: [[0, 0], [3.7, 3.7], [4.0, 3.9], [4.3, 4.0]],
  percentage: [
    [0, 0], [45, 0], [50, 0.7], [53, 1.0], [57, 1.3], [60, 1.7], [63, 2.0], [67, 2.3],
    [70, 2.7], [73, 3.0], [77, 3.3], [80, 3.7], [85, 3.9], [90, 4.0], [100, 4.0],
  ],
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
 * A grade on any supported scale as its 4.0 equivalent, or null when the scale
 * is one ResearchBridge does not know how to read. An unknown scale is reported
 * as unknown rather than guessed at.
 */
export function toFourPointEquivalent(metric: AcademicMetric): number | null {
  if (!isValidMetric(metric)) return null;
  const scale = metric.type === "percentage" ? scaleById("percentage") : scaleForMetric(metric);
  const anchors = scale ? FOUR_POINT_ANCHORS[scale.id] : undefined;
  if (!anchors) return null;
  return Math.round(interpolate(anchors, metric.value) * 100) / 100;
}

/**
 * Where a 4.0 equivalent sits between "this is a weak academic record" and
 * "this is as strong as grades get", from 0 to 1. Deliberately gentle at the
 * bottom: a B student is a real candidate, not a zero, and a researcher who
 * weights GPA should see an A student ranked above them rather than see them
 * disappear.
 */
export const ACADEMIC_FLOOR = 2.0;
export const ACADEMIC_CEILING = 3.85;

export function academicStrength(fourPoint: number): number {
  const fraction = (fourPoint - ACADEMIC_FLOOR) / (ACADEMIC_CEILING - ACADEMIC_FLOOR);
  return Math.round(Math.max(0, Math.min(1, fraction)) * 1000) / 1000;
}

/**
 * Compares a grade against a minimum that may be on a different scale. Same
 * scale compares the raw numbers; different scales compare 4.0 equivalents.
 * Null only when either side is on a scale that cannot be read.
 */
export function compareToMinimum(
  metric: AcademicMetric,
  minimum: { value: number; scaleMax: number | null; type: AcademicMetricType },
): { meets: boolean; gap: number } | null {
  const direct = meetsThreshold(metric, minimum);
  const studentFour = toFourPointEquivalent(metric);
  const minimumFour = toFourPointEquivalent({
    type: minimum.type,
    value: minimum.value,
    scaleMax: minimum.type === "percentage" ? null : minimum.scaleMax,
    institutionScaleName: null,
  });
  if (direct !== null) {
    const gap = studentFour !== null && minimumFour !== null ? Math.max(0, minimumFour - studentFour) : 0;
    return { meets: direct, gap: direct ? 0 : gap };
  }
  if (studentFour === null || minimumFour === null) return null;
  return { meets: studentFour >= minimumFour, gap: Math.max(0, Math.round((minimumFour - studentFour) * 100) / 100) };
}
