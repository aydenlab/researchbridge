import type { MetadataRoute } from "next";
import { desc, eq } from "drizzle-orm";
import { db, opportunities } from "@/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL.replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/opportunities`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/reviews`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/for-researchers`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/researchers/interest`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/accessibility`, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const rows = await db
      .select({ slug: opportunities.slug, updatedAt: opportunities.updatedAt })
      .from(opportunities)
      .where(eq(opportunities.status, "published"))
      .orderBy(desc(opportunities.publishedAt))
      .limit(500);

    return [
      ...staticRoutes,
      ...rows.map((row) => ({
        url: `${base}/opportunities/${row.slug}`,
        lastModified: row.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
