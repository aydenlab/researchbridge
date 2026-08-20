import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { applications, db, placementOutcomes } from "@/db";
import { pilotMetrics } from "@/lib/queries/admin";
import { createApplicationGraph, createOpportunity, createResearcher } from "../fixtures";

describe("pilot metrics", () => {
  it("computes every section without throwing on an empty or partial dataset", async () => {
    const metrics = await pilotMetrics();

    expect(metrics.headline.length).toBeGreaterThan(0);
    expect(metrics.funnel.length).toBeGreaterThan(0);
    expect(metrics.outcomes.length).toBeGreaterThan(0);
    expect(metrics.timing.length).toBeGreaterThan(0);

    for (const section of [metrics.headline, metrics.funnel, metrics.outcomes, metrics.timing]) {
      for (const metric of section) {
        expect(typeof metric.label).toBe("string");
        expect(typeof metric.value).toBe("string");
        expect(typeof metric.known).toBe("boolean");
      }
    }
  });

  it("formats an average duration returned by Postgres as a numeric string", async () => {
    const graph = await createApplicationGraph();
    const submittedAt = new Date(Date.now() - 30 * 60 * 60 * 1000);

    await db
      .update(applications)
      .set({ submittedAt, reviewedAt: new Date(submittedAt.getTime() + 6 * 60 * 60 * 1000) })
      .where(eq(applications.id, graph.application.id));

    const metrics = await pilotMetrics();
    const firstAction = metrics.timing.find((metric) => metric.label === "Time to first researcher action");

    expect(firstAction).toBeDefined();
    expect(firstAction!.known).toBe(true);
    expect(firstAction!.value).toMatch(/^\d+(\.\d+)? (hours|days)$/);
  });

  it("never reports a negative duration", async () => {
    const researcher = await createResearcher();
    const opportunity = await createOpportunity(researcher.id, {
      publishedAt: new Date(),
    });
    const graph = await createApplicationGraph();

    await db
      .update(applications)
      .set({ opportunityId: opportunity.id, submittedAt: new Date(Date.now() - 20 * 86400000) })
      .where(eq(applications.id, graph.application.id));

    const metrics = await pilotMetrics();
    for (const metric of metrics.timing) {
      expect(metric.value.startsWith("-")).toBe(false);
    }
  });

  it("marks a metric it cannot measure yet rather than inventing a number", async () => {
    const metrics = await pilotMetrics();
    const timeToFill = metrics.timing.find((metric) => metric.label === "Time to fill");

    expect(timeToFill?.known).toBe(false);
    expect(timeToFill?.value).toBe("Not known yet");
  });

  it("counts a confirmed placement in the outcomes section", async () => {
    const graph = await createApplicationGraph();
    await db.insert(placementOutcomes).values({
      applicationId: graph.application.id,
      studentReportedOutcome: "yes",
      researcherReportedOutcome: "yes",
      confirmed: true,
      positionType: "paid",
      studentWouldUseAgain: true,
    });

    const metrics = await pilotMetrics();
    const confirmed = metrics.outcomes.find((metric) => metric.label === "Confirmed placements");
    const paid = metrics.outcomes.find((metric) => metric.label === "Paid placements");

    expect(Number(confirmed?.value)).toBeGreaterThan(0);
    expect(Number(paid?.value)).toBeGreaterThan(0);
  });

  it("labels self-reported figures as self-reported", async () => {
    const metrics = await pilotMetrics();
    const wouldUseAgain = metrics.outcomes.find((metric) => metric.label === "Would use ResearchBridge again");
    expect(wouldUseAgain?.detail).toBe("Self-reported");
  });
});
