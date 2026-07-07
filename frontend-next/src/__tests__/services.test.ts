import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the apiClient seam — every domain service is a thin wrapper over it, so
// these tests assert the exact path / method / body contract with the backend.
vi.mock("@/services/apiClient", () => ({
  apiJsonFetch: vi.fn(),
  apiEnsureOk: vi.fn(),
  apiFetch: vi.fn(),
}));

import { apiJsonFetch, apiEnsureOk } from "@/services/apiClient";
import { topicsService } from "@/services/topics";
import { questionsService } from "@/services/questions";
import { equivalenceGroupsService } from "@/services/equivalenceGroups";
import { assessmentsService } from "@/services/assessments";

const jsonFetch = vi.mocked(apiJsonFetch);
const ensureOk = vi.mocked(apiEnsureOk);

beforeEach(() => {
  vi.clearAllMocks();
  jsonFetch.mockResolvedValue(undefined);
  ensureOk.mockResolvedValue(undefined);
});

describe("topicsService", () => {
  it("list → GET /topics", async () => {
    await topicsService.list();
    expect(jsonFetch).toHaveBeenCalledWith("/topics");
  });

  it("create → POST /topics with a JSON body", async () => {
    await topicsService.create({ name: "SQL", trainingId: 3 });
    expect(jsonFetch).toHaveBeenCalledWith("/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "SQL", trainingId: 3 }),
    });
  });

  it("update → PUT /topics/:id", async () => {
    await topicsService.update(7, { name: "Renamed" });
    expect(jsonFetch).toHaveBeenCalledWith("/topics/7", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    });
  });

  it("remove uses apiEnsureOk (204, no JSON body to parse)", async () => {
    await topicsService.remove(7);
    expect(ensureOk).toHaveBeenCalledWith("/topics/7", { method: "DELETE" });
    expect(jsonFetch).not.toHaveBeenCalled();
  });
});

describe("questionsService", () => {
  it("updateStatus → PATCH /questions/:id/status with { status }", async () => {
    await questionsService.updateStatus(11, "APPROVED");
    expect(jsonFetch).toHaveBeenCalledWith("/questions/11/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
  });

  it("remove uses apiJsonFetch — backend returns { message } with 200, not 204", async () => {
    jsonFetch.mockResolvedValue({ message: "Question deleted" });

    const result = await questionsService.remove(11);

    expect(jsonFetch).toHaveBeenCalledWith("/questions/11", { method: "DELETE" });
    expect(ensureOk).not.toHaveBeenCalled();
    expect(result).toEqual({ message: "Question deleted" });
  });

  it("create passes options through for MULTIPLE_CHOICE", async () => {
    await questionsService.create({
      title: "Pick one",
      description: "desc",
      difficulty: 1,
      topicId: 2,
      type: "MULTIPLE_CHOICE",
      options: [
        { text: "A", isCorrect: true },
        { text: "B", isCorrect: false },
      ],
    });

    const body = JSON.parse(jsonFetch.mock.calls[0][1]!.body as string);
    expect(body.options).toHaveLength(2);
    expect(body.options[0]).toEqual({ text: "A", isCorrect: true });
  });

  it("propagates backend errors to the caller", async () => {
    jsonFetch.mockRejectedValue(new Error("Question not found"));

    await expect(questionsService.get(999)).rejects.toThrow("Question not found");
  });
});

describe("equivalenceGroupsService", () => {
  it("addQuestion → POST /equivalence-groups/:id/questions with { questionId }", async () => {
    await equivalenceGroupsService.addQuestion(4, 17);
    expect(jsonFetch).toHaveBeenCalledWith("/equivalence-groups/4/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: 17 }),
    });
  });

  it("removeQuestion → DELETE /equivalence-groups/:id/questions/:questionId", async () => {
    await equivalenceGroupsService.removeQuestion(4, 17);
    expect(jsonFetch).toHaveBeenCalledWith("/equivalence-groups/4/questions/17", {
      method: "DELETE",
    });
  });

  it("create → POST /equivalence-groups", async () => {
    await equivalenceGroupsService.create({ title: "Variants", trainingId: 1 });
    expect(jsonFetch).toHaveBeenCalledWith("/equivalence-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Variants", trainingId: 1 }),
    });
  });
});

describe("assessmentsService", () => {
  it("generate → POST /assessments/generate", async () => {
    await assessmentsService.generate({
      title: "Post-test",
      trainingId: 1,
      type: "POST_TEST",
      pairedAssessmentId: 5,
      count: 4,
    });

    const [path, options] = jsonFetch.mock.calls[0];
    expect(path).toBe("/assessments/generate");
    expect(options!.method).toBe("POST");
    const body = JSON.parse(options!.body as string);
    expect(body.pairedAssessmentId).toBe(5);
    expect(body.count).toBe(4);
  });

  it("updateStatus → PATCH /assessments/:id/status", async () => {
    await assessmentsService.updateStatus(9, "PUBLISHED");
    expect(jsonFetch).toHaveBeenCalledWith("/assessments/9/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PUBLISHED" }),
    });
  });

  it("getResults → GET /assessments/:id/results (bespoke results shape)", async () => {
    await assessmentsService.getResults(9);
    expect(jsonFetch).toHaveBeenCalledWith("/assessments/9/results");
  });

  it("removeQuietly only asserts 2xx", async () => {
    await assessmentsService.removeQuietly(9);
    expect(ensureOk).toHaveBeenCalledWith("/assessments/9", { method: "DELETE" });
  });
});
