// Entity types matching REAL backend JSON responses (backend/prisma/schema.prisma
// + controllers). Dates serialize as ISO strings; Int/Float as number.
//
// Notes from docs/FRONTEND-NOTES.md baked in:
//  - ParticipantAnswer is serialized with an extra `textAnswer` alias (= answerText).
//  - AssessmentAttempt is serialized with an extra `participantId` alias (= userId).
//  - GET /assessments/:id returns answerOptions INCLUDING `isCorrect` even to a
//    participant (known leak) — strip it for solving views (see lib/sanitize.ts).
//  - DELETE shape: only DELETE /trainings/:id returns 204 (no body). Every other
//    delete (questions, assessments, topics, learning-objectives, equivalent-groups)
//    returns `{ message }` JSON with 200. Generic delete services should handle both
//    (apiEnsureOk works for either; apiJsonFetch returns undefined on 204).

import type {
  AiAction,
  AiProvider,
  AiReviewStatus,
  AssessmentStatus,
  AssessmentType,
  AttemptStatus,
  QuestionStatus,
  QuestionType,
  TrainingRole,
  UserRole,
} from "./enums";

export type ISODateString = string;
export type Id = number;

export interface User {
  id: Id;
  firebaseUid: string | null;
  email: string;
  name: string | null;
  externalAuthId: string | null;
  role: UserRole;
}

export interface Training {
  id: Id;
  title: string;
  description: string | null;
  /**
   * QR self-enrollment token (schema-v2). Returned to ADMIN/owner via
   * GET /trainings/:id — never render it to participants.
   */
  enrollmentToken?: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  // Relations are NOT included by GET /trainings or GET /trainings/:id.
  topics?: Topic[];
  assessments?: Assessment[];
}

/**
 * UserTraining membership row (schema-v2): role INSTRUCTOR = ownership,
 * role PARTICIPANT = enrollment. `user` is a safe projection (no firebaseUid).
 */
export interface UserTraining {
  id: Id;
  userId: Id;
  trainingId: Id;
  role: TrainingRole;
  enrolledAt: ISODateString;
  user?: Pick<User, "id" | "email" | "name" | "role">;
  training?: Training;
}

export interface Topic {
  id: Id;
  name: string;
  trainingId: Id;
  // Included only on endpoints that request them.
  training?: Training;
  questions?: Question[];
}

export interface AnswerOption {
  id: Id;
  questionId: Id;
  text: string;
  /** ⚠️ Present even to participants during solving — never render before submit. */
  isCorrect: boolean;
  orderIndex: number;
}

export interface Question {
  id: Id;
  title: string;
  description: string;
  difficulty: number;
  type: QuestionType;
  status: QuestionStatus;
  topicId: Id;
  createdById: Id;
  reviewedAt: ISODateString | null;
  equivalenceGroupId?: Id | null;
  // Included on detail / assessment includes.
  answerOptions?: AnswerOption[];
  topic?: Topic;
  equivalenceGroup?: EquivalenceGroup | null;
}

export interface EquivalenceGroup {
  id: Id;
  trainingId: Id;
  title: string | null;
  description: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  // Included only when the endpoint requests group members.
  questions?: Question[];
}

export interface Assessment {
  id: Id;
  title: string;
  description: string | null;
  trainingId: Id;
  type: AssessmentType;
  status: AssessmentStatus;
  timeLimitMinutes: number | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  training?: Training;
  questions?: AssessmentQuestion[];
  attempts?: AssessmentAttempt[];
}

export interface AssessmentQuestion {
  id: Id;
  assessmentId: Id;
  questionId: Id;
  orderIndex: number;
  points: number;
  question?: Question;
}

export interface ParticipantAnswer {
  id: Id;
  attemptId: Id;
  questionId: Id;
  selectedOptionId: Id | null;
  answerText: string | null;
  /** Serialized alias of `answerText` (same value). */
  textAnswer?: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  needsManualReview: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AssessmentAttempt {
  id: Id;
  assessmentId: Id;
  userId: Id;
  /** Serialized alias of `userId` (same value). */
  participantId?: Id;
  startedAt: ISODateString;
  submittedAt: ISODateString | null;
  score: number | null;
  maxScore: number | null;
  status: AttemptStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  answers?: ParticipantAnswer[];
  assessment?: Assessment;
}

export interface AiModel {
  id: Id;
  provider: AiProvider;
  modelName: string;
  displayName: string | null;
  baseUrl: string | null;
  isLocal: boolean;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AiInteraction {
  id: Id;
  aiModelId: Id;
  requestedById: Id;
  action: AiAction;
  prompt: string;
  resultText: string | null;
  resultJson: unknown | null;
  sourceQuestionId: Id | null;
  generatedQuestionId: Id | null;
  reviewStatus: AiReviewStatus;
  reviewedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// Response of GET /assessments/:id/results (ADMIN/INSTRUCTOR only). This is a
// BESPOKE analytics object, NOT a plain Assessment — see
// backend/controllers/assessmentController.js#getAssessmentResults. Counts are
// over SUBMITTED attempts; `*Score`/`*Percentage` are null when there are none.
export interface AssessmentResults {
  assessment: {
    id: Id;
    title: string;
    type: AssessmentType;
    status: AssessmentStatus;
    training: Training | null;
  };
  summary: {
    assignedParticipants: number | null; // currently always null (not yet computed)
    submittedAttempts: number;
    averageScore: number | null;
    averagePercentage: number | null;
  };
  attempts: Array<{
    id: Id;
    // Backend `select`: { id, name, email, role }; null when the attempt has no user.
    user: Pick<User, "id" | "name" | "email" | "role"> | null;
    status: AttemptStatus;
    score: number | null;
    maxScore: number | null;
    submittedAt: ISODateString | null;
    answersCount: number;
  }>;
  questionStats: Array<{
    questionId: Id;
    title: string | null;
    attemptsCount: number;
    correctCount: number;
    correctRate: number | null;
    averagePoints: number | null;
  }>;
}
