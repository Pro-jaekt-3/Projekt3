import type { Training as ApiTraining } from "@/types";

// TEMPORARY BRIDGE. The Trainings screens were built against a richer display
// shape (participants, assessments, topics, analytics…). The real backend
// Training only carries id/title/description/timestamps; everything else
// belongs to OTHER domains (topics, participants, assessments, analytics).
// This maps the real entity onto the display shape, leaving not-yet-wired
// fields at neutral defaults so the screens render unchanged.
//
// Remove this bridge incrementally as each related domain is wired (then read
// those values from their own services instead of the defaults below).

export interface TrainingViewTopic {
  id: string;
  title: string;
  objectives: Array<{ id: string; title: string; questionCount: number; avgScore: number }>;
}

export interface TrainingView {
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
  topics: TrainingViewTopic[];
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function trainingToView(t: ApiTraining): TrainingView {
  return {
    id: String(t.id),
    title: t.title,
    description: t.description ?? "",
    // --- fields owned by not-yet-wired domains: neutral placeholders ---
    instructor: "—",
    participants: 0,
    assessments: 0,
    questions: 0,
    approvedQuestions: 0,
    status: "Active",
    lastActivity: formatUpdated(t.updatedAt),
    curriculumCoverage: 0,
    avgScore: 0,
    topics: [],
  };
}
