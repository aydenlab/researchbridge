import { slugify } from "./format";

/**
 * Discipline to research area mapping for researcher profiles.
 *
 * Disciplines only exist to narrow the area list: a researcher ticks one or
 * more, and sees the union of their areas with duplicates removed. Areas are
 * ordinary `research_fields` rows matched by slug, so matching, search, and the
 * student side keep working off the same table. Migration 0011 seeds every area
 * named here.
 *
 * "Other" is never a research field. Picking it as an area asks for free text,
 * and picking the standalone Other discipline asks for the discipline by name.
 */
export const OTHER = "Other";
export const OTHER_DISCIPLINE_SLUG = "other";

export const DISCIPLINES: { slug: string; name: string; areas: string[] }[] = [
  {
    name: "Health & Medicine",
    areas: [
      "Aging & Gerontology", "Anesthesiology", "Cardiology & Cardiovascular Health", "Clinical Epidemiology",
      "Clinical Research", "Critical Care", "Dentistry & Oral Health", "Dermatology", "Digital Health",
      "Emergency Medicine", "Endocrinology & Metabolism", "Family Medicine", "Gastroenterology", "Global Health",
      "Health Informatics", "Health Policy", "Health Services Research", "Hematology", "Infectious Diseases",
      "Medical Education", "Medical Imaging & Radiology", "Mental Health & Psychiatry", "Musculoskeletal Health",
      "Nephrology", "Neurology", "Nursing", "Nutrition", "Obstetrics & Gynecology", "Occupational Health",
      "Oncology & Cancer Research", "Ophthalmology", "Orthopaedics", "Otolaryngology", "Pain & Pain Management",
      "Palliative Care", "Pathology", "Pediatrics", "Pharmacy", "Physical Medicine & Rehabilitation", "Physiotherapy",
      "Population Health", "Primary Care", "Public Health", "Rehabilitation Sciences", "Reproductive Health",
      "Respirology", "Rheumatology", "Surgery", "Transplantation", "Urology", "Women’s Health",
    ],
  },
  {
    name: "Life Sciences",
    areas: [
      "Anatomy", "Biochemistry", "Bioinformatics", "Biophysics", "Biotechnology", "Botany & Plant Science",
      "Cell Biology", "Computational Biology", "Developmental Biology", "Ecology", "Evolutionary Biology", "Genetics",
      "Genomics", "Immunology", "Marine Biology", "Microbiology", "Molecular Biology", "Molecular Genetics",
      "Neuroscience", "Pharmacology", "Physiology", "Proteomics", "Stem Cell Biology", "Structural Biology",
      "Systems Biology", "Virology", "Zoology",
    ],
  },
  {
    name: "Psychology & Behavioural Sciences",
    areas: [
      "Behavioural Science", "Clinical Psychology", "Cognitive Psychology", "Developmental Psychology",
      "Educational Psychology", "Health Psychology", "Industrial & Organizational Psychology", "Neuropsychology",
      "Personality Psychology", "Positive Psychology", "Quantitative Psychology", "Social Psychology",
    ],
  },
  {
    name: "Engineering",
    areas: [
      "Aerospace Engineering", "Biomedical Engineering", "Chemical Engineering", "Civil Engineering",
      "Computer Engineering", "Electrical Engineering", "Environmental Engineering", "Industrial Engineering",
      "Materials Engineering", "Mechanical Engineering", "Mechatronics", "Nuclear Engineering", "Robotics",
      "Software Engineering", "Systems Engineering",
    ],
  },
  {
    name: "Computer Science & AI",
    areas: [
      "Artificial Intelligence", "Bioinformatics", "Computational Biology", "Computer Graphics", "Computer Vision",
      "Cybersecurity", "Data Science", "Databases & Information Systems", "Human-Computer Interaction",
      "Machine Learning", "Natural Language Processing", "Networks & Distributed Systems", "Robotics",
      "Software Systems", "Theoretical Computer Science",
    ],
  },
  {
    name: "Chemistry & Materials Science",
    areas: [
      "Analytical Chemistry", "Biochemistry", "Chemical Biology", "Computational Chemistry", "Inorganic Chemistry",
      "Materials Chemistry", "Materials Science", "Medicinal Chemistry", "Nanotechnology", "Organic Chemistry",
      "Physical Chemistry", "Polymer Science",
    ],
  },
  {
    name: "Physics & Astronomy",
    areas: [
      "Applied Physics", "Astrophysics", "Atomic, Molecular & Optical Physics", "Biophysics",
      "Condensed Matter Physics", "Cosmology", "Medical Physics", "Nuclear Physics", "Particle Physics",
      "Quantum Science", "Theoretical Physics",
    ],
  },
  {
    name: "Mathematics & Statistics",
    areas: [
      "Applied Mathematics", "Biostatistics", "Computational Mathematics", "Data Science", "Mathematical Biology",
      "Mathematical Modelling", "Probability", "Pure Mathematics", "Statistics",
    ],
  },
  {
    name: "Business & Management",
    areas: [
      "Accounting", "Business Analytics", "Consumer Behaviour", "Entrepreneurship", "Finance", "Human Resources",
      "Innovation", "International Business", "Leadership", "Management", "Marketing", "Operations Management",
      "Organizational Behaviour", "Strategy", "Supply Chain Management",
    ],
  },
  {
    name: "Economics",
    areas: [
      "Applied Economics", "Behavioural Economics", "Development Economics", "Econometrics",
      "Environmental Economics", "Financial Economics", "Health Economics", "International Economics",
      "Labour Economics", "Macroeconomics", "Microeconomics", "Public Economics",
    ],
  },
  {
    name: "Social Sciences",
    areas: [
      "Anthropology", "Criminology", "Demography", "Development Studies", "Gender & Sexuality Studies", "Geography",
      "International Relations", "Political Science", "Public Administration", "Public Policy", "Social Policy",
      "Social Work", "Sociology", "Urban Studies",
    ],
  },
  {
    name: "Education",
    areas: [
      "Curriculum & Instruction", "Education Policy", "Educational Leadership", "Educational Psychology",
      "Educational Technology", "Higher Education", "Learning Sciences", "Special Education", "Teaching & Pedagogy",
    ],
  },
  {
    name: "Humanities",
    areas: [
      "Classics", "Cultural Studies", "Ethics", "History", "Languages", "Linguistics", "Literature", "Philosophy",
      "Religious Studies",
    ],
  },
  {
    name: "Law & Legal Studies",
    areas: [
      "Business & Corporate Law", "Constitutional Law", "Criminal Law", "Environmental Law", "Health Law",
      "Human Rights Law", "Intellectual Property Law", "International Law", "Labour & Employment Law",
      "Technology, Data & Privacy Law",
    ],
  },
  {
    name: "Environment & Earth Sciences",
    areas: [
      "Agriculture", "Atmospheric Science", "Climate Change", "Conservation Biology", "Earth Sciences",
      "Environmental Science", "Environmental Sustainability", "Forestry", "Geology", "Hydrology", "Oceanography",
      "Renewable Energy", "Sustainability",
    ],
  },
  {
    name: "Communication, Media & Arts",
    areas: [
      "Communication Studies", "Digital Media", "Film & Media Studies", "Journalism", "Media Studies", "Music",
      "Performing Arts", "Visual Arts",
    ],
  },
  {
    name: "Other / Interdisciplinary",
    areas: [
      "Bioethics", "Computational Social Science", "Equity, Diversity & Inclusion", "Implementation Science",
      "Indigenous Studies", "Knowledge Translation", "One Health", "Science & Technology Studies",
      "Translational Research",
    ],
  },
].map((discipline) => ({ ...discipline, slug: slugify(discipline.name) }));

export const DISCIPLINE_SLUGS = new Set(DISCIPLINES.map((discipline) => discipline.slug));

/** Every mapped area once, in first-seen order. */
export function allAreaNames(): string[] {
  return [...new Set(DISCIPLINES.flatMap((discipline) => discipline.areas))];
}

/**
 * The areas to offer for a set of chosen disciplines: their union, duplicates
 * removed, in discipline order, with Other last whenever anything is chosen.
 * The standalone Other discipline has no areas of its own, so choosing only it
 * offers just Other.
 */
export function areasForDisciplines(slugs: Iterable<string>): string[] {
  const chosen = new Set(slugs);
  const names = new Set<string>();
  for (const discipline of DISCIPLINES) {
    if (!chosen.has(discipline.slug)) continue;
    for (const area of discipline.areas) names.add(area);
  }
  return chosen.size > 0 ? [...names, OTHER] : [];
}

/** The disciplines whose area lists contain any of these area slugs. Used to pre-select for older profiles. */
export function disciplinesForAreaSlugs(areaSlugs: Iterable<string>): string[] {
  const wanted = new Set(areaSlugs);
  return DISCIPLINES.filter((discipline) => discipline.areas.some((area) => wanted.has(slugify(area)))).map(
    (discipline) => discipline.slug,
  );
}
