/**
 * A small CSV reader for the faculty import.
 *
 * Deliberately not a dependency: the input is one pasted export from McMaster
 * Experts or a spreadsheet, and the only things that actually go wrong with it
 * are quoted commas, quoted newlines, and a stray BOM. A parser that handles
 * those three and nothing else is easier to trust than one that handles
 * everything and is never read.
 */
export type CsvRow = Record<string, string>;

export function parseCsv(input: string): { headers: string[]; rows: CsvRow[] } {
  const text = input.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: string[][] = [];

  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((entry) => entry.some((value) => value.trim().length > 0));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((value) => normalizeHeader(value));
  const rows = nonEmpty.slice(1).map((entry) => {
    const row: CsvRow = {};
    headers.forEach((header, position) => {
      row[header] = (entry[position] ?? "").trim();
    });
    return row;
  });

  return { headers, rows };
}

/**
 * Accepts whatever the spreadsheet happened to call the column. Faculty lists
 * arrive with headers like "First Name", "first_name", and "Given name", and
 * making somebody rename columns before an import is the kind of friction that
 * means the import never happens.
 */
export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const ALIASES: Record<string, string[]> = {
  email: ["email", "emailaddress", "mail", "contactemail"],
  firstName: ["firstname", "first", "givenname", "forename"],
  lastName: ["lastname", "last", "surname", "familyname"],
  title: ["title", "position", "jobtitle", "academictitle", "rank"],
  department: ["department", "dept", "unit"],
  faculty: ["faculty", "school", "college", "division"],
  labName: ["labname", "lab", "group", "researchgroup", "labgroup"],
  // The research page is the one link a profile carries, so a list that names
  // its column after a lab site still lands in the right place.
  personalWebsite: [
    "researchpage",
    "researchurl",
    "researchwebsite",
    "personalwebsite",
    "profileurl",
    "expertsurl",
    "expertsprofile",
    "homepage",
    "labwebsite",
    "laburl",
    "labsite",
    "website",
  ],
  linkedinUrl: ["linkedin", "linkedinurl", "linkedinprofile"],
  orcidId: ["orcid", "orcidid"],
  biography: ["biography", "bio", "about", "researchsummary", "profile"],
  researchAreas: ["researchareas", "researchinterests", "areas", "keywords", "expertise", "fields"],
  researcherType: ["researchertype", "type", "role"],
};

export function readField(row: CsvRow, key: keyof typeof ALIASES): string {
  for (const alias of ALIASES[key]) {
    const value = row[alias];
    if (value !== undefined && value.trim().length > 0) return value.trim();
  }
  return "";
}

/** Research areas arrive separated by whatever the exporter felt like using. */
export function splitAreas(value: string): string[] {
  return value
    .split(/[;|]|,(?![^(]*\))/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 12);
}
