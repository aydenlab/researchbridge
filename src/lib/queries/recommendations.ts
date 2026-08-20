import type { StudentProfileBundle } from "./student";
import type { OpportunityListItem } from "./opportunities";
import { searchOpportunities } from "./opportunities";

export type RecommendationReason = string;

export type Recommendation = {
  item: OpportunityListItem;
  score: number;
  reasons: RecommendationReason[];
};

export async function recommendOpportunities(
  bundle: StudentProfileBundle,
  options: { limit?: number; excludeIds?: Set<string> } = {},
): Promise<Recommendation[]> {
  const limit = options.limit ?? 4;
  const { items } = await searchOpportunities({ openOnly: true, perPage: 60, sort: "recent" });

  const interestNames = new Set(bundle.fields.map((field) => field.name.toLowerCase()));
  const skillNames = new Set(bundle.skills.map((skill) => skill.name.toLowerCase()));
  const hours = bundle.profile.weeklyHours;
  const preference = bundle.profile.locationPreference;
  const hasExperience = bundle.experiences.length > 0;

  const scored: Recommendation[] = [];

  for (const item of items) {
    if (options.excludeIds?.has(item.id)) continue;

    let score = 0;
    const reasons: RecommendationReason[] = [];

    const matchedFields = item.fieldNames.filter((name) => interestNames.has(name.toLowerCase()));
    if (matchedFields.length > 0) {
      score += matchedFields.length * 3;
      reasons.push(`Matches your interest in ${matchedFields.join(" and ")}`);
    }

    const matchedSkills = item.skillNames.filter((name) => skillNames.has(name.toLowerCase()));
    if (matchedSkills.length > 0) {
      score += matchedSkills.length * 2;
      reasons.push(`You listed ${matchedSkills.slice(0, 3).join(", ")}`);
    }

    if (hours !== null && item.hoursPerWeekMin !== null && hours >= item.hoursPerWeekMin) {
      score += 2;
      reasons.push(`Fits your ${hours} hours per week`);
    }

    if (preference && (item.locationMode === preference || item.locationMode === "hybrid")) {
      score += 1;
    }

    if (!hasExperience && item.beginnerFriendly) {
      score += 2;
      reasons.push("Open to students without previous research");
    }

    if (!hasExperience && item.priorResearchRequired) {
      score -= 4;
    }

    if (score > 0) scored.push({ item, score, reasons: reasons.slice(0, 3) });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
