import { describe, it, expect, beforeEach } from "vitest";
import {
  rememberAttemptId,
  getAttemptId,
  getAllAttemptIds,
  forgetAttemptId,
} from "@/lib/attempt-storage";

const STORAGE_KEY = "projekt3.attempts";

describe("attempt-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("remembers and returns the attempt id for an assessment", () => {
    rememberAttemptId(3, 42);

    expect(getAttemptId(3)).toBe(42);
    // number and string assessment ids address the same entry
    expect(getAttemptId("3")).toBe(42);
  });

  it("returns null for an unknown assessment", () => {
    expect(getAttemptId(999)).toBeNull();
  });

  it("overwrites with the latest attempt id", () => {
    rememberAttemptId(3, 42);
    rememberAttemptId(3, 43);

    expect(getAttemptId(3)).toBe(43);
    expect(getAllAttemptIds()).toEqual([43]);
  });

  it("lists all remembered attempt ids", () => {
    rememberAttemptId(1, 10);
    rememberAttemptId(2, 20);

    expect(getAllAttemptIds().sort()).toEqual([10, 20]);
  });

  it("forgets a single assessment's attempt", () => {
    rememberAttemptId(1, 10);
    rememberAttemptId(2, 20);

    forgetAttemptId(1);

    expect(getAttemptId(1)).toBeNull();
    expect(getAttemptId(2)).toBe(20);
  });

  it("treats corrupted storage as empty instead of throwing", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");

    expect(getAttemptId(1)).toBeNull();
    expect(getAllAttemptIds()).toEqual([]);
    // and writes still work afterwards
    rememberAttemptId(1, 10);
    expect(getAttemptId(1)).toBe(10);
  });
});
