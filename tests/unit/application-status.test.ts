import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  allowedTransitions,
  canTransition,
  isActive,
  isTerminal,
  STATUS_LABELS,
  STUDENT_STATUS_DESCRIPTION,
} from "@/lib/application-status";

describe("student transitions", () => {
  it("lets a student submit a draft", () => {
    expect(canTransition("draft", "submitted", "student")).toBe(true);
  });

  it("lets a student withdraw an active application", () => {
    for (const status of ["submitted", "under_review", "shortlisted", "researcher_contacted", "interview", "accepted"] as const) {
      expect(canTransition(status, "withdrawn", "student")).toBe(true);
    }
  });

  it("does not let a student accept or shortlist themselves", () => {
    expect(canTransition("submitted", "accepted", "student")).toBe(false);
    expect(canTransition("submitted", "shortlisted", "student")).toBe(false);
  });
});

describe("researcher transitions", () => {
  it("follows the documented path from submitted to accepted", () => {
    expect(canTransition("submitted", "under_review", "researcher")).toBe(true);
    expect(canTransition("under_review", "shortlisted", "researcher")).toBe(true);
    expect(canTransition("shortlisted", "researcher_contacted", "researcher")).toBe(true);
    expect(canTransition("researcher_contacted", "interview", "researcher")).toBe(true);
    expect(canTransition("interview", "accepted", "researcher")).toBe(true);
  });

  it("allows declining directly from submitted", () => {
    expect(canTransition("submitted", "declined", "researcher")).toBe(true);
  });

  it("cannot restore a withdrawn application to accepted", () => {
    expect(canTransition("withdrawn", "accepted", "researcher")).toBe(false);
    expect(allowedTransitions("withdrawn", "researcher")).toEqual([]);
  });

  it("cannot revive a declined application", () => {
    expect(allowedTransitions("declined", "researcher")).toEqual([]);
  });

  it("cannot move an application backwards", () => {
    expect(canTransition("accepted", "submitted", "researcher")).toBe(false);
    expect(canTransition("interview", "under_review", "researcher")).toBe(false);
  });

  it("does not let a researcher submit on a student's behalf", () => {
    expect(canTransition("draft", "submitted", "researcher")).toBe(false);
  });
});

describe("status metadata", () => {
  it("labels and describes every status", () => {
    for (const status of APPLICATION_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STUDENT_STATUS_DESCRIPTION[status]).toBeTruthy();
    }
  });

  it("classifies terminal and active states", () => {
    expect(isTerminal("declined")).toBe(true);
    expect(isTerminal("withdrawn")).toBe(true);
    expect(isTerminal("position_filled")).toBe(true);
    expect(isActive("under_review")).toBe(true);
    expect(isActive("draft")).toBe(false);
  });

  it("uses no emoji in any user-facing label", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const status of APPLICATION_STATUSES) {
      expect(emoji.test(STATUS_LABELS[status])).toBe(false);
      expect(emoji.test(STUDENT_STATUS_DESCRIPTION[status])).toBe(false);
    }
  });
});
