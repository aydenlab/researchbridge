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
