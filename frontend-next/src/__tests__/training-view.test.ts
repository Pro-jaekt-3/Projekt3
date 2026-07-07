import { describe, it, expect } from "vitest";
import { trainingToView } from "@/lib/training-view";
import type { Training } from "@/types";

const training = (overrides: Partial<Training> = {}): Training => ({
  id: 12,
  title: "Osnove informatike",
  description: "Demo training",
  createdAt: "2026-05-01T10:00:00.000Z",
  updatedAt: "2026-06-01T10:00:00.000Z",
  ...overrides,
});

describe("trainingToView", () => {
  it("maps the API entity onto the display shape", () => {
    const view = trainingToView(training());

    expect(view.id).toBe("12"); // display shape uses string ids
    expect(view.title).toBe("Osnove informatike");
    expect(view.description).toBe("Demo training");
    expect(view.status).toBe("Active");
  });

  it("falls back to an empty description for null", () => {
    const view = trainingToView(training({ description: null }));

    expect(view.description).toBe("");
  });

  it("renders a dash for an unparseable updatedAt", () => {
    const view = trainingToView(training({ updatedAt: "not-a-date" }));

    expect(view.lastActivity).toBe("—");
  });

  it("leaves not-yet-wired domains at neutral defaults", () => {
    const view = trainingToView(training());

    expect(view.participants).toBe(0);
    expect(view.assessments).toBe(0);
    expect(view.topics).toEqual([]);
  });
});
