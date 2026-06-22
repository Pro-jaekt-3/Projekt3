// Static mock data for PROJEKT3 prototype.
// All English. No real backend. Realistic CS/informatics content.

export type AssessmentStatus =
  | "Draft"
  | "Ready to Publish"
  | "Published"
  | "Open"
  | "Closed"
  | "Results Ready";

export type AssessmentType = "Pre-test" | "Regular test" | "Practice" | "Post-test";

export type QuestionStatus = "Draft" | "Needs Review" | "Approved" | "Archived";

export type QuestionType = "single" | "multiple" | "true_false" | "short" | "open" | "code";

export type Difficulty = "easy" | "medium" | "hard";

export interface Topic {
  id: string;
  title: string;
  objectives: LearningObjective[];
}

export interface LearningObjective {
  id: string;
  title: string;
  questionCount: number;
  avgScore: number;
}

export interface Training {
  id: string;
  title: string;
  description: string;
  instructor: string;
  participants: number;
  assessments: number;
  questions: number;
  approvedQuestions: number;
  status: "Active" | "Draft" | "Archived";
  lastActivity: string;
  curriculumCoverage: number; // 0-100
  avgScore: number;
  topics: Topic[];
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  status: "Active" | "Invited" | "Inactive";
  assignedAssessments: number;
  completionRate: number;
  latestScore: number | null;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  topicId: string;
  topic: string;
  objective: string;
  difficulty: Difficulty;
  status: QuestionStatus;
  variants: number;
  source: "manual" | "ai";
  lastUsed: string | null;
  training: string;
  options?: { id: string; text: string; correct: boolean }[];
  explanation?: string;
}

export interface Assessment {
  id: string;
  title: string;
  trainingId: string;
  training: string;
  instructor: string;
  type: AssessmentType;
  status: AssessmentStatus;
  assigned: number;
  submitted: number;
  avgScore: number | null;
  completionRate: number;
  createdAt: string;
  dueDate: string | null;
  timeLimit: number; // minutes
  relatedPreTestId?: string;
  accessCode?: string;
  questionIds: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "instructor" | "participant";
  status: "Active" | "Invited" | "Disabled";
  lastActive: string;
}

export interface AIModel {
  id: string;
  displayName: string;
  provider: "Ollama" | "OpenAI-compatible" | "Custom local" | "Other";
  modelId: string;
  endpoint: string;
  location: "local" | "cloud";
  enabled: boolean;
  availableToInstructors: boolean;
  contextWindow: string;
  speed: "Fast" | "Medium" | "Slow";
  quality: "Strong" | "Balanced" | "Light";
  useCases: string[];
  defaultFor: string[];
  lastTest: { status: "ok" | "warn" | "fail"; at: string };
  updatedAt: string;
}

// -----------------------------------------------------------------------------

export const TOPICS: Topic[] = [
  {
    id: "t-sql",
    title: "SQL Basics",
    objectives: [
      { id: "lo-1", title: "Write basic SELECT queries", questionCount: 12, avgScore: 78 },
      { id: "lo-2", title: "Filter rows using WHERE", questionCount: 8, avgScore: 81 },
      { id: "lo-3", title: "Sort and limit results", questionCount: 6, avgScore: 84 },
    ],
  },
  {
    id: "t-joins",
    title: "Joins",
    objectives: [
      { id: "lo-4", title: "Use INNER JOIN correctly", questionCount: 7, avgScore: 58 },
      { id: "lo-5", title: "Distinguish LEFT and RIGHT JOIN", questionCount: 5, avgScore: 52 },
      { id: "lo-6", title: "Resolve ambiguous columns", questionCount: 4, avgScore: 49 },
    ],
  },
  {
    id: "t-norm",
    title: "Normalization",
    objectives: [
      { id: "lo-7", title: "Explain primary and foreign keys", questionCount: 6, avgScore: 71 },
      { id: "lo-8", title: "Normalize a table to 3NF", questionCount: 5, avgScore: 64 },
    ],
  },
];

export const TRAININGS: Training[] = [
  {
    id: "tr-db",
    title: "Introduction to Databases",
    description:
      "Foundations of relational databases, SQL querying, joins and normalization for first-year informatics students.",
    instructor: "Marko Novak",
    participants: 28,
    assessments: 4,
    questions: 42,
    approvedQuestions: 36,
    status: "Active",
    lastActivity: "2 hours ago",
    curriculumCoverage: 82,
    avgScore: 71,
    topics: TOPICS,
  },
  {
    id: "tr-web",
    title: "Web Development Basics",
    description: "HTTP, REST, request/response model, and modern web fundamentals.",
    instructor: "Marko Novak",
    participants: 22,
    assessments: 2,
    questions: 24,
    approvedQuestions: 18,
    status: "Active",
    lastActivity: "yesterday",
    curriculumCoverage: 64,
    avgScore: 68,
    topics: [],
  },
  {
    id: "tr-prog",
    title: "Programming Fundamentals",
    description: "Variables, control flow, functions and basic algorithms in JavaScript.",
    instructor: "Marko Novak",
    participants: 35,
    assessments: 3,
    questions: 38,
    approvedQuestions: 30,
    status: "Active",
    lastActivity: "3 days ago",
    curriculumCoverage: 75,
    avgScore: 74,
    topics: [],
  },
];

export const PARTICIPANTS: Participant[] = [
  {
    id: "p1",
    name: "Eva Horvat",
    email: "eva.student@projekt3.app",
    status: "Active",
    assignedAssessments: 3,
    completionRate: 100,
    latestScore: 76,
  },
  {
    id: "p2",
    name: "Luka Zupan",
    email: "luka.z@projekt3.app",
    status: "Active",
    assignedAssessments: 3,
    completionRate: 67,
    latestScore: 62,
  },
  {
    id: "p3",
    name: "Maja Kralj",
    email: "maja.k@projekt3.app",
    status: "Active",
    assignedAssessments: 3,
    completionRate: 100,
    latestScore: 88,
  },
  {
    id: "p4",
    name: "Tilen Vidmar",
    email: "tilen.v@projekt3.app",
    status: "Active",
    assignedAssessments: 3,
    completionRate: 33,
    latestScore: 54,
  },
  {
    id: "p5",
    name: "Nika Šuštar",
    email: "nika.s@projekt3.app",
    status: "Active",
    assignedAssessments: 3,
    completionRate: 100,
    latestScore: 91,
  },
  {
    id: "p6",
    name: "Jure Petrič",
    email: "jure.p@projekt3.app",
    status: "Active",
    assignedAssessments: 3,
    completionRate: 67,
    latestScore: 70,
  },
  {
    id: "p7",
    name: "Sara Mlakar",
    email: "sara.m@projekt3.app",
    status: "Active",
    assignedAssessments: 3,
    completionRate: 100,
    latestScore: 82,
  },
  {
    id: "p8",
    name: "Tim Kos",
    email: "tim.k@projekt3.app",
    status: "Invited",
    assignedAssessments: 0,
    completionRate: 0,
    latestScore: null,
  },
];

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    text: "Which SQL clause is used to filter rows before grouping?",
    type: "single",
    topicId: "t-sql",
    topic: "SQL Basics",
    objective: "Filter rows using WHERE",
    difficulty: "easy",
    status: "Approved",
    variants: 2,
    source: "manual",
    lastUsed: "3 days ago",
    training: "Introduction to Databases",
    options: [
      { id: "a", text: "HAVING", correct: false },
      { id: "b", text: "WHERE", correct: true },
      { id: "c", text: "GROUP BY", correct: false },
      { id: "d", text: "ORDER BY", correct: false },
    ],
    explanation:
      "WHERE filters individual rows before grouping. HAVING filters groups after GROUP BY.",
  },
  {
    id: "q2",
    text: "What is the purpose of a foreign key?",
    type: "single",
    topicId: "t-norm",
    topic: "Normalization",
    objective: "Explain primary and foreign keys",
    difficulty: "medium",
    status: "Approved",
    variants: 1,
    source: "manual",
    lastUsed: "1 week ago",
    training: "Introduction to Databases",
    options: [
      { id: "a", text: "To uniquely identify rows in its own table", correct: false },
      { id: "b", text: "To enforce a relationship to another table", correct: true },
      { id: "c", text: "To speed up SELECT queries", correct: false },
      { id: "d", text: "To enforce NOT NULL constraints", correct: false },
    ],
    explanation:
      "A foreign key references the primary key of another table and enforces referential integrity.",
  },
  {
    id: "q3",
    text: "Which join returns only rows that have matches in both tables?",
    type: "single",
    topicId: "t-joins",
    topic: "Joins",
    objective: "Use INNER JOIN correctly",
    difficulty: "easy",
    status: "Approved",
    variants: 1,
    source: "manual",
    lastUsed: "3 days ago",
    training: "Introduction to Databases",
    options: [
      { id: "a", text: "LEFT JOIN", correct: false },
      { id: "b", text: "RIGHT JOIN", correct: false },
      { id: "c", text: "INNER JOIN", correct: true },
      { id: "d", text: "FULL OUTER JOIN", correct: false },
    ],
    explanation: "INNER JOIN returns only matched rows from both tables.",
  },
  {
    id: "q4",
    text: "Given tables users(id, name) and orders(id, user_id), which join lists every user, even those with no orders?",
    type: "single",
    topicId: "t-joins",
    topic: "Joins",
    objective: "Distinguish LEFT and RIGHT JOIN",
    difficulty: "medium",
    status: "Approved",
    variants: 0,
    source: "manual",
    lastUsed: null,
    training: "Introduction to Databases",
    options: [
      { id: "a", text: "users INNER JOIN orders", correct: false },
      { id: "b", text: "users LEFT JOIN orders", correct: true },
      { id: "c", text: "users RIGHT JOIN orders", correct: false },
      { id: "d", text: "users CROSS JOIN orders", correct: false },
    ],
    explanation:
      "LEFT JOIN keeps all rows from the left table (users) even without a match in orders.",
  },
  {
    id: "q5",
    text: "Write a SQL query that selects all users with status 'active'.",
    type: "short",
    topicId: "t-sql",
    topic: "SQL Basics",
    objective: "Write basic SELECT queries",
    difficulty: "easy",
    status: "Approved",
    variants: 1,
    source: "manual",
    lastUsed: "1 week ago",
    training: "Introduction to Databases",
    explanation: "Expected: SELECT * FROM users WHERE status = 'active';",
  },
  {
    id: "q6",
    text: "Normalize the following table to 3NF: orders(order_id, customer_name, customer_email, product, price).",
    type: "open",
    topicId: "t-norm",
    topic: "Normalization",
    objective: "Normalize a table to 3NF",
    difficulty: "hard",
    status: "Needs Review",
    variants: 0,
    source: "ai",
    lastUsed: null,
    training: "Introduction to Databases",
  },
  {
    id: "q7",
    text: "True or false: HAVING can be used without GROUP BY.",
    type: "true_false",
    topicId: "t-sql",
    topic: "SQL Basics",
    objective: "Filter rows using WHERE",
    difficulty: "medium",
    status: "Draft",
    variants: 0,
    source: "ai",
    lastUsed: null,
    training: "Introduction to Databases",
  },
  {
    id: "q8",
    text: "Which HTTP method is usually used to update an existing resource?",
    type: "single",
    topicId: "t-sql",
    topic: "HTTP and REST",
    objective: "Understand REST endpoints",
    difficulty: "easy",
    status: "Approved",
    variants: 1,
    source: "manual",
    lastUsed: "5 days ago",
    training: "Web Development Basics",
    options: [
      { id: "a", text: "GET", correct: false },
      { id: "b", text: "POST", correct: false },
      { id: "c", text: "PUT", correct: true },
      { id: "d", text: "DELETE", correct: false },
    ],
    explanation: "PUT is the conventional method for updating (replacing) an existing resource.",
  },
];

export const ASSESSMENTS: Assessment[] = [
  {
    id: "a1",
    title: "Databases — Pre-test",
    trainingId: "tr-db",
    training: "Introduction to Databases",
    instructor: "Marko Novak",
    type: "Pre-test",
    status: "Results Ready",
    assigned: 28,
    submitted: 26,
    avgScore: 64,
    completionRate: 93,
    createdAt: "Oct 12, 2026",
    dueDate: "Oct 18, 2026",
    timeLimit: 30,
    accessCode: "PRJ-DB-PRE",
    questionIds: ["q1", "q2", "q3", "q4", "q5"],
  },
  {
    id: "a2",
    title: "SQL Joins — Practice",
    trainingId: "tr-db",
    training: "Introduction to Databases",
    instructor: "Marko Novak",
    type: "Practice",
    status: "Open",
    assigned: 28,
    submitted: 14,
    avgScore: 71,
    completionRate: 50,
    createdAt: "Oct 21, 2026",
    dueDate: "Nov 3, 2026",
    timeLimit: 20,
    accessCode: "PRJ-DB-JN",
    questionIds: ["q3", "q4"],
  },
  {
    id: "a3",
    title: "Databases — Post-test",
    trainingId: "tr-db",
    training: "Introduction to Databases",
    instructor: "Marko Novak",
    type: "Post-test",
    status: "Draft",
    assigned: 0,
    submitted: 0,
    avgScore: null,
    completionRate: 0,
    createdAt: "Today",
    dueDate: null,
    timeLimit: 30,
    relatedPreTestId: "a1",
    questionIds: ["q1", "q2", "q3", "q4"],
  },
  {
    id: "a4",
    title: "Web Basics — Pre-test",
    trainingId: "tr-web",
    training: "Web Development Basics",
    instructor: "Marko Novak",
    type: "Pre-test",
    status: "Published",
    assigned: 22,
    submitted: 0,
    avgScore: null,
    completionRate: 0,
    createdAt: "Oct 28, 2026",
    dueDate: "Nov 5, 2026",
    timeLimit: 25,
    accessCode: "PRJ-WB-PRE",
    questionIds: ["q8"],
  },
];

export const USERS: User[] = [
  {
    id: "u1",
    name: "Ana Kovač",
    email: "ana.admin@projekt3.app",
    role: "admin",
    status: "Active",
    lastActive: "10 min ago",
  },
  {
    id: "u2",
    name: "Marko Novak",
    email: "marko.instructor@projekt3.app",
    role: "instructor",
    status: "Active",
    lastActive: "2 hours ago",
  },
  {
    id: "u3",
    name: "Petra Mohorič",
    email: "petra.m@projekt3.app",
    role: "instructor",
    status: "Active",
    lastActive: "yesterday",
  },
  {
    id: "u4",
    name: "Eva Horvat",
    email: "eva.student@projekt3.app",
    role: "participant",
    status: "Active",
    lastActive: "30 min ago",
  },
  {
    id: "u5",
    name: "Luka Zupan",
    email: "luka.z@projekt3.app",
    role: "participant",
    status: "Active",
    lastActive: "1 hour ago",
  },
  {
    id: "u6",
    name: "Tim Kos",
    email: "tim.k@projekt3.app",
    role: "participant",
    status: "Invited",
    lastActive: "never",
  },
  {
    id: "u7",
    name: "Mojca Ribič",
    email: "mojca.r@projekt3.app",
    role: "instructor",
    status: "Disabled",
    lastActive: "3 weeks ago",
  },
];

export const AI_MODELS: AIModel[] = [
  {
    id: "m1",
    displayName: "gpt-oss:120b",
    provider: "Ollama",
    modelId: "gpt-oss:120b",
    endpoint: "http://localhost:11434",
    location: "local",
    enabled: true,
    availableToInstructors: true,
    contextWindow: "32k tokens",
    speed: "Medium",
    quality: "Strong",
    useCases: ["Equivalence checking", "Question rewriting", "Explanation generation"],
    defaultFor: ["Equivalence checking"],
    lastTest: { status: "ok", at: "2 hours ago" },
    updatedAt: "Oct 30, 2026",
  },
  {
    id: "m2",
    displayName: "Fast Draft Model",
    provider: "Ollama",
    modelId: "llama3.1:8b",
    endpoint: "http://localhost:11434",
    location: "local",
    enabled: true,
    availableToInstructors: true,
    contextWindow: "8k tokens",
    speed: "Fast",
    quality: "Light",
    useCases: ["Question drafting", "Equivalent question generation"],
    defaultFor: ["Question drafting"],
    lastTest: { status: "ok", at: "1 day ago" },
    updatedAt: "Oct 18, 2026",
  },
  {
    id: "m3",
    displayName: "Cloud Reasoning",
    provider: "OpenAI-compatible",
    modelId: "gpt-4o-mini",
    endpoint: "https://api.openai.com/v1",
    location: "cloud",
    enabled: true,
    availableToInstructors: true,
    contextWindow: "128k tokens",
    speed: "Fast",
    quality: "Strong",
    useCases: ["Programming/code questions", "Explanation generation"],
    defaultFor: ["Programming/code questions"],
    lastTest: { status: "ok", at: "3 hours ago" },
    updatedAt: "Oct 22, 2026",
  },
  {
    id: "m4",
    displayName: "Legacy Local",
    provider: "Custom local",
    modelId: "mistral-7b-old",
    endpoint: "http://localhost:8080",
    location: "local",
    enabled: false,
    availableToInstructors: false,
    contextWindow: "4k tokens",
    speed: "Slow",
    quality: "Light",
    useCases: ["Question drafting"],
    defaultFor: [],
    lastTest: { status: "warn", at: "2 weeks ago" },
    updatedAt: "Sep 5, 2026",
  },
];

export function getTraining(id: string) {
  return TRAININGS.find((t) => t.id === id);
}
export function getAssessment(id: string) {
  return ASSESSMENTS.find((a) => a.id === id);
}
export function getQuestion(id: string) {
  return QUESTIONS.find((q) => q.id === id);
}
export function assessmentsForTraining(id: string) {
  return ASSESSMENTS.filter((a) => a.trainingId === id);
}
export function questionsForTraining(title: string) {
  return QUESTIONS.filter((q) => q.training === title);
}

// Participant-facing assessment view
export interface ParticipantAssessment {
  id: string;
  title: string;
  training: string;
  type: AssessmentType;
  status: "To do" | "In progress" | "Completed";
  due: string | null;
  timeLimit: number;
  score?: number;
  submittedAt?: string;
}

export const MY_ASSESSMENTS: ParticipantAssessment[] = [
  {
    id: "a1",
    title: "Databases — Pre-test",
    training: "Introduction to Databases",
    type: "Pre-test",
    status: "Completed",
    due: "Oct 18, 2026",
    timeLimit: 30,
    score: 76,
    submittedAt: "Oct 17, 2026",
  },
  {
    id: "a2",
    title: "SQL Joins — Practice",
    training: "Introduction to Databases",
    type: "Practice",
    status: "In progress",
    due: "Nov 3, 2026",
    timeLimit: 20,
  },
  {
    id: "a4",
    title: "Web Basics — Pre-test",
    training: "Web Development Basics",
    type: "Pre-test",
    status: "To do",
    due: "Nov 5, 2026",
    timeLimit: 25,
  },
];

// Mock per-question results for an assessment
export const TOPIC_PERFORMANCE = [
  { topic: "SQL Basics", score: 81 },
  { topic: "Joins", score: 49 },
  { topic: "Normalization", score: 68 },
];

export const DIFFICULTY_PERFORMANCE = [
  { difficulty: "Easy", score: 84 },
  { difficulty: "Medium", score: 67 },
  { difficulty: "Hard", score: 48 },
];

export const PRE_POST_COMPARISON = [
  { topic: "SQL Basics", pre: 62, post: 81 },
  { topic: "Joins", pre: 38, post: 64 },
  { topic: "Normalization", pre: 55, post: 72 },
];

export const PROGRESS_OVER_TIME = [
  { date: "Sep", score: 52 },
  { date: "Oct (pre)", score: 64 },
  { date: "Oct (practice)", score: 71 },
  { date: "Nov (post)", score: 78 },
];

export const SCORE_DISTRIBUTION = [
  { bucket: "0–20", count: 0 },
  { bucket: "21–40", count: 2 },
  { bucket: "41–60", count: 6 },
  { bucket: "61–80", count: 12 },
  { bucket: "81–100", count: 6 },
];

export const RECENT_ACTIVITY = [
  { who: "Eva Horvat", what: "submitted Databases — Pre-test", when: "10 min ago" },
  { who: "AI draft", what: "generated 3 question drafts in SQL Joins", when: "1 hour ago" },
  { who: "Marko Novak", what: "approved 2 questions in Normalization", when: "2 hours ago" },
  { who: "Luka Zupan", what: "started SQL Joins — Practice", when: "3 hours ago" },
];
