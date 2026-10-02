import { after } from "next/server";
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
      if (result.outcome === "updated") await rescoreDeterministicCriteria({ studentId });
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
