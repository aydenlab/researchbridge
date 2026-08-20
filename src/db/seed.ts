import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";
import { slugify } from "../lib/format";
import { evaluateDeterministic } from "../lib/criteria/engine";
import type { Criterion } from "../lib/criteria/types";
import { loadStudentProfile, toApplicantEvidence } from "../lib/queries/student";
import { persistCriterionResults } from "../lib/queries/applications";

type Ids = Record<string, string>;

const RESEARCH_FIELDS = [
  "Neuroscience",
  "Oncology",
  "Cardiology",
  "Genetics",
  "Epidemiology",
  "Public Health",
  "Immunology",
  "Bioinformatics",
  "Health Policy",
  "Rehabilitation Science",
  "Psychology",
  "Microbiology",
  "Nutrition",
  "Kinesiology",
  "Global Health",
  "Clinical Trials",
];

const SKILLS: [string, string][] = [
  ["Python", "Computing"],
  ["R", "Computing"],
  ["MATLAB", "Computing"],
  ["SPSS", "Computing"],
  ["SQL", "Computing"],
  ["Machine learning", "Computing"],
  ["Bioinformatics", "Computing"],
  ["Data analysis", "Analysis"],
  ["Statistics", "Analysis"],
  ["Data visualization", "Analysis"],
  ["Systematic reviews", "Analysis"],
  ["Literature reviews", "Analysis"],
  ["Wet lab", "Laboratory"],
  ["Cell culture", "Laboratory"],
  ["Microscopy", "Laboratory"],
  ["PCR", "Laboratory"],
  ["Western blot", "Laboratory"],
  ["Flow cytometry", "Laboratory"],
  ["Immunohistochemistry", "Laboratory"],
  ["Patient recruitment", "Clinical"],
  ["Chart review", "Clinical"],
  ["REDCap", "Clinical"],
  ["Scientific writing", "Communication"],
  ["Presentation", "Communication"],
  ["Qualitative coding", "Analysis"],
  ["Survey design", "Analysis"],
  ["Neuroimaging analysis", "Analysis"],
  ["Animal handling", "Laboratory"],
];

const COURSES: [string, string, string][] = [
  ["BIOLOGY 1A03", "Cellular and Molecular Biology", "Biology"],
  ["BIOLOGY 2B03", "Cell Biology", "Biology"],
  ["BIOLOGY 2C03", "Genetics", "Biology"],
  ["BIOCHEM 2EE3", "Metabolism and Physiological Chemistry", "Biochemistry"],
  ["HTHSCI 2G03", "Introduction to Health Research Methods", "Health Sciences"],
  ["HTHSCI 3H03", "Epidemiology", "Health Sciences"],
  ["STATS 2B03", "Statistical Methods for Science", "Statistics"],
  ["STATS 3Y03", "Probability and Statistics", "Statistics"],
  ["COMPSCI 1MD3", "Introduction to Programming", "Computing and Software"],
  ["COMPSCI 2DB3", "Databases", "Computing and Software"],
  ["PSYCH 2H03", "Research Methods in Psychology", "Psychology"],
  ["PSYCH 3M03", "Cognitive Neuroscience", "Psychology"],
  ["KINESIOL 2CC3", "Human Physiology", "Kinesiology"],
  ["NURSING 2FF3", "Health Assessment", "Nursing"],
  ["CHEM 2OA3", "Organic Chemistry", "Chemistry"],
  ["MEDPHYS 3B03", "Medical Imaging", "Medical Physics"],
];

const FACULTIES = [
  "Faculty of Health Sciences",
  "Faculty of Science",
  "Faculty of Engineering",
  "Faculty of Social Sciences",
  "DeGroote School of Business",
  "Faculty of Humanities",
];

const DEPARTMENTS: [string, string][] = [
  ["Health Research Methods, Evidence, and Impact", "Faculty of Health Sciences"],
  ["Department of Medicine", "Faculty of Health Sciences"],
  ["Department of Biochemistry and Biomedical Sciences", "Faculty of Health Sciences"],
  ["Department of Pathology and Molecular Medicine", "Faculty of Health Sciences"],
  ["School of Rehabilitation Science", "Faculty of Health Sciences"],
  ["School of Nursing", "Faculty of Health Sciences"],
  ["Department of Psychiatry and Behavioural Neurosciences", "Faculty of Health Sciences"],
  ["Department of Biology", "Faculty of Science"],
  ["Department of Kinesiology", "Faculty of Science"],
  ["Department of Psychology, Neuroscience and Behaviour", "Faculty of Science"],
  ["Department of Computing and Software", "Faculty of Engineering"],
];

async function reset() {
  await db.execute(sql`
    truncate table
      analytics_events, audit_logs, notifications, placement_outcomes, application_status_history,
      criterion_evaluations, ai_analyses, researcher_application_notes, application_snapshots,
      application_answers, applications, saved_opportunities, opportunity_research_materials,
      opportunity_questions, opportunity_criteria, opportunity_skills, opportunity_fields, opportunities,
      research_experiences, student_research_interests, student_skills, student_courses,
      student_academic_records, student_profiles, researcher_fields, researcher_profiles,
      waitlist_entries, stored_files, sessions, email_verification_codes, users,
      courses, skills, research_fields, institution_departments, institution_faculties,
      institution_email_domains, institutions, feature_flags
    restart identity cascade
  `);
}

async function main() {
  console.log("seeding ResearchBridge");
  await reset();

  const [mcmaster] = await db
    .insert(s.institutions)
    .values({
      name: "McMaster University",
      slug: "mcmaster",
      shortName: "McMaster",
      location: "Hamilton, Ontario",
      gpaScaleName: "McMaster 12 point",
      gpaScaleMax: "12",
      active: true,
      isPilot: true,
    })
    .returning();

  const [western] = await db
    .insert(s.institutions)
    .values({
      name: "Western University",
      slug: "western",
      shortName: "Western",
      location: "London, Ontario",
      gpaScaleName: "4.0 scale",
      gpaScaleMax: "4",
      active: false,
    })
    .returning();

  await db.insert(s.institutionEmailDomains).values([
    { institutionId: mcmaster.id, domain: "mcmaster.ca" },
    { institutionId: mcmaster.id, domain: "learnlink.mcmaster.ca" },
    { institutionId: western.id, domain: "uwo.ca" },
  ]);

  const facultyRows = await db
    .insert(s.institutionFaculties)
    .values(FACULTIES.map((name, index) => ({ institutionId: mcmaster.id, name, sortOrder: index })))
    .returning();
  const facultyIds: Ids = Object.fromEntries(facultyRows.map((row) => [row.name, row.id]));

  await db.insert(s.institutionDepartments).values(
    DEPARTMENTS.map(([name, faculty]) => ({
      institutionId: mcmaster.id,
      facultyId: facultyIds[faculty],
      name,
    })),
  );

  const fieldRows = await db
    .insert(s.researchFields)
    .values(RESEARCH_FIELDS.map((name) => ({ name, slug: slugify(name) })))
    .returning();
  const fields: Ids = Object.fromEntries(fieldRows.map((row) => [row.name, row.id]));

  const skillRows = await db
    .insert(s.skills)
    .values(SKILLS.map(([name, category]) => ({ name, slug: slugify(name), category })))
    .returning();
  const skills: Ids = Object.fromEntries(skillRows.map((row) => [row.name, row.id]));

  const courseRows = await db
    .insert(s.courses)
    .values(
      COURSES.map(([courseCode, courseName, department]) => ({
        institutionId: mcmaster.id,
        courseCode,
        courseName,
        department,
      })),
    )
    .returning();
  const courses: Ids = Object.fromEntries(courseRows.map((row) => [row.courseCode, row.id]));

  await db.insert(s.featureFlags).values([
    { key: "AI_ANALYSIS_ENABLED", enabled: true, description: "Claude evidence analysis on applications." },
    { key: "VIDEO_RESPONSES_ENABLED", enabled: false, description: "Allow researchers to request a video response." },
    { key: "WAITLIST_ENABLED", enabled: true, description: "Public waitlist forms accept submissions." },
    { key: "PUBLIC_SIGNUP_ENABLED", enabled: true, description: "Students can create accounts directly." },
    { key: "RESEARCHER_SIGNUP_ENABLED", enabled: true, description: "Researchers can create accounts directly." },
  ]);

  const now = new Date();
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 86400000);
  const isoDate = (days: number) => daysFromNow(days).toISOString().slice(0, 10);

  const [admin] = await db
    .insert(s.users)
    .values({
      email: "admin@myresearchbridge.com",
      role: "admin",
      accountStatus: "active",
      institutionId: mcmaster.id,
      emailVerifiedAt: now,
      onboardingCompletedAt: now,
    })
    .returning();

  const researcherSeeds = [
    {
      email: "okonjoa@mcmaster.ca",
      firstName: "Amara",
      lastName: "Okonjo",
      title: "Associate Professor",
      researcherType: "principal_investigator" as const,
      department: "Health Research Methods, Evidence, and Impact",
      faculty: "Faculty of Health Sciences",
      labName: "Cardiovascular Outcomes Group",
      labWebsite: "https://example.mcmaster.ca/cardiovascular-outcomes",
      biography:
        "I study how routinely collected clinical data can explain differences in cardiovascular readmission. My group works with retrospective hospital records and spends a lot of time on data quality, which is where most new students start.",
      verificationStatus: "verified" as const,
      fields: ["Cardiology", "Epidemiology", "Public Health"],
    },
    {
      email: "haldenr@mcmaster.ca",
      firstName: "Rosalind",
      lastName: "Halden",
      title: "Assistant Professor",
      researcherType: "professor" as const,
      department: "Department of Psychiatry and Behavioural Neurosciences",
      faculty: "Faculty of Health Sciences",
      labName: "Developmental Neuroimaging Lab",
      labWebsite: "https://example.mcmaster.ca/dev-neuroimaging",
      biography:
        "Our lab uses structural and functional imaging to study how attention networks develop through adolescence. Students on the team learn preprocessing pipelines and quality control before touching analysis.",
      verificationStatus: "verified" as const,
      fields: ["Neuroscience", "Psychology"],
    },
    {
      email: "tanjiro.sano@mcmaster.ca",
      firstName: "Jiro",
      lastName: "Sano",
      title: "Postdoctoral Fellow",
      researcherType: "postdoc" as const,
      department: "Department of Biochemistry and Biomedical Sciences",
      faculty: "Faculty of Health Sciences",
      labName: "Tumour Microenvironment Lab",
      labWebsite: null,
      biography:
        "I work on how stromal cells shape drug response in solid tumours. Most of my week is spent at the bench, and I supervise undergraduate students on focused sub-projects.",
      verificationStatus: "verified" as const,
      fields: ["Oncology", "Immunology"],
    },
    {
      email: "delacruzm@mcmaster.ca",
      firstName: "Marisol",
      lastName: "De la Cruz",
      title: "Associate Professor",
      researcherType: "faculty" as const,
      department: "School of Rehabilitation Science",
      faculty: "Faculty of Health Sciences",
      labName: "Mobility and Aging Lab",
      labWebsite: "https://example.mcmaster.ca/mobility-aging",
      biography:
        "My work looks at how community exercise programs affect mobility outcomes for older adults. Students help with data collection sessions and participant scheduling.",
      verificationStatus: "verified" as const,
      fields: ["Rehabilitation Science", "Kinesiology", "Public Health"],
    },
    {
      email: "n.abubakar@mcmaster.ca",
      firstName: "Nadia",
      lastName: "Abubakar",
      title: "PhD Candidate",
      researcherType: "phd_student" as const,
      department: "Department of Biology",
      faculty: "Faculty of Science",
      labName: "Gut Microbiome Group",
      labWebsite: null,
      biography:
        "I am finishing a thesis on diet-associated shifts in gut microbial communities. I am recruiting a student to help with a literature review that will support the final chapter.",
      verificationStatus: "verified" as const,
      fields: ["Microbiology", "Nutrition", "Bioinformatics"],
    },
    {
      email: "p.vasquez@mcmaster.ca",
      firstName: "Paulo",
      lastName: "Vasquez",
      title: "Lab Manager",
      researcherType: "lab_manager" as const,
      department: "Department of Pathology and Molecular Medicine",
      faculty: "Faculty of Health Sciences",
      labName: "Clinical Genomics Core",
      labWebsite: null,
      biography:
        "I run the day-to-day operations of a genomics core facility and coordinate the undergraduate students who support sequencing workflows.",
      verificationStatus: "pending" as const,
      fields: ["Genetics", "Bioinformatics"],
    },
  ];

  const researcherIds: Ids = {};
  for (const seed of researcherSeeds) {
    const [user] = await db
      .insert(s.users)
      .values({
        email: seed.email,
        role: "researcher",
        accountStatus: "active",
        institutionId: mcmaster.id,
        emailVerifiedAt: now,
        onboardingCompletedAt: now,
      })
      .returning();

    await db.insert(s.researcherProfiles).values({
      userId: user.id,
      firstName: seed.firstName,
      lastName: seed.lastName,
      researcherType: seed.researcherType,
      title: seed.title,
      department: seed.department,
      faculty: seed.faculty,
      labName: seed.labName,
      labWebsite: seed.labWebsite,
      biography: seed.biography,
      recruitingOnBehalfOf: "personally",
      verificationStatus: seed.verificationStatus,
      approvedAt: seed.verificationStatus === "verified" ? now : null,
      approvedBy: seed.verificationStatus === "verified" ? admin.id : null,
      onboardingStep: 4,
    });

    await db
      .insert(s.researcherFields)
      .values(seed.fields.map((name) => ({ researcherId: user.id, researchFieldId: fields[name] })));

    researcherIds[seed.email] = user.id;
  }

  const studentSeeds = [
    {
      email: "adeyemij@mcmaster.ca",
      firstName: "Jordan",
      lastName: "Adeyemi",
      program: "Bachelor of Health Sciences",
      faculty: "Faculty of Health Sciences",
      specialization: "Child Health",
      yearLevel: 2,
      graduationYear: 2028,
      weeklyHours: 10,
      location: "hybrid" as const,
      summary:
        "I am drawn to questions about why patients with similar diagnoses have very different outcomes after discharge. I would like to spend more time with real clinical data.",
      skills: [["Python", "working"], ["Data analysis", "working"], ["Statistics", "exposure"], ["Literature reviews", "working"]],
      courses: ["BIOLOGY 2B03", "HTHSCI 2G03", "STATS 2B03", "COMPSCI 1MD3"],
      fields: ["Cardiology", "Epidemiology", "Public Health"],
      gpa: { type: "institution_scale" as const, value: "10.50", scaleMax: "12", scaleName: "McMaster 12 point" },
      experiences: [
        {
          organization: "McMaster Genomics Reading Group",
          supervisor: "Dr. Elena Petrov",
          title: "Student volunteer",
          startDate: "2025-09-01",
          endDate: "2026-04-30",
          description:
            "Cleaned and merged longitudinal clinical spreadsheets in Python with pandas, then produced summary tables for a weekly reading group. Wrote short methods notes for each dataset.",
          techniques: ["Python", "Data analysis"],
          outputs: ["Report"],
        },
      ],
    },
    {
      email: "chenwei@mcmaster.ca",
      firstName: "Wei",
      lastName: "Chen",
      program: "Honours Biology",
      faculty: "Faculty of Science",
      specialization: "Molecular Biology",
      yearLevel: 3,
      graduationYear: 2027,
      weeklyHours: 12,
      location: "in_person" as const,
      summary:
        "I want a bench project where I can build real technical skill. I have spent two terms in a teaching lab and I am comfortable with sterile technique.",
      skills: [["Cell culture", "working"], ["PCR", "proficient"], ["Western blot", "working"], ["Wet lab", "proficient"], ["Microscopy", "exposure"]],
      courses: ["BIOLOGY 2B03", "BIOLOGY 2C03", "BIOCHEM 2EE3", "CHEM 2OA3"],
      fields: ["Oncology", "Immunology", "Genetics"],
      gpa: { type: "institution_scale" as const, value: "11.00", scaleMax: "12", scaleName: "McMaster 12 point" },
      experiences: [
        {
          organization: "Undergraduate Teaching Laboratory",
          supervisor: "Dr. Hana Farouk",
          title: "Laboratory assistant",
          startDate: "2025-01-08",
          endDate: null,
          description:
            "Prepared reagents, ran routine PCR for a third-year genetics course, and helped students troubleshoot gel electrophoresis. Maintained the cell culture incubator log.",
          techniques: ["PCR", "Cell culture", "Wet lab"],
          outputs: ["No formal output"],
        },
      ],
    },
    {
      email: "obrienk@mcmaster.ca",
      firstName: "Keira",
      lastName: "O'Brien",
      program: "Bachelor of Health Sciences",
      faculty: "Faculty of Health Sciences",
      specialization: null,
      yearLevel: 1,
      graduationYear: 2029,
      weeklyHours: 6,
      location: "hybrid" as const,
      summary:
        "This is my first year and I have not done research before. I read a lot about public health policy and I would like to find a project where I can start learning properly.",
      skills: [["Literature reviews", "exposure"], ["Scientific writing", "working"]],
      courses: ["BIOLOGY 1A03", "HTHSCI 2G03"],
      fields: ["Public Health", "Health Policy", "Global Health"],
      gpa: null,
      experiences: [],
    },
    {
      email: "npatel@mcmaster.ca",
      firstName: "Nikhil",
      lastName: "Patel",
      program: "Computer Science and Biology",
      faculty: "Faculty of Engineering",
      specialization: "Bioinformatics",
      yearLevel: 4,
      graduationYear: 2026,
      weeklyHours: 15,
      location: "remote" as const,
      summary:
        "I like problems where the biology and the computation are both hard. I have written pipelines for sequence data and I am comfortable on the command line.",
      skills: [["Python", "advanced"], ["R", "proficient"], ["Bioinformatics", "proficient"], ["SQL", "working"], ["Machine learning", "working"], ["Data visualization", "proficient"]],
      courses: ["COMPSCI 1MD3", "COMPSCI 2DB3", "BIOLOGY 2C03", "STATS 3Y03"],
      fields: ["Bioinformatics", "Genetics", "Microbiology"],
      gpa: { type: "gpa" as const, value: "3.80", scaleMax: "4", scaleName: null },
      experiences: [
        {
          organization: "Hamilton Health Data Hackathon",
          supervisor: null,
          title: "Team lead",
          startDate: "2025-10-01",
          endDate: "2025-10-03",
          description:
            "Built a small pipeline that normalized hospital admission records and produced readmission summaries. Presented results to a panel of clinicians.",
          techniques: ["Python", "SQL", "Data visualization"],
          outputs: ["Code", "Conference presentation"],
        },
        {
          organization: "Genome Assembly Project",
          supervisor: "Dr. Idris Bello",
          title: "Research volunteer",
          startDate: "2026-01-06",
          endDate: null,
          description:
            "Benchmarked three short-read assemblers on bacterial isolates and documented parameter sensitivity. Wrote the reproducibility notes for the group.",
          techniques: ["Bioinformatics", "Python"],
          outputs: ["Report", "Code"],
        },
      ],
    },
    {
      email: "l.rossi@mcmaster.ca",
      firstName: "Luca",
      lastName: "Rossi",
      program: "Kinesiology",
      faculty: "Faculty of Science",
      specialization: null,
      yearLevel: 3,
      graduationYear: 2027,
      weeklyHours: 8,
      location: "in_person" as const,
      summary:
        "I coach a community running group and I am interested in how exercise programs actually change mobility for older adults, not just in a lab setting.",
      skills: [["Data analysis", "exposure"], ["Patient recruitment", "working"], ["Presentation", "proficient"], ["SPSS", "exposure"]],
      courses: ["KINESIOL 2CC3", "STATS 2B03", "PSYCH 2H03"],
      fields: ["Rehabilitation Science", "Kinesiology"],
      gpa: { type: "institution_scale" as const, value: "9.30", scaleMax: "12", scaleName: "McMaster 12 point" },
      experiences: [],
    },
    {
      email: "s.mwangi@mcmaster.ca",
      firstName: "Sila",
      lastName: "Mwangi",
      program: "Honours Psychology, Neuroscience and Behaviour",
      faculty: "Faculty of Science",
      specialization: "Cognitive Neuroscience",
      yearLevel: 3,
      graduationYear: 2027,
      weeklyHours: 10,
      location: "in_person" as const,
      summary:
        "I am interested in how attention changes through adolescence, and I would like hands-on experience with imaging data rather than only reading about it.",
      skills: [["MATLAB", "working"], ["Python", "working"], ["Statistics", "working"], ["Neuroimaging analysis", "exposure"]],
      courses: ["PSYCH 2H03", "PSYCH 3M03", "STATS 2B03", "MEDPHYS 3B03"],
      fields: ["Neuroscience", "Psychology"],
      gpa: { type: "institution_scale" as const, value: "10.10", scaleMax: "12", scaleName: "McMaster 12 point" },
      experiences: [
        {
          organization: "Perception and Action Laboratory",
          supervisor: "Dr. Tomas Lindgren",
          title: "Research assistant",
          startDate: "2025-05-01",
          endDate: "2025-08-29",
          description:
            "Ran behavioural sessions with adult participants, scored reaction time data in MATLAB, and prepared figures for a lab meeting.",
          techniques: ["MATLAB", "Statistics"],
          outputs: ["Poster"],
        },
      ],
    },
    {
      email: "gagnona@mcmaster.ca",
      firstName: "Amelie",
      lastName: "Gagnon",
      program: "Nursing",
      faculty: "Faculty of Health Sciences",
      specialization: null,
      yearLevel: 2,
      graduationYear: 2028,
      weeklyHours: 6,
      location: "in_person" as const,
      summary:
        "I work with patients on placement and I keep noticing gaps between what is charted and what actually happens. I want to look at that properly.",
      skills: [["Chart review", "exposure"], ["REDCap", "exposure"], ["Scientific writing", "working"], ["Patient recruitment", "exposure"]],
      courses: ["NURSING 2FF3", "HTHSCI 2G03"],
      fields: ["Public Health", "Clinical Trials", "Health Policy"],
      gpa: { type: "percentage" as const, value: "84.00", scaleMax: null, scaleName: null },
      experiences: [],
    },
    {
      email: "h.kowalski@mcmaster.ca",
      firstName: "Hania",
      lastName: "Kowalski",
      program: "Master of Public Health",
      faculty: "Faculty of Health Sciences",
      specialization: "Epidemiology",
      yearLevel: 5,
      graduationYear: 2027,
      weeklyHours: 14,
      location: "hybrid" as const,
      summary:
        "My thesis is on screening uptake in newcomer communities. I have run two systematic searches and I am comfortable with grey literature.",
      skills: [["Systematic reviews", "advanced"], ["Literature reviews", "advanced"], ["R", "working"], ["Statistics", "proficient"], ["Qualitative coding", "working"], ["Survey design", "working"]],
      courses: ["HTHSCI 3H03", "STATS 3Y03"],
      fields: ["Epidemiology", "Public Health", "Global Health"],
      gpa: { type: "gpa" as const, value: "3.90", scaleMax: "4", scaleName: null },
      experiences: [
        {
          organization: "Regional Public Health Unit",
          supervisor: "Dr. Priya Nandakumar",
          title: "Summer research student",
          startDate: "2025-05-05",
          endDate: "2025-08-22",
          description:
            "Completed a systematic search on cancer screening uptake, screened 1,400 abstracts against inclusion criteria, and drafted the methods section of the resulting report.",
          techniques: ["Systematic reviews", "Literature reviews"],
          outputs: ["Report", "Publication"],
        },
      ],
    },
    {
      email: "d.osei@mcmaster.ca",
      firstName: "Daniel",
      lastName: "Osei",
      program: "Biochemistry",
      faculty: "Faculty of Science",
      specialization: null,
      yearLevel: 2,
      graduationYear: 2028,
      weeklyHours: 9,
      location: "in_person" as const,
      summary:
        "I have not worked in a research lab yet. I enjoyed my biochemistry labs more than anything else this year and I want to keep going.",
      skills: [["Wet lab", "exposure"], ["Scientific writing", "exposure"]],
      courses: ["BIOCHEM 2EE3", "CHEM 2OA3", "BIOLOGY 1A03"],
      fields: ["Oncology", "Genetics"],
      gpa: { type: "institution_scale" as const, value: "8.70", scaleMax: "12", scaleName: "McMaster 12 point" },
      experiences: [],
    },
    {
      email: "t.nakamura@mcmaster.ca",
      firstName: "Tomo",
      lastName: "Nakamura",
      program: "Integrated Science",
      faculty: "Faculty of Science",
      specialization: "Microbiology",
      yearLevel: 4,
      graduationYear: 2026,
      weeklyHours: 11,
      location: "hybrid" as const,
      summary:
        "I like reading widely and synthesizing. I would rather write a good review than run one more gel, though I am happy to do both.",
      skills: [["Literature reviews", "proficient"], ["Systematic reviews", "working"], ["Scientific writing", "proficient"], ["R", "exposure"], ["Wet lab", "working"]],
      courses: ["BIOLOGY 2C03", "BIOLOGY 1A03", "STATS 2B03"],
      fields: ["Microbiology", "Nutrition", "Bioinformatics"],
      gpa: { type: "institution_scale" as const, value: "9.80", scaleMax: "12", scaleName: "McMaster 12 point" },
      experiences: [
        {
          organization: "Integrated Science Thesis Project",
          supervisor: "Dr. Nadia Abubakar",
          title: "Thesis student",
          startDate: "2025-09-08",
          endDate: null,
          description:
            "Writing a narrative review on short-chain fatty acid production across dietary interventions. Built and maintained the screening spreadsheet for roughly 300 papers.",
          techniques: ["Literature reviews", "Scientific writing"],
          outputs: ["Report"],
        },
      ],
    },
  ];

  const studentIds: Ids = {};
  for (const seed of studentSeeds) {
    const [user] = await db
      .insert(s.users)
      .values({
        email: seed.email,
        role: "student",
        accountStatus: "active",
        institutionId: mcmaster.id,
        emailVerifiedAt: now,
        onboardingCompletedAt: now,
      })
      .returning();

    await db.insert(s.studentProfiles).values({
      userId: user.id,
      firstName: seed.firstName,
      lastName: seed.lastName,
      degreeLevel: seed.yearLevel >= 5 ? "masters" : "undergraduate",
      program: seed.program,
      faculty: seed.faculty,
      specialization: seed.specialization,
      yearLevel: seed.yearLevel,
      graduationYear: seed.graduationYear,
      researchInterestSummary: seed.summary,
      desiredStartDate: isoDate(21),
      weeklyHours: seed.weeklyHours,
      semesters: ["Fall", "Winter"],
      summerAvailable: true,
      locationPreference: seed.location,
      profileCompletion: seed.experiences.length > 0 ? 100 : 85,
      onboardingStep: 8,
    });

    if (seed.gpa) {
      await db.insert(s.studentAcademicRecords).values({
        studentId: user.id,
        metricType: seed.gpa.type,
        value: seed.gpa.value,
        scaleMax: seed.gpa.scaleMax,
        institutionScaleName: seed.gpa.scaleName,
        label: "Cumulative average",
      });
    }

    if (seed.skills.length > 0) {
      await db.insert(s.studentSkills).values(
        seed.skills.map(([name, proficiency]) => ({
          studentId: user.id,
          skillId: skills[name],
          proficiency: proficiency as "exposure" | "working" | "proficient" | "advanced",
        })),
      );
    }

    await db
      .insert(s.studentCourses)
      .values(seed.courses.map((code) => ({ studentId: user.id, courseId: courses[code], status: "completed" as const })));

    await db
      .insert(s.studentResearchInterests)
      .values(seed.fields.map((name) => ({ studentId: user.id, researchFieldId: fields[name] })));

    if (seed.experiences.length > 0) {
      await db.insert(s.researchExperiences).values(
        seed.experiences.map((exp, index) => ({
          studentId: user.id,
          organization: exp.organization,
          supervisor: exp.supervisor,
          title: exp.title,
          startDate: exp.startDate,
          endDate: exp.endDate,
          description: exp.description,
          techniques: exp.techniques,
          outputs: exp.outputs,
          sortOrder: index,
        })),
      );
    }

    studentIds[seed.email] = user.id;
  }

  const opportunitySeeds = [
    {
      key: "cardio",
      researcher: "okonjoa@mcmaster.ca",
      title: "Undergraduate Research Assistant, Cardiovascular Outcomes",
      summary:
        "Analyze retrospective clinical data to understand factors associated with cardiovascular readmission.",
      description:
        "Our group works with a de-identified extract of hospital admission records covering roughly eleven thousand cardiovascular admissions. We are trying to understand which factors recorded at discharge are associated with readmission within ninety days, and how much of the variation is explained by things that are already in the chart.\n\nThe honest answer is that most of the work is data preparation. Fields are recorded inconsistently across sites, dates need reconciling, and a large part of any finding depends on decisions made while cleaning. A student who takes that seriously learns more than one who jumps straight to modelling.",
      responsibilities:
        "Read and summarize a small set of assigned papers.\nClean and reconcile variables in the admissions extract.\nProduce descriptive summaries and figures for group review.\nDocument every cleaning decision in a shared methods log.\nAttend the weekly lab meeting and present once per term.",
      projectGoals:
        "Produce a defensible descriptive analysis of ninety-day readmission that the group can build a modelling paper on.",
      techniques: "Data cleaning in Python or R, descriptive statistics, data visualization, methods documentation.",
      expectedOutputs: "A cleaned analysis dataset, a methods log, and a set of figures used in a group manuscript.",
      learningOpportunities:
        "You will learn how clinical data is actually recorded, how to reason about missingness, and how to write methods that someone else can follow.",
      department: "Health Research Methods, Evidence, and Impact",
      labName: "Cardiovascular Outcomes Group",
      openings: 2,
      locationMode: "hybrid" as const,
      location: "Hamilton, Ontario",
      startDays: 30,
      duration: "One academic term, extendable",
      hoursMin: 6,
      hoursMax: 10,
      deadlineDays: 42,
      compensationType: "academic_credit" as const,
      compensationDetails:
        "Academic credit or volunteer, depending on the arrangement you make with your program. Paid summer positions may follow but are not guaranteed.",
      credit: true,
      beginnerFriendly: true,
      priorRequired: false,
      fields: ["Cardiology", "Epidemiology", "Public Health"],
      skills: [["Python", "preferred"], ["R", "preferred"], ["Statistics", "preferred"], ["Data analysis", "preferred"], ["Literature reviews", "preferred"]],
      criteria: [
        {
          type: "availability" as const,
          label: "Availability of at least 6 hours per week",
          description: "Sessions are scheduled around the weekly lab meeting on Wednesday afternoons.",
          required: true,
          importance: "required" as const,
          config: { minHoursPerWeek: 6 },
        },
        {
          type: "skill" as const,
          label: "Python or R",
          description: "Enough to read a script someone else wrote and modify it without breaking things.",
          required: false,
          importance: "high" as const,
          config: { skillSlug: "python", skillName: "Python" },
        },
        {
          type: "coursework" as const,
          label: "Introductory statistics",
          description: "STATS 2B03 or an equivalent course from another program.",
          required: false,
          importance: "medium" as const,
          config: { courseCodes: ["STATS 2B03", "STATS 3Y03"] },
        },
        {
          type: "research_interest" as const,
          label: "Interest in epidemiology or clinical outcomes",
          description: null,
          required: false,
          importance: "medium" as const,
          config: { fieldSlugs: ["epidemiology", "cardiology", "public-health"] },
        },
        {
          type: "prior_research" as const,
          label: "Prior research experience",
          description: "Not required. This project is suitable for a first research position.",
          required: false,
          importance: "low" as const,
          config: { minExperiences: 1 },
        },
        {
          type: "written_response" as const,
          label: "Understanding of the attached paper",
          description: "Does the response engage with the actual limitations of the study rather than general praise?",
          required: false,
          importance: "high" as const,
          config: {},
        },
      ],
      questions: [
        {
          type: "long_text" as const,
          prompt: "What interests you about clinical outcomes research?",
          helpText: "Two or three paragraphs is plenty. We are more interested in specifics than enthusiasm.",
          required: true,
          config: { maxLength: 2500 },
        },
        {
          type: "paper_response" as const,
          prompt:
            "After reviewing the attached article, identify one limitation and describe a follow-up question you would be interested in studying.",
          helpText: "There is no correct answer. We want to see how you read a paper.",
          required: true,
          config: { maxLength: 3000 },
        },
        {
          type: "numeric" as const,
          prompt: "How many hours per week can you commit this term?",
          helpText: null,
          required: true,
          config: { min: 1, max: 40 },
        },
      ],
      materials: [
        {
          type: "publication" as const,
          title: "Discharge documentation quality and ninety-day readmission after cardiovascular admission",
          authors: "Okonjo A, Whitfield T, Ramanathan S",
          url: "https://example.org/cardiovascular-readmission-documentation",
          doi: "10.0000/example.cardio.2025.114",
          abstract:
            "A retrospective cohort study of cardiovascular admissions across four regional hospitals, examining whether the completeness of discharge documentation is associated with readmission within ninety days. The study reports a modest association that is sensitive to how incomplete records are handled.",
          context:
            "This is the paper the current project builds on. Pay particular attention to how the authors handled missing fields in section three.",
        },
      ],
      status: "published" as const,
    },
    {
      key: "neuro",
      researcher: "haldenr@mcmaster.ca",
      title: "Neuroimaging Research Assistant, Adolescent Attention Networks",
      summary:
        "Support preprocessing and quality control for a structural and functional imaging study of adolescent attention.",
      description:
        "We are collecting imaging and behavioural data from adolescents aged twelve to seventeen to study how attention networks reorganize during this period. The dataset is growing and quality control has become the bottleneck.\n\nA student joining now would spend most of their time on preprocessing pipelines and visual quality checks, which is unglamorous and genuinely important. Motion artefacts in this age group are a real problem, and a careful reviewer changes what the study can claim.",
      responsibilities:
        "Run preprocessing pipelines on newly collected scans.\nPerform visual quality control and flag artefacts.\nMaintain the scan tracking spreadsheet.\nAssist with participant sessions when scheduling allows.\nAttend lab meeting on Monday mornings.",
      projectGoals: "Bring the full imaging dataset through a consistent, documented quality control process.",
      techniques: "Command line tools, MATLAB or Python, structural and functional preprocessing, artefact review.",
      expectedOutputs: "A quality-controlled imaging dataset and a written QC protocol.",
      learningOpportunities: "Hands-on experience with a real imaging pipeline and the judgment calls behind it.",
      department: "Department of Psychiatry and Behavioural Neurosciences",
      labName: "Developmental Neuroimaging Lab",
      openings: 1,
      locationMode: "in_person" as const,
      location: "Hamilton, Ontario",
      startDays: 21,
      duration: "Eight months",
      hoursMin: 8,
      hoursMax: 12,
      deadlineDays: 24,
      compensationType: "paid" as const,
      compensationDetails: "Paid hourly at the university research assistant rate. Hours are logged monthly.",
      credit: false,
      beginnerFriendly: false,
      priorRequired: false,
      fields: ["Neuroscience", "Psychology"],
      skills: [["MATLAB", "preferred"], ["Python", "preferred"], ["Neuroimaging analysis", "preferred"], ["Statistics", "preferred"]],
      criteria: [
        {
          type: "availability" as const,
          label: "Availability of at least 8 hours per week",
          description: "Scan sessions run on weekday afternoons.",
          required: true,
          importance: "required" as const,
          config: { minHoursPerWeek: 8 },
        },
        {
          type: "availability" as const,
          label: "Able to work in person in Hamilton",
          description: "Quality control is done on lab workstations.",
          required: true,
          importance: "required" as const,
          config: { locationModes: ["in_person", "hybrid"] },
        },
        {
          type: "year_level" as const,
          label: "Second year or above",
          description: null,
          required: false,
          importance: "medium" as const,
          config: { minYear: 2 },
        },
        {
          type: "skill" as const,
          label: "MATLAB or Python",
          description: "You will be running and occasionally editing pipeline scripts.",
          required: false,
          importance: "high" as const,
          config: { skillSlug: "matlab", skillName: "MATLAB" },
        },
        {
          type: "technique" as const,
          label: "Experience with imaging or signal data",
          description: "Any exposure to structured scientific data counts, described in your own words.",
          required: false,
          importance: "medium" as const,
          config: { keywords: ["imaging", "MRI", "EEG", "signal processing", "preprocessing"] },
        },
      ],
      questions: [
        {
          type: "long_text" as const,
          prompt: "Describe a time you worked carefully with data that other people relied on.",
          helpText: "Coursework, a job, or a volunteer role all count.",
          required: true,
          config: { maxLength: 2000 },
        },
        {
          type: "yes_no" as const,
          prompt: "Are you able to attend Monday morning lab meetings in person?",
          helpText: null,
          required: true,
          config: {},
        },
      ],
      materials: [],
      status: "published" as const,
    },
    {
      key: "cancer",
      researcher: "tanjiro.sano@mcmaster.ca",
      title: "Cancer Cell Biology Laboratory Assistant",
      summary: "Support cell culture and protein work in a tumour microenvironment lab.",
      description:
        "We study how stromal cells alter the response of tumour cells to standard chemotherapy agents. The immediate project involves co-culture experiments and protein expression work.\n\nThis is a bench position. You will be in the lab, on your feet, following protocols precisely, and repeating things that did not work the first time. Students who enjoy that tend to stay for several terms.",
      responsibilities:
        "Maintain cell lines and keep the culture log current.\nRun Western blots under supervision.\nPrepare reagents and buffers.\nRecord results in the shared lab notebook the same day.\nAttend Friday data meetings.",
      projectGoals: "Characterize protein-level changes in tumour cells co-cultured with stromal fibroblasts.",
      techniques: "Sterile technique, mammalian cell culture, SDS-PAGE and Western blotting, basic microscopy.",
      expectedOutputs: "Reproducible blot data contributing to a figure in a manuscript in preparation.",
      learningOpportunities: "Proper sterile technique, protein methods, and how to keep a notebook someone else can read.",
      department: "Department of Biochemistry and Biomedical Sciences",
      labName: "Tumour Microenvironment Lab",
      openings: 1,
      locationMode: "in_person" as const,
      location: "Hamilton, Ontario",
      startDays: 45,
      duration: "Two terms minimum",
      hoursMin: 10,
      hoursMax: 14,
      deadlineDays: 33,
      compensationType: "volunteer" as const,
      compensationDetails:
        "Volunteer for the first term. Students who continue are usually supported through a summer studentship application.",
      credit: true,
      beginnerFriendly: false,
      priorRequired: false,
      fields: ["Oncology", "Immunology"],
      skills: [["Cell culture", "required"], ["Wet lab", "required"], ["Western blot", "preferred"], ["Microscopy", "preferred"], ["PCR", "not_required"]],
      criteria: [
        {
          type: "skill" as const,
          label: "Cell culture",
          description: "Sterile technique in a mammalian culture setting.",
          required: true,
          importance: "required" as const,
          config: { skillSlug: "cell-culture", skillName: "Cell culture" },
        },
        {
          type: "availability" as const,
          label: "Availability of at least 10 hours per week",
          description: "Cells need attention on a fixed schedule, including some weekends.",
          required: true,
          importance: "required" as const,
          config: { minHoursPerWeek: 10 },
        },
        {
          type: "coursework" as const,
          label: "Cell biology or biochemistry coursework",
          description: "BIOLOGY 2B03 or BIOCHEM 2EE3 or equivalent.",
          required: false,
          importance: "high" as const,
          config: { courseCodes: ["BIOLOGY 2B03", "BIOCHEM 2EE3"] },
        },
        {
          type: "skill" as const,
          label: "Western blot",
          description: null,
          required: false,
          importance: "medium" as const,
          config: { skillSlug: "western-blot", skillName: "Western blot" },
        },
        {
          type: "prior_research" as const,
          label: "Prior laboratory experience",
          description: "Teaching labs count.",
          required: false,
          importance: "medium" as const,
          config: { minExperiences: 1 },
        },
      ],
      questions: [
        {
          type: "long_text" as const,
          prompt: "Describe your experience with sterile technique and what you find hardest about it.",
          helpText: null,
          required: true,
          config: { maxLength: 1800 },
        },
        {
          type: "short_text" as const,
          prompt: "Which terms are you available to commit to?",
          helpText: null,
          required: true,
          config: { maxLength: 200 },
        },
      ],
      materials: [],
      status: "published" as const,
    },
    {
      key: "rehab",
      researcher: "delacruzm@mcmaster.ca",
      title: "Rehabilitation Science Data Collection Assistant",
      summary: "Help run mobility assessment sessions with older adults in a community exercise study.",
      description:
        "We are evaluating whether a twelve-week community exercise program improves functional mobility for adults over sixty-five. Sessions happen at two community centres in Hamilton.\n\nThe role is mostly in-person data collection: greeting participants, running standardized mobility tests, and entering results the same day. It suits a student who is comfortable talking to people and patient with paperwork.",
      responsibilities:
        "Greet and consent participants at assessment sessions.\nAdminister standardized mobility tests using a script.\nEnter results into REDCap on the day of collection.\nConfirm upcoming appointments by phone.\nFlag any protocol deviations to the study coordinator.",
      projectGoals: "Complete baseline and twelve-week assessments for one hundred and twenty participants.",
      techniques: "Standardized mobility assessment, participant communication, REDCap data entry.",
      expectedOutputs: "A complete assessment dataset and a co-authored conference abstract for students who stay the full study.",
      learningOpportunities: "Direct participant contact, research ethics in practice, and clinical data collection standards.",
      department: "School of Rehabilitation Science",
      labName: "Mobility and Aging Lab",
      openings: 3,
      locationMode: "in_person" as const,
      location: "Hamilton, Ontario",
      startDays: 14,
      duration: "Twelve weeks",
      hoursMin: 5,
      hoursMax: 8,
      deadlineDays: 12,
      compensationType: "work_study" as const,
      compensationDetails: "Work study funded. You must be eligible for the McMaster work study program.",
      credit: false,
      beginnerFriendly: true,
      priorRequired: false,
      fields: ["Rehabilitation Science", "Kinesiology", "Public Health"],
      skills: [["Patient recruitment", "preferred"], ["REDCap", "preferred"], ["Presentation", "preferred"]],
      criteria: [
        {
          type: "availability" as const,
          label: "Availability of at least 5 hours per week",
          description: "Sessions run Tuesday and Thursday mornings.",
          required: true,
          importance: "required" as const,
          config: { minHoursPerWeek: 5 },
        },
        {
          type: "availability" as const,
          label: "Able to travel to community centres in Hamilton",
          description: null,
          required: true,
          importance: "required" as const,
          config: { locationModes: ["in_person"] },
        },
        {
          type: "research_interest" as const,
          label: "Interest in rehabilitation or aging",
          description: null,
          required: false,
          importance: "medium" as const,
          config: { fieldSlugs: ["rehabilitation-science", "kinesiology"] },
        },
        {
          type: "custom" as const,
          label: "Comfort working with older adults",
          description: "Any setting counts: volunteering, caregiving, a part-time job, or a placement.",
          required: false,
          importance: "high" as const,
          config: {},
        },
      ],
      questions: [
        {
          type: "long_text" as const,
          prompt: "Tell us about a time you worked directly with older adults.",
          helpText: "If you have not, say so and tell us why this study interests you.",
          required: true,
          config: { maxLength: 1500 },
        },
        {
          type: "multiple_choice" as const,
          prompt: "Which sessions can you attend?",
          helpText: null,
          required: true,
          config: { options: ["Tuesday mornings", "Thursday mornings", "Both"] },
        },
      ],
      materials: [],
      status: "published" as const,
    },
    {
      key: "microbiome",
      researcher: "n.abubakar@mcmaster.ca",
      title: "Microbiome Literature Review Assistant",
      summary: "Help build and screen a literature corpus on diet-associated shifts in gut microbial communities.",
      description:
        "I am writing the final chapter of my thesis, a narrative review of how dietary interventions change short-chain fatty acid production in the gut. The search has returned around nine hundred records and I need help screening them consistently.\n\nThis is a good first research position. It is entirely remote, the work is well defined, and you will finish it knowing how a literature review is actually assembled.",
      responsibilities:
        "Screen titles and abstracts against a written inclusion protocol.\nRecord screening decisions and reasons in a shared sheet.\nExtract study characteristics from included papers.\nMeet weekly over video to resolve disagreements.",
      projectGoals: "A screened and extracted corpus supporting a thesis chapter and a subsequent review manuscript.",
      techniques: "Systematic screening, reference management, structured data extraction.",
      expectedOutputs: "A screening log, an extraction table, and acknowledgement or co-authorship depending on contribution.",
      learningOpportunities: "How inclusion criteria are written, why they get revised, and how disagreement is resolved.",
      department: "Department of Biology",
      labName: "Gut Microbiome Group",
      openings: 2,
      locationMode: "remote" as const,
      location: "Remote",
      startDays: 10,
      duration: "One term",
      hoursMin: 4,
      hoursMax: 8,
      deadlineDays: 18,
      compensationType: "unpaid" as const,
      compensationDetails: "Unpaid. Acknowledgement in the resulting chapter, and co-authorship on the review for substantial contribution.",
      credit: false,
      beginnerFriendly: true,
      priorRequired: false,
      fields: ["Microbiology", "Nutrition", "Bioinformatics"],
      skills: [["Literature reviews", "preferred"], ["Systematic reviews", "preferred"], ["Scientific writing", "preferred"]],
      criteria: [
        {
          type: "availability" as const,
          label: "Availability of at least 4 hours per week",
          description: null,
          required: true,
          importance: "required" as const,
          config: { minHoursPerWeek: 4 },
        },
        {
          type: "skill" as const,
          label: "Literature reviews",
          description: "Any structured reading and summarizing experience.",
          required: false,
          importance: "high" as const,
          config: { skillSlug: "literature-reviews", skillName: "Literature reviews" },
        },
        {
          type: "research_interest" as const,
          label: "Interest in microbiology or nutrition",
          description: null,
          required: false,
          importance: "medium" as const,
          config: { fieldSlugs: ["microbiology", "nutrition"] },
        },
        {
          type: "written_response" as const,
          label: "Clarity of written communication",
          description: "Screening depends on writing down why a decision was made.",
          required: false,
          importance: "high" as const,
          config: {},
        },
      ],
      questions: [
        {
          type: "long_text" as const,
          prompt: "Summarize a paper or article you read recently in one paragraph.",
          helpText: "It does not have to be about the microbiome. We want to see how you condense something.",
          required: true,
          config: { maxLength: 1500 },
        },
      ],
      materials: [
        {
          type: "preprint" as const,
          title: "Short-chain fatty acid production across dietary fibre interventions: a scoping review protocol",
          authors: "Abubakar N, Nakamura T",
          url: "https://example.org/scfa-scoping-protocol",
          doi: null,
          abstract:
            "A protocol describing the search strategy, inclusion criteria, and extraction fields for a scoping review of dietary fibre interventions and short-chain fatty acid outcomes in adult populations.",
          context: "Read the inclusion criteria in section two. That is what you would be applying.",
        },
      ],
      status: "published" as const,
    },
    {
      key: "chart",
      researcher: "okonjoa@mcmaster.ca",
      title: "Clinical Chart Review Project Assistant",
      summary: "Extract structured variables from de-identified clinical charts for an outcomes study.",
      description:
        "A companion project to our readmission work. We need a defined set of variables extracted from de-identified charts where the structured extract is incomplete.\n\nThis role is careful, repetitive, and matters enormously. Every variable you extract is one someone will later build an analysis on.",
      responsibilities:
        "Extract a defined variable set from de-identified charts.\nApply the extraction protocol consistently and flag ambiguous cases.\nComplete the required research ethics training before starting.\nMeet twice monthly to review flagged cases.",
      projectGoals: "Complete extraction for eight hundred charts with double extraction on a ten percent sample.",
      techniques: "Chart review, structured extraction, REDCap.",
      expectedOutputs: "A complete extraction dataset with an inter-rater agreement estimate.",
      learningOpportunities: "How clinical documentation varies in practice and why agreement statistics exist.",
      department: "Health Research Methods, Evidence, and Impact",
      labName: "Cardiovascular Outcomes Group",
      openings: 2,
      locationMode: "hybrid" as const,
      location: "Hamilton, Ontario",
      startDays: 25,
      duration: "Two terms",
      hoursMin: 5,
      hoursMax: 9,
      deadlineDays: 38,
      compensationType: "paid" as const,
      compensationDetails: "Paid hourly. Funded through an operating grant.",
      credit: false,
      beginnerFriendly: true,
      priorRequired: false,
      fields: ["Epidemiology", "Clinical Trials", "Public Health"],
      skills: [["Chart review", "preferred"], ["REDCap", "preferred"], ["Data analysis", "preferred"]],
      criteria: [
        {
          type: "availability" as const,
          label: "Availability of at least 5 hours per week",
          description: null,
          required: true,
          importance: "required" as const,
          config: { minHoursPerWeek: 5 },
        },
        {
          type: "custom" as const,
          label: "Willing to complete research ethics training before starting",
          description: "The training is free and takes about three hours.",
          required: true,
          importance: "required" as const,
          config: {},
        },
        {
          type: "skill" as const,
          label: "REDCap",
          description: null,
          required: false,
          importance: "low" as const,
          config: { skillSlug: "redcap", skillName: "REDCap" },
        },
        {
          type: "program" as const,
          label: "Health sciences, nursing, or life sciences program",
          description: null,
          required: false,
          importance: "medium" as const,
          config: { programs: ["Health Sciences", "Nursing", "Biology", "Biochemistry", "Kinesiology"] },
        },
      ],
      questions: [
        {
          type: "yes_no" as const,
          prompt: "Are you willing to complete research ethics training before your first shift?",
          helpText: null,
          required: true,
          config: {},
        },
        {
          type: "short_text" as const,
          prompt: "Describe your attention to detail in one or two sentences.",
          helpText: null,
          required: true,
          config: { maxLength: 400 },
        },
      ],
      materials: [],
      status: "published" as const,
    },
    {
      key: "bioinf",
      researcher: "n.abubakar@mcmaster.ca",
      title: "Bioinformatics Research Assistant, Metagenomic Pipelines",
      summary: "Benchmark and document metagenomic classification pipelines on an existing sample set.",
      description:
        "We have paired sequencing data from a dietary intervention and inconsistent classification results between two tools. The project is to benchmark them properly and document the differences so the group can choose one with reasons.\n\nThis position expects real comfort on the command line. It is not a good first research position, and that is stated plainly rather than discovered after you apply.",
      responsibilities:
        "Run two classification pipelines across the sample set.\nCompare outputs and quantify disagreement.\nWrite reproducible scripts with a README someone else can follow.\nPresent findings at a group meeting.",
      projectGoals: "A written benchmark the group can cite when choosing a classification approach.",
      techniques: "Shell scripting, Python or R, metagenomic classification tools, reproducible analysis.",
      expectedOutputs: "A benchmark report and a versioned analysis repository.",
      learningOpportunities: "Reproducibility practice and how tool choice quietly shapes microbiome results.",
      department: "Department of Biology",
      labName: "Gut Microbiome Group",
      openings: 1,
      locationMode: "remote" as const,
      location: "Remote",
      startDays: 20,
      duration: "One term",
      hoursMin: 10,
      hoursMax: 15,
      deadlineDays: 28,
      compensationType: "grant_funded" as const,
      compensationDetails: "Funded through a discovery grant at the standard undergraduate research rate.",
      credit: false,
      beginnerFriendly: false,
      priorRequired: true,
      fields: ["Bioinformatics", "Microbiology", "Genetics"],
      skills: [["Python", "required"], ["Bioinformatics", "required"], ["R", "preferred"], ["Data visualization", "preferred"]],
      criteria: [
        {
          type: "skill" as const,
          label: "Python",
          description: "You will be writing scripts, not only running them.",
          required: true,
          importance: "required" as const,
          config: { skillSlug: "python", skillName: "Python" },
        },
        {
          type: "prior_research" as const,
          label: "Prior computational project experience",
          description: "Coursework projects count if you can describe them.",
          required: true,
          importance: "required" as const,
          config: { minExperiences: 1 },
        },
        {
          type: "availability" as const,
          label: "Availability of at least 10 hours per week",
          description: null,
          required: true,
          importance: "required" as const,
          config: { minHoursPerWeek: 10 },
        },
        {
          type: "skill" as const,
          label: "Bioinformatics",
          description: null,
          required: false,
          importance: "high" as const,
          config: { skillSlug: "bioinformatics", skillName: "Bioinformatics" },
        },
        {
          type: "technique" as const,
          label: "Experience with reproducible analysis",
          description: "Version control, environments, or documented pipelines.",
          required: false,
          importance: "medium" as const,
          config: { keywords: ["git", "docker", "conda", "pipeline", "reproducible"] },
        },
      ],
      questions: [
        {
          type: "long_text" as const,
          prompt: "Describe a computational project you built and one thing you would do differently.",
          helpText: null,
          required: true,
          config: { maxLength: 2500 },
        },
        {
          type: "short_text" as const,
          prompt: "Link to a repository or portfolio, if you have one.",
          helpText: "Optional. Leave blank if not applicable.",
          required: false,
          config: { maxLength: 300 },
        },
      ],
      materials: [],
      status: "published" as const,
    },
    {
      key: "publichealth",
      researcher: "delacruzm@mcmaster.ca",
      title: "Systematic Review Assistant, Community Health Programs",
      summary: "Screen and extract studies for a systematic review of community-based health programs.",
      description:
        "A systematic review examining whether community-based health programs improve functional outcomes for adults over sixty-five. The protocol is registered and the search has been run.\n\nWe need two students to screen independently so that agreement can be measured properly.",
      responsibilities:
        "Screen titles and abstracts independently against the protocol.\nResolve disagreements at weekly meetings.\nExtract data from included studies into the agreed form.\nAssist with risk of bias assessment under supervision.",
      projectGoals: "A completed screening and extraction stage ready for synthesis.",
      techniques: "Systematic review methods, dual independent screening, risk of bias assessment.",
      expectedOutputs: "Screening records, an extraction table, and co-authorship for students who complete the stage.",
      learningOpportunities: "Formal systematic review methodology from someone who has published several.",
      department: "School of Rehabilitation Science",
      labName: "Mobility and Aging Lab",
      openings: 2,
      locationMode: "hybrid" as const,
      location: "Hamilton, Ontario",
      startDays: 18,
      duration: "One to two terms",
      hoursMin: 6,
      hoursMax: 10,
      deadlineDays: 30,
      compensationType: "thesis" as const,
      compensationDetails: "Suitable as a thesis or independent study project. Volunteer arrangements also possible.",
      credit: true,
      beginnerFriendly: true,
      priorRequired: false,
      fields: ["Public Health", "Rehabilitation Science", "Epidemiology"],
      skills: [["Systematic reviews", "preferred"], ["Literature reviews", "preferred"], ["Scientific writing", "preferred"], ["Statistics", "preferred"]],
      criteria: [
        {
          type: "availability" as const,
          label: "Availability of at least 6 hours per week",
          description: null,
          required: true,
          importance: "required" as const,
          config: { minHoursPerWeek: 6 },
        },
        {
          type: "skill" as const,
          label: "Systematic or literature reviews",
          description: null,
          required: false,
          importance: "high" as const,
          config: { skillSlug: "systematic-reviews", skillName: "Systematic reviews" },
        },
        {
          type: "coursework" as const,
          label: "Research methods coursework",
          description: null,
          required: false,
          importance: "medium" as const,
          config: { courseCodes: ["HTHSCI 2G03", "HTHSCI 3H03", "PSYCH 2H03"] },
        },
        {
          type: "written_response" as const,
          label: "Ability to apply criteria consistently",
          description: null,
          required: false,
          importance: "medium" as const,
          config: {},
        },
      ],
      questions: [
        {
          type: "long_text" as const,
          prompt: "Given an inclusion criterion of adults aged 65 and over, how would you handle a study with a mean age of 67 but a range starting at 58?",
          helpText: "There is no single right answer. We want to see your reasoning.",
          required: true,
          config: { maxLength: 1500 },
        },
      ],
      materials: [],
      status: "published" as const,
    },
    {
      key: "draftgenomics",
      researcher: "okonjoa@mcmaster.ca",
      title: "Summer Research Student, Health Data Visualization",
      summary: "Build a small internal dashboard summarizing study recruitment and data completeness.",
      description:
        "A short summer project to replace a fragile spreadsheet with something the group can actually rely on for recruitment tracking.",
      responsibilities: "Scope requirements with the study coordinator.\nBuild and document a small dashboard.\nHand it over with written instructions.",
      projectGoals: "A maintained internal recruitment dashboard.",
      techniques: "Python or R, data visualization, requirements gathering.",
      expectedOutputs: "A working dashboard and handover documentation.",
      learningOpportunities: "Building something researchers will use daily, and learning what they actually need.",
      department: "Health Research Methods, Evidence, and Impact",
      labName: "Cardiovascular Outcomes Group",
      openings: 1,
      locationMode: "hybrid" as const,
      location: "Hamilton, Ontario",
      startDays: 180,
      duration: "Sixteen weeks over the summer",
      hoursMin: 20,
      hoursMax: 35,
      deadlineDays: 120,
      compensationType: "paid" as const,
      compensationDetails: "Paid summer studentship, contingent on funding confirmation.",
      credit: false,
      beginnerFriendly: true,
      priorRequired: false,
      fields: ["Epidemiology", "Public Health"],
      skills: [["Python", "preferred"], ["Data visualization", "preferred"], ["SQL", "preferred"]],
      criteria: [
        {
          type: "skill" as const,
          label: "Python or R",
          description: null,
          required: false,
          importance: "high" as const,
          config: { skillSlug: "python", skillName: "Python" },
        },
      ],
      questions: [
        {
          type: "short_text" as const,
          prompt: "What is one dashboard or tool you have used that was badly designed, and why?",
          helpText: null,
          required: true,
          config: { maxLength: 500 },
        },
      ],
      materials: [],
      status: "draft" as const,
    },
  ];

  const opportunityIds: Ids = {};
  const questionIds: Record<string, string[]> = {};

  for (const seed of opportunitySeeds) {
    const published = seed.status === "published";
    const [opportunity] = await db
      .insert(s.opportunities)
      .values({
        institutionId: mcmaster.id,
        researcherId: researcherIds[seed.researcher],
        title: seed.title,
        slug: `${slugify(seed.title)}-${seed.key}`,
        summary: seed.summary,
        description: seed.description,
        responsibilities: seed.responsibilities,
        projectGoals: seed.projectGoals,
        techniques: seed.techniques,
        expectedOutputs: seed.expectedOutputs,
        learningOpportunities: seed.learningOpportunities,
        department: seed.department,
        labName: seed.labName,
        status: seed.status,
        numberOfOpenings: seed.openings,
        locationMode: seed.locationMode,
        location: seed.location,
        startDate: isoDate(seed.startDays),
        duration: seed.duration,
        hoursPerWeekMin: seed.hoursMin,
        hoursPerWeekMax: seed.hoursMax,
        deadline: isoDate(seed.deadlineDays),
        compensationType: seed.compensationType,
        compensationDetails: seed.compensationDetails,
        academicCreditAvailable: seed.credit,
        beginnerFriendly: seed.beginnerFriendly,
        priorResearchRequired: seed.priorRequired,
        viewCount: published ? 40 + Math.floor(seed.title.length * 3) : 0,
        draftStep: 9,
        publishedAt: published ? new Date(now.getTime() - 30 * 86400000) : null,
      })
      .returning();

    opportunityIds[seed.key] = opportunity.id;

    await db
      .insert(s.opportunityFields)
      .values(seed.fields.map((name) => ({ opportunityId: opportunity.id, researchFieldId: fields[name] })));

    await db.insert(s.opportunitySkills).values(
      seed.skills.map(([name, level]) => ({
        opportunityId: opportunity.id,
        skillId: skills[name],
        requirementLevel: level as "required" | "preferred" | "not_required",
      })),
    );

    await db.insert(s.opportunityCriteria).values(
      seed.criteria.map((criterion, index) => ({
        opportunityId: opportunity.id,
        type: criterion.type,
        label: criterion.label,
        description: criterion.description,
        required: criterion.required,
        importance: criterion.importance,
        config: criterion.config,
        sortOrder: index,
      })),
    );

    const insertedQuestions = await db
      .insert(s.opportunityQuestions)
      .values(
        seed.questions.map((question, index) => ({
          opportunityId: opportunity.id,
          type: question.type,
          prompt: question.prompt,
          helpText: question.helpText,
          required: question.required,
          config: question.config,
          sortOrder: index,
        })),
      )
      .returning();
    questionIds[seed.key] = insertedQuestions.map((row) => row.id);

    if (seed.materials.length > 0) {
      await db.insert(s.opportunityResearchMaterials).values(
        seed.materials.map((material, index) => ({
          opportunityId: opportunity.id,
          type: material.type,
          title: material.title,
          authors: material.authors,
          url: material.url,
          doi: material.doi,
          abstract: material.abstract,
          context: material.context,
          sortOrder: index,
        })),
      );
    }

    if (published) {
      await db.insert(s.analyticsEvents).values({
        name: "opportunity_published",
        userId: researcherIds[seed.researcher],
        institutionId: mcmaster.id,
        subjectType: "opportunity",
        subjectId: opportunity.id,
      });
    }
  }

  const applicationSeeds = [
    {
      opportunity: "cardio",
      student: "adeyemij@mcmaster.ca",
      status: "under_review" as const,
      daysAgo: 5,
      answers: [
        "I keep coming back to the same question from a first-year seminar: two patients leave hospital with the same diagnosis and the same medications, and one is readmitted within a month while the other is not. Most of the explanations I have read point at things that are already written down somewhere in the chart, which makes it feel tractable rather than mysterious.\n\nLast year I spent two terms merging longitudinal spreadsheets for a reading group, which is where I learned that the interesting part is not the analysis. Half of our disagreements were about whether a blank cell meant a test was not done or the result was not entered. I would like to work somewhere that treats that decision as part of the research rather than a nuisance.",
        "The limitation I would pick is the handling of incomplete discharge records in section three. Records missing more than two documentation fields were excluded, which is described as a conservative choice, but exclusion is only conservative if the missingness is unrelated to the outcome. If busier units document less thoroughly and also discharge sicker patients faster, then the excluded records are not a random subset and the association would be understated.\n\nThe follow-up I would want to study is whether documentation completeness varies systematically by unit and time of day, and then whether the reported association survives a sensitivity analysis that imputes rather than excludes. That would tell you whether the finding is about documentation or about the units doing the documenting.",
        "10",
      ],
    },
    {
      opportunity: "cardio",
      student: "obrienk@mcmaster.ca",
      status: "submitted" as const,
      daysAgo: 2,
      answers: [
        "I am in first year, so I want to be straightforward that I have not done research before. What draws me to clinical outcomes work is that it sits between medicine and policy. I read a piece last term about readmission penalties in the United States and how hospitals serving poorer populations were penalized most, and it changed how I thought about what an outcome measure actually measures.\n\nI am comfortable saying I would be starting from nothing technically. I have finished HTHSCI 2G03 and I am taking statistics next term. What I can offer now is that I read carefully and I write things down.",
        "The limitation that stood out to me is that the study only looks at four hospitals in one region. The authors say this in the discussion, but I think it matters more than one sentence suggests, because documentation habits are probably shaped by local training and by whatever electronic system a hospital uses.\n\nA follow-up question I would find interesting is whether the same association appears in hospitals using a different records system entirely. If it does not, then what the study found might be about the software rather than about discharge care.",
        "6",
      ],
    },
    {
      opportunity: "cardio",
      student: "npatel@mcmaster.ca",
      status: "shortlisted" as const,
      daysAgo: 8,
      answers: [
        "I came at this from the computational side. At a health data hackathon last October my team normalized hospital admission records and produced readmission summaries in about thirty hours, and the thing I remember is how much of that time went into reconciling date formats and duplicate patient identifiers rather than anything algorithmic.\n\nWhat interests me about doing it properly is the part a hackathon cannot give you: the chance to ask a clinician why a field is empty and get a real answer. I would like to work on something where the cleaning decisions are documented and defended rather than made at two in the morning.",
        "Section three defines readmission using a ninety-day window anchored to the index discharge date, but transfers between the four sites appear to be counted as new admissions rather than as continuations of the same episode. If a patient is discharged from one site and admitted to another the following week for the same problem, that looks like a readmission in the data and like continuous care in reality. Given the sites are in one region, this could be common.\n\nThe follow-up I would want is to link admissions across sites by patient and collapse episodes that fall within a short window, then rerun the primary analysis. If the association weakens substantially, the original estimate is partly measuring regional referral patterns.",
        "15",
      ],
    },
    {
      opportunity: "neuro",
      student: "s.mwangi@mcmaster.ca",
      status: "researcher_contacted" as const,
      daysAgo: 11,
      answers: [
        "Last summer I ran behavioural sessions in the Perception and Action Laboratory and scored reaction time data in MATLAB. Six other people were going to use those scores, and about three weeks in I found that I had been applying an outlier rule inconsistently between two participant groups because the instructions were ambiguous.\n\nI flagged it, we agreed on a single rule, and I rescored everything from the start. It cost me a week. What I took from it is that the moment you notice something is wrong is the cheapest moment it will ever be to fix, and that saying so is much less uncomfortable than it feels beforehand.",
        "Yes",
      ],
    },
    {
      opportunity: "neuro",
      student: "npatel@mcmaster.ca",
      status: "declined" as const,
      daysAgo: 13,
      answers: [
        "I maintained a benchmark table for a genome assembly project that three other students used to pick their tools. I set it up so every row recorded the exact command, the software version, and the machine it ran on, because the first version of the table had numbers nobody could reproduce.",
        "No",
      ],
    },
    {
      opportunity: "cancer",
      student: "chenwei@mcmaster.ca",
      status: "shortlisted" as const,
      daysAgo: 6,
      answers: [
        "I have worked in the undergraduate teaching laboratory since January, maintaining the culture incubator log and preparing reagents for a third-year genetics course. Sterile technique itself is a small set of habits, and the habits are not the hard part.\n\nThe hard part is doing it identically when you are behind. My contamination events have all happened on days when I was rushing between the hood and something else, and the fix was not better technique but building in more time. I would rather say that plainly than claim I have never contaminated a plate.",
        "Fall and Winter, and I would like to continue through the following summer if the project continues.",
      ],
    },
    {
      opportunity: "cancer",
      student: "d.osei@mcmaster.ca",
      status: "submitted" as const,
      daysAgo: 3,
      answers: [
        "My only experience is in second-year biochemistry labs, where we worked in pairs under close supervision. I have not worked in a research lab and I do not want to overstate what I know.\n\nWhat I found hardest was keeping track of what had already been added to a tube when the protocol had several similar steps. I started writing each step off as I did it, which felt slow but stopped me repeating a step twice.",
        "Fall and Winter.",
      ],
    },
    {
      opportunity: "microbiome",
      student: "t.nakamura@mcmaster.ca",
      status: "accepted" as const,
      daysAgo: 20,
      answers: [
        "I read a review last month on fibre fermentation in adults with inflammatory bowel disease. It argued that most intervention studies measure faecal short-chain fatty acid concentration, but concentration reflects the balance between production and absorption rather than production alone, so two studies reporting different concentrations may not disagree about production at all.\n\nThe review's practical suggestion was that studies should report stool output alongside concentration so that a crude production estimate becomes possible. I found it useful because it reframed an apparent contradiction in the literature as a measurement problem rather than a biological one.",
      ],
    },
    {
      opportunity: "microbiome",
      student: "h.kowalski@mcmaster.ca",
      status: "under_review" as const,
      daysAgo: 4,
      answers: [
        "I recently read a methodological paper on grey literature searching in public health reviews. Its argument is that restricting to indexed databases systematically drops programme evaluations and government reports, which are exactly where community-level interventions get written up, and that this biases reviews towards academic settings.\n\nThe part I found most useful was the practical section: it gives a search order for grey sources and a way to record them so the search stays reproducible, which is usually the objection to including grey literature at all.",
      ],
    },
    {
      opportunity: "rehab",
      student: "l.rossi@mcmaster.ca",
      status: "submitted" as const,
      daysAgo: 1,
      answers: [
        "I coach a community running group on Saturday mornings and about a third of the members are over sixty-five. Something I did not expect is how much of the coaching is scheduling and reassurance rather than training. Several members stopped coming after a single missed week because they assumed they had fallen too far behind, and the fix was a phone call, not a programme change.\n\nI mention it because the assessment sessions in this study depend on people showing up twice, twelve weeks apart, and I think keeping them engaged between those visits is a real part of the job.",
        "Both",
      ],
    },
    {
      opportunity: "rehab",
      student: "gagnona@mcmaster.ca",
      status: "under_review" as const,
      daysAgo: 7,
      answers: [
        "On placement I work with older adults on a medical unit, mostly on assessments and discharge planning. The thing I keep noticing is the distance between what gets charted and what actually happened. A mobility note might say a patient ambulated with assistance, which covers everything from a steady walk down the corridor to two staff and a walker for four metres.\n\nI would like to work on a study where mobility is measured the same way every time, because I want to know how much of what I see in charts is real variation and how much is language.",
        "Tuesday mornings",
      ],
    },
    {
      opportunity: "publichealth",
      student: "h.kowalski@mcmaster.ca",
      status: "shortlisted" as const,
      daysAgo: 9,
      answers: [
        "I would include it, flag it, and record the reason, rather than deciding on my own. The criterion is about the population the evidence speaks to, and a mean of 67 with a range starting at 58 means most participants are in scope but the estimate is contaminated by people who are not.\n\nIn practice I would check whether the paper reports results stratified by age, because if it does the relevant stratum can be extracted and the problem disappears. If it does not, I would include it at full text, tag it as a partial population match, and raise it at the weekly meeting so the decision is made once and applied to every similar study rather than case by case. The thing that ruins agreement statistics is two screeners each making a reasonable judgment call in opposite directions.",
      ],
    },
    {
      opportunity: "bioinf",
      student: "npatel@mcmaster.ca",
      status: "submitted" as const,
      daysAgo: 2,
      answers: [
        "I benchmarked three short-read assemblers on bacterial isolates for a volunteer project this term. The output was a table of assembly statistics across a parameter sweep, plus notes on where each tool became sensitive to coverage.\n\nWhat I would do differently is fix the environment first. I started with whatever versions were on the cluster, and partway through a module update changed one tool's default k-mer selection. I lost about two weeks of runs because I could not tell which results predated the change. I have used a pinned environment file on everything since, and I now record the tool version in the output filename rather than in a separate log.",
        "https://example.org/npatel/assembly-benchmark",
      ],
    },
  ];

  for (const seed of applicationSeeds) {
    const opportunityId = opportunityIds[seed.opportunity];
    const studentId = studentIds[seed.student];
    const submittedAt = new Date(now.getTime() - seed.daysAgo * 86400000);

    const [application] = await db
      .insert(s.applications)
      .values({
        opportunityId,
        studentId,
        status: seed.status,
        submittedAt,
        reviewedAt: seed.status === "submitted" ? null : new Date(submittedAt.getTime() + 86400000),
        contactedAt: ["researcher_contacted", "interview", "accepted"].includes(seed.status)
          ? new Date(submittedAt.getTime() + 2 * 86400000)
          : null,
        createdAt: submittedAt,
        updatedAt: submittedAt,
      })
      .returning();

    const qids = questionIds[seed.opportunity];
    await db.insert(s.applicationAnswers).values(
      seed.answers.map((text, index) => ({
        applicationId: application.id,
        questionId: qids[index],
        textAnswer: text,
      })),
    );

    await db.insert(s.applicationSnapshots).values({
      applicationId: application.id,
      profile: { capturedFrom: "seed", studentEmail: seed.student },
      capturedAt: submittedAt,
    });

    await db.insert(s.applicationStatusHistory).values({
      applicationId: application.id,
      previousStatus: "draft",
      newStatus: "submitted",
      changedBy: studentId,
      createdAt: submittedAt,
    });

    if (seed.status !== "submitted") {
      await db.insert(s.applicationStatusHistory).values({
        applicationId: application.id,
        previousStatus: "submitted",
        newStatus: seed.status,
        changedBy: null,
        createdAt: new Date(submittedAt.getTime() + 86400000),
      });
    }

    await db.insert(s.analyticsEvents).values({
      name: "application_submitted",
      userId: studentId,
      institutionId: mcmaster.id,
      subjectType: "application",
      subjectId: application.id,
      createdAt: submittedAt,
    });

    const criteriaRows = await db
      .select()
      .from(s.opportunityCriteria)
      .where(eq(s.opportunityCriteria.opportunityId, opportunityId));

    const criteria: Criterion[] = criteriaRows.map((row) => ({
      id: row.id,
      type: row.type,
      label: row.label,
      description: row.description,
      required: row.required,
      importance: row.importance,
      config: row.config,
      sortOrder: row.sortOrder,
    }));

    const profileBundle = await loadStudentProfile(studentId);
    if (profileBundle) {
      const answerPayload = qids.map((questionId, index) => ({
        questionId,
        prompt: "",
        text: seed.answers[index] ?? null,
      }));
      const evidence = toApplicantEvidence(profileBundle, answerPayload);
      await persistCriterionResults(application.id, evaluateDeterministic(criteria, evidence));
    }

    if (seed.status === "accepted") {
      await db.insert(s.placementOutcomes).values({
        applicationId: application.id,
        studentReportedOutcome: "yes",
        researcherReportedOutcome: "yes",
        confirmed: true,
        startDate: isoDate(-5),
        positionType: "unpaid",
        studentWouldUseAgain: true,
        researcherWouldUseAgain: true,
      });
      await db.insert(s.analyticsEvents).values({
        name: "placement_confirmed",
        userId: studentId,
        institutionId: mcmaster.id,
        subjectType: "application",
        subjectId: application.id,
      });
    }
  }

  await db.insert(s.researcherApplicationNotes).values([
    {
      applicationId: (
        await db.select({ id: s.applications.id }).from(s.applications).limit(1)
      )[0].id,
      researcherId: researcherIds["okonjoa@mcmaster.ca"],
      note: "Strong on the missingness question. Ask about availability around the Wednesday meeting before deciding.",
    },
  ]);

  await db.insert(s.savedOpportunities).values([
    { studentId: studentIds["obrienk@mcmaster.ca"], opportunityId: opportunityIds.microbiome },
    { studentId: studentIds["obrienk@mcmaster.ca"], opportunityId: opportunityIds.publichealth },
    { studentId: studentIds["adeyemij@mcmaster.ca"], opportunityId: opportunityIds.chart },
    { studentId: studentIds["d.osei@mcmaster.ca"], opportunityId: opportunityIds.cancer },
  ]);

  await db.insert(s.waitlistEntries).values([
    {
      kind: "student",
      firstName: "Priya",
      lastName: "Raghunathan",
      email: "raghup@mcmaster.ca",
      institutionId: mcmaster.id,
      program: "Bachelor of Health Sciences",
      yearLevel: "Year 1",
      researchInterests: "Global health, infectious disease, health equity",
      contactConsent: true,
      status: "new",
    },
    {
      kind: "student",
      firstName: "Marcus",
      lastName: "Idowu",
      email: "idowum@mcmaster.ca",
      institutionId: mcmaster.id,
      program: "Life Sciences",
      yearLevel: "Year 2",
      researchInterests: "Immunology, vaccine development",
      contactConsent: true,
      status: "contacted",
    },
    {
      kind: "student",
      firstName: "Yuki",
      lastName: "Tanabe",
      email: "tanabey@mcmaster.ca",
      institutionId: mcmaster.id,
      program: "Integrated Biomedical Engineering and Health Sciences",
      yearLevel: "Year 3",
      researchInterests: "Medical devices, rehabilitation engineering",
      contactConsent: true,
      status: "invited",
    },
    {
      kind: "researcher",
      firstName: "Elena",
      lastName: "Petrov",
      email: "petrove@mcmaster.ca",
      institutionId: mcmaster.id,
      title: "Assistant Professor",
      department: "Department of Medicine",
      labName: "Respiratory Outcomes Group",
      researchInterests: "Respiratory epidemiology, COPD outcomes",
      expectedStudentCount: 3,
      helpNeeded: "Data cleaning, literature screening, chart review",
      contactConsent: true,
      status: "contacted",
    },
    {
      kind: "researcher",
      firstName: "Idris",
      lastName: "Bello",
      email: "belloi@mcmaster.ca",
      institutionId: mcmaster.id,
      title: "Associate Professor",
      department: "Department of Biology",
      labName: "Microbial Evolution Lab",
      researchInterests: "Experimental evolution, antimicrobial resistance",
      expectedStudentCount: 2,
      helpNeeded: "Bench work, sequencing prep",
      comments: "Interested for the winter term rather than September.",
      contactConsent: true,
      status: "new",
    },
  ]);

  await db.insert(s.notifications).values([
    {
      userId: studentIds["adeyemij@mcmaster.ca"],
      type: "application_status_changed",
      title: "Your application is under review",
      body: "Dr. Amara Okonjo has opened your application to Undergraduate Research Assistant, Cardiovascular Outcomes.",
      link: "/applications",
    },
    {
      userId: studentIds["s.mwangi@mcmaster.ca"],
      type: "researcher_contacted",
      title: "Dr. Rosalind Halden would like to speak with you",
      body: "About Neuroimaging Research Assistant, Adolescent Attention Networks.",
      link: "/applications",
    },
    {
      userId: researcherIds["okonjoa@mcmaster.ca"],
      type: "new_application",
      title: "New application received",
      body: "Undergraduate Research Assistant, Cardiovascular Outcomes has a new applicant.",
      link: "/researcher/opportunities",
    },
    {
      userId: admin.id,
      type: "researcher_awaiting_approval",
      title: "A researcher account is awaiting review",
      body: "Paulo Vasquez, Clinical Genomics Core.",
      link: "/admin/researchers",
    },
  ]);

  console.log("seed complete");
  console.log(`  institutions: 2`);
  console.log(`  researchers: ${researcherSeeds.length}`);
  console.log(`  students: ${studentSeeds.length}`);
  console.log(`  opportunities: ${opportunitySeeds.length}`);
  console.log(`  applications: ${applicationSeeds.length}`);
  console.log(`  admin sign-in email: admin@myresearchbridge.com`);
  process.exit(0);
}

main().catch((error) => {
  console.error("seed failed", error);
  process.exit(1);
});
