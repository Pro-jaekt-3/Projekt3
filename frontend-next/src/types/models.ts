// Entity types matching REAL backend JSON responses (backend/prisma/schema.prisma
// + controllers). Dates serialize as ISO strings; Int/Float as number.
//
// Notes from docs/FRONTEND-NOTES.md baked in:
//  - ParticipantAnswer is serialized with an extra `textAnswer` alias (= answerText).
//  - AssessmentAttempt is serialized with an extra `participantId` alias (= userId).
//  - GET /assessments/:id returns answerOptions INCLUDING `isCorrect` even to a
//    participant (known leak) — strip it for solving views (see lib/sanitize.ts).

import type {
  AiAction,
  AiProvider,
  AiReviewStatus,
  AssessmentStatus,
  AssessmentType,
  AttemptStatus,
  QuestionStatus,
  QuestionType,
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
  createdAt: ISODateString;
  updatedAt: ISODateString;
  // Relations are NOT included by GET /trainings or GET /trainings/:id.
  topics?: Topic[];
  assessments?: Assessment[];
}

export interface Topic {
  id: Id;
  name: string;
  trainingId: Id;
  // Included only on endpoints that request them.
  training?: Training;
  learningObjectives?: LearningObjective[];
  questions?: Question[];
}

export interface LearningObjective {
  id: Id;
  title: string;
  description: string | null;
  topicId: Id;
  topic?: Topic;
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
  learningObjectiveId: Id | null;
  createdById: Id;
  reviewedById: Id | null;
  reviewedAt: ISODateString | null;
  equivalentGroupId: Id | null;
  // Included on detail / assessment includes.
  answerOptions?: AnswerOption[];
  topic?: Topic;
  learningObjective?: LearningObjective | null;
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
  userId: Id | null;
  /** Serialized alias of `userId` (same value). */
  participantId?: Id | null;
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
  reviewedById: Id | null;
  reviewedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
