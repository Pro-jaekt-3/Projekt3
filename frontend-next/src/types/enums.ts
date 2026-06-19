// Enums mirrored 1:1 from backend/prisma/schema.prisma (the source of truth).
// Keep these in sync with the Prisma enums; backend serializes the enum names.

export type UserRole = "ADMIN" | "INSTRUCTOR" | "PARTICIPANT";

export type QuestionType = "OPEN" | "MULTIPLE_CHOICE" | "CODE";

export type QuestionStatus =
  | "DRAFT"
  | "NEEDS_REVIEW"
  | "REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED";

export type AiAction =
  | "GENERATE_QUESTION"
  | "EDIT_QUESTION"
  | "GENERATE_EQUIVALENT_QUESTION"
  | "CHECK_EQUIVALENCE"
  | "CHECK_QUESTION_QUALITY"
  | "REVIEW_TEST"
  | "GENERATE_SYNTHETIC_DATA";

export type AiReviewStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type AiProvider = "OLLAMA" | "OPENAI" | "DEEPSEEK" | "OTHER";

export type AssessmentType = "PRE_TEST" | "POST_TEST" | "QUIZ";

export type AssessmentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "GRADED";
