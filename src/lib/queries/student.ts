import { asc, eq } from "drizzle-orm";
import {
  courses,
  db,
  researchExperiences,
  researchFields,
  skills,
  studentAcademicRecords,
  studentCompensationPreferences,
  studentCourses,
  studentCourseTypes,
  studentDurations,
  studentProfiles,
  studentResearchInterests,
  studentSkills,
} from "@/db";
import type { CompensationPreferenceOption, CourseTypeOption, DurationOption } from "@/lib/labels";
import type { AcademicMetric } from "@/lib/gpa";
import type { ApplicantEvidence } from "@/lib/criteria/types";

export type StudentProfileBundle = {
  profile: typeof studentProfiles.$inferSelect;
  skills: { id: string; name: string; slug: string; proficiency: string | null; context: string | null }[];
  courses: { id: string; courseCode: string; courseName: string; status: string; grade: string | null }[];
  fields: { id: string; name: string; slug: string }[];
  experiences: (typeof researchExperiences.$inferSelect)[];
  academicRecords: (typeof studentAcademicRecords.$inferSelect)[];
  durations: DurationOption[];
  courseTypes: CourseTypeOption[];
  compensationPreferences: CompensationPreferenceOption[];
};

export async function loadStudentProfile(studentId: string): Promise<StudentProfileBundle | null> {
  const rows = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, studentId)).limit(1);
  const profile = rows[0];
  if (!profile) return null;

  const [
    skillRows,
    courseRows,
    fieldRows,
    experienceRows,
    academicRows,
    durationRows,
    courseTypeRows,
    compensationRows,
  ] = await Promise.all([
    db
      .select({
        id: skills.id,
        name: skills.name,
        slug: skills.slug,
        proficiency: studentSkills.proficiency,
        context: studentSkills.context,
      })
      .from(studentSkills)
      .innerJoin(skills, eq(skills.id, studentSkills.skillId))
      .where(eq(studentSkills.studentId, studentId))
      .orderBy(asc(skills.name)),
    db
      .select({
        id: courses.id,
        courseCode: courses.courseCode,
        courseName: courses.courseName,
        status: studentCourses.status,
        grade: studentCourses.grade,
      })
      .from(studentCourses)
      .innerJoin(courses, eq(courses.id, studentCourses.courseId))
      .where(eq(studentCourses.studentId, studentId))
      .orderBy(asc(courses.courseCode)),
    db
      .select({ id: researchFields.id, name: researchFields.name, slug: researchFields.slug })
      .from(studentResearchInterests)
      .innerJoin(researchFields, eq(researchFields.id, studentResearchInterests.researchFieldId))
      .where(eq(studentResearchInterests.studentId, studentId))
      .orderBy(asc(researchFields.name)),
    db
      .select()
      .from(researchExperiences)
      .where(eq(researchExperiences.studentId, studentId))
      .orderBy(asc(researchExperiences.sortOrder)),
    db.select().from(studentAcademicRecords).where(eq(studentAcademicRecords.studentId, studentId)),
    db.select({ duration: studentDurations.duration }).from(studentDurations).where(eq(studentDurations.studentId, studentId)),
    db
      .select({ courseType: studentCourseTypes.courseType })
      .from(studentCourseTypes)
      .where(eq(studentCourseTypes.studentId, studentId)),
    db
      .select({ preference: studentCompensationPreferences.preference })
      .from(studentCompensationPreferences)
      .where(eq(studentCompensationPreferences.studentId, studentId)),
  ]);

  return {
    profile,
    skills: skillRows,
    courses: courseRows,
    fields: fieldRows,
    experiences: experienceRows,
    academicRecords: academicRows,
    durations: durationRows.map((row) => row.duration),
    courseTypes: courseTypeRows.map((row) => row.courseType),
    compensationPreferences: compensationRows.map((row) => row.preference),
  };
}

export function toAcademicMetrics(rows: (typeof studentAcademicRecords.$inferSelect)[]): AcademicMetric[] {
  return rows.map((row) => ({
    type: row.metricType,
    value: Number(row.value),
    scaleMax: row.scaleMax === null ? null : Number(row.scaleMax),
    institutionScaleName: row.institutionScaleName,
  }));
}

export function toApplicantEvidence(
  bundle: StudentProfileBundle,
  answers: { questionId: string; prompt: string; text: string | null }[],
): ApplicantEvidence {
  return {
    program: bundle.profile.program,
    faculty: bundle.profile.faculty,
    degreeLevel: bundle.profile.degreeLevel,
    yearLevel: bundle.profile.yearLevel,
    graduationYear: bundle.profile.graduationYear,
    weeklyHours: bundle.profile.weeklyHours,
    locationPreference: bundle.profile.locationPreference,
    desiredStartDate: bundle.profile.desiredStartDate,
    semesters: bundle.profile.semesters ?? [],
    summerAvailable: bundle.profile.summerAvailable,
    skills: bundle.skills.map((skill) => ({
      name: skill.name,
      slug: skill.slug,
      proficiency: skill.proficiency,
      context: skill.context,
    })),
    courses: bundle.courses.map((course) => ({
      courseCode: course.courseCode,
      courseName: course.courseName,
      status: course.status,
    })),
    researchFields: bundle.fields.map((field) => ({ name: field.name, slug: field.slug })),
    experiences: bundle.experiences.map((experience) => ({
      organization: experience.organization,
      title: experience.title,
      supervisor: experience.supervisor,
      description: experience.description,
      techniques: experience.techniques ?? [],
      outputs: experience.outputs ?? [],
    })),
    academicRecords: toAcademicMetrics(bundle.academicRecords),
    answers,
  };
}

export function computeProfileCompletion(bundle: StudentProfileBundle): number {
  const checks: boolean[] = [
    Boolean(bundle.profile.firstName && bundle.profile.lastName),
    Boolean(bundle.profile.program),
    Boolean(bundle.profile.degreeLevel && bundle.profile.yearLevel),
    Boolean(bundle.profile.graduationYear),
    bundle.courses.length > 0,
    bundle.skills.length >= 2,
    bundle.fields.length > 0,
    Boolean(bundle.profile.researchInterestSummary),
    Boolean(bundle.profile.weeklyHours !== null && bundle.profile.locationPreference),
    Boolean(bundle.profile.desiredStartDate),
    bundle.durations.length > 0,
    bundle.compensationPreferences.length > 0,
  ];
  const met = checks.filter(Boolean).length;
  return Math.round((met / checks.length) * 100);
}

export function missingProfileItems(bundle: StudentProfileBundle): string[] {
  const missing: string[] = [];
  if (!bundle.profile.program) missing.push("Program");
  if (!bundle.profile.yearLevel) missing.push("Year of study");
  if (bundle.courses.length === 0) missing.push("Relevant coursework");
  if (bundle.skills.length < 2) missing.push("Skills");
  if (bundle.fields.length === 0) missing.push("Research interests");
  if (!bundle.profile.researchInterestSummary) missing.push("What interests you");
  if (bundle.profile.weeklyHours === null) missing.push("Weekly availability");
  if (!bundle.profile.desiredStartDate) missing.push("Desired start date");
  if (bundle.durations.length === 0) missing.push("How long you want to work for");
  if (bundle.compensationPreferences.length === 0) missing.push("Paid or volunteer");
  return missing;
}
