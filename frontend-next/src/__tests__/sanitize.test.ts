import { describe, it, expect } from "vitest";
import {
  sanitizeAnswerOptionForSolving,
  sanitizeQuestionForSolving,
  sanitizeQuestionsForSolving,
} from "@/lib/sanitize";
import type { AnswerOption, Question } from "@/types";

const option = (overrides: Partial<AnswerOption> = {}): AnswerOption => ({
  id: 1,
  questionId: 10,
  text: "SELECT",
  isCorrect: true,
  orderIndex: 1,
  ...overrides,
});

const question = (overrides: Partial<Question> = {}): Question => ({
  id: 10,
  title: "Which SQL statement reads data?",
  description: "Pick one.",
  difficulty: 1,
  type: "MULTIPLE_CHOICE",
  status: "APPROVED",
  topicId: 2,
  createdById: 5,
  reviewedAt: null,
  answerOptions: [option(), option({ id: 2, text: "INSERT", isCorrect: false, orderIndex: 2 })],
  ...overrides,
});

describe("sanitizeAnswerOptionForSolving", () => {
  it("strips isCorrect and keeps every other field", () => {
    const safe = sanitizeAnswerOptionForSolving(option());

    expect(safe).not.toHaveProperty("isCorrect");
    expect(safe).toEqual({ id: 1, questionId: 10, text: "SELECT", orderIndex: 1 });
  });
});

describe("sanitizeQuestionForSolving", () => {
  it("strips isCorrect from every option", () => {
    const safe = sanitizeQuestionForSolving(question());

    expect(safe.answerOptions).toHaveLength(2);
    for (const opt of safe.answerOptions!) {
      expect(opt).not.toHaveProperty("isCorrect");
    }
    // The rest of the question is untouched.
    expect(safe.title).toBe("Which SQL statement reads data?");
    expect(safe.status).toBe("APPROVED");
  });

  it("keeps answerOptions undefined for questions without options (OPEN/CODE)", () => {
    const safe = sanitizeQuestionForSolving(question({ type: "OPEN", answerOptions: undefined }));

    expect(safe.answerOptions).toBeUndefined();
  });

  it("does not mutate the input question", () => {
    const original = question();
    sanitizeQuestionForSolving(original);

    expect(original.answerOptions![0]).toHaveProperty("isCorrect", true);
  });
});

describe("sanitizeQuestionsForSolving", () => {
  it("sanitizes every question in a list", () => {
    const safe = sanitizeQuestionsForSolving([question(), question({ id: 11 })]);

    expect(safe).toHaveLength(2);
    for (const q of safe) {
      for (const opt of q.answerOptions ?? []) {
        expect(opt).not.toHaveProperty("isCorrect");
      }
    }
  });

  it("returns an empty array for an empty list", () => {
    expect(sanitizeQuestionsForSolving([])).toEqual([]);
  });
});
