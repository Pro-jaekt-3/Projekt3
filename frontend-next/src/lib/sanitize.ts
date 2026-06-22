import type { AnswerOption, Question } from "@/types";

// ⚠️ Known backend leak (docs/FRONTEND-NOTES.md): GET /assessments/:id returns
// answerOptions INCLUDING `isCorrect`, even to a participant who is still solving.
// Solving views MUST NOT receive `isCorrect`. Use these helpers to strip it at
// the seam (service/loader) so the correct answer can never reach the solving UI.

export type SolvingAnswerOption = Omit<AnswerOption, "isCorrect">;

export type SolvingQuestion = Omit<Question, "answerOptions"> & {
  answerOptions?: SolvingAnswerOption[];
};

export function sanitizeAnswerOptionForSolving(option: AnswerOption): SolvingAnswerOption {
  // Destructure isCorrect out; keep everything else.
  const { isCorrect: _omit, ...safe } = option;
  void _omit;
  return safe;
}

/** Strip answerOptions.isCorrect from a question before it reaches a solving view. */
export function sanitizeQuestionForSolving(question: Question): SolvingQuestion {
  const { answerOptions, ...rest } = question;
  return {
    ...rest,
    answerOptions: answerOptions?.map(sanitizeAnswerOptionForSolving),
  };
}

/** Convenience for a list of questions (e.g. an attempt's questions). */
export function sanitizeQuestionsForSolving(questions: Question[]): SolvingQuestion[] {
  return questions.map(sanitizeQuestionForSolving);
}
