import { describe, it, expect } from "vitest";
import { entityKeys, qk } from "@/lib/query-keys";

describe("entityKeys", () => {
  const keys = entityKeys("things");

  it("builds hierarchical keys under one domain root", () => {
    expect(keys.all).toEqual(["things"]);
    expect(keys.lists()).toEqual(["things", "list"]);
    expect(keys.details()).toEqual(["things", "detail"]);
    expect(keys.detail(5)).toEqual(["things", "detail", 5]);
  });

  it("defaults list params to null so the key stays stable", () => {
    expect(keys.list()).toEqual(["things", "list", null]);
    expect(keys.list(undefined)).toEqual(["things", "list", null]);
    expect(keys.list({ trainingId: 1 })).toEqual(["things", "list", { trainingId: 1 }]);
  });

  it("keeps detail keys distinct per id and per id type", () => {
    expect(keys.detail(1)).not.toEqual(keys.detail(2));
    // string vs number ids produce different keys — callers must be consistent
    expect(keys.detail("1")).not.toEqual(keys.detail(1));
  });
});

describe("qk", () => {
  it("gives every backend domain its own collision-free root", () => {
    const roots = Object.values(qk).map((keys) => keys.all[0]);
    expect(new Set(roots).size).toBe(roots.length);
  });

  it("exposes the domains the app queries", () => {
    expect(qk.assessments.detail(3)).toEqual(["assessments", "detail", 3]);
    expect(qk.questions.lists()).toEqual(["questions", "list"]);
    expect(qk.assessmentAttempts.all).toEqual(["assessment-attempts"]);
  });
});
