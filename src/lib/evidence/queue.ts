import { after } from "next/server";
import { rerunApplicationAnalyses } from "@/lib/criteria/rerun";
import { rescoreDeterministicCriteria } from "@/lib/criteria/rescore";
import { log } from "@/lib/log";
import { refreshStudentEvidence } from "./refresh";

/**
 * Re-reads a student's resume and research history once the current response
 * has gone out, then rescores their submitted applications on the new reading.
 * Reading a PDF and calling the model take seconds, so a student saving their
 * profile is never kept waiting for it.
 */
export function queueEvidenceRefresh(studentId: string) {
  const work = async () => {
    try {
      const result = await refreshStudentEvidence(studentId);
      if (result.outcome === "updated") {
        await rescoreDeterministicCriteria({ studentId });
        await rerunApplicationAnalyses({ studentId });
      }
    } catch (error) {
      log.error("student_evidence_refresh_failed", { studentId, error: String(error) });
    }
  };

  try {
    after(work);
  } catch {
    // Outside a request (a script or a test) there is nothing to defer past.
    void work();
  }
}

/**
 * Re-grades everyone who has applied to a position, once the current response
 * has gone out. Saving criteria replaces them, which removes every applicant's
 * stored results for the old ones; without this, existing applicants would sit
 * ungraded on the new criteria until the next background pass.
 */
export function queueOpportunityRegrade(opportunityId: string) {
  const work = async () => {
    try {
      await rescoreDeterministicCriteria({ opportunityId });
      await rerunApplicationAnalyses({ opportunityId });
    } catch (error) {
      log.error("opportunity_regrade_failed", { opportunityId, error: String(error) });
    }
  };

  try {
    after(work);
  } catch {
    void work();
  }
}
