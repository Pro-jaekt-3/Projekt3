import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { assessmentsService } from "@/services/assessments";
import { assessmentAttemptsService } from "@/services/assessmentAttempts";
import { ensureRole } from "@/lib/route-guards";
import type {
  AssessmentAttempt,
  AssessmentResults,
  AssessmentStatus,
  AssessmentType,
  AttemptStatus,
  ParticipantAnswer,
  QuestionType,
} from "@/types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/app/assessments/$id/results")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: AssessmentResultsPage,
});

function AssessmentResultsPage() {
  const { id } = Route.useParams();
  const [selectedAttemptId, setSelectedAttemptId] = useState<number | null>(null);
  const resultsQueryKey = [...qk.assessments.detail(id), "results"] as const;

  // Per-assessment results are a bespoke analytics payload (AssessmentResults),
  // not a plain Assessment. ADMIN/INSTRUCTOR only (enforced by ensureRole + backend).
  // Distinct cache key (assessment detail key + "results") so it never collides with
  // the plain assessment-detail query.
  const resultsQuery = useQuery({
    queryKey: resultsQueryKey,
    queryFn: () => assessmentsService.getResults(id),
  });

  if (resultsQuery.isLoading) {
    return <LoadingState label="Loading results…" />;
  }

  if (resultsQuery.isError || !resultsQuery.data) {
    const message =
      resultsQuery.error instanceof Error ? resultsQuery.error.message : "Failed to load results";
    if (/not found/i.test(message)) {
      return (
        <div className="p-8">
          <EmptyState
            title="Assessment not found"
            description="The assessment you are looking for does not exist or has been removed."
          />
        </div>
      );
    }
    return <ErrorState message={message} onRetry={() => resultsQuery.refetch()} />;
  }

  const results = resultsQuery.data;
  const { assessment, summary, attempts, questionStats } = results;
  const selectedAttemptSummary =
    selectedAttemptId !== null
      ? attempts.find((attempt) => attempt.id === selectedAttemptId) ?? null
      : null;

  // Analytics are computed over SUBMITTED attempts (docs/FRONTEND-NOTES.md). Until
  // anyone submits, everything is empty/zero — show a clear empty state.
  if (attempts.length === 0) {
    return (
      <>
        <ResultsHeader id={id} assessment={assessment} />
        <div className="p-4 sm:p-6 lg:p-8">
          <EmptyState
            title="No attempts yet"
            description="Results appear once participants start and submit this assessment."
          />
        </div>
      </>
    );
  }

  const scoreDistribution = buildScoreDistribution(attempts);
  const hasSubmissions = summary.submittedAttempts > 0;

  return (
    <>
      <ResultsHeader id={id} assessment={assessment} />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            label="Submitted"
            value={summary.submittedAttempts}
            hint={`${attempts.length} total attempt${attempts.length !== 1 ? "s" : ""}`}
          />
          <MetricCard
            label="Avg score"
            value={
              summary.averagePercentage !== null ? `${Math.round(summary.averagePercentage)}%` : "—"
            }
            hint={
              summary.averageScore !== null ? `${roundTo1(summary.averageScore)} avg points` : "awaiting submissions"
            }
          />
          <MetricCard label="Questions" value={questionStats.length} />
          <MetricCard
            label="Assigned"
            value={summary.assignedParticipants ?? "—"}
            hint={summary.assignedParticipants === null ? "not tracked yet" : undefined}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {scoreDistribution.some((bucket) => bucket.count > 0) ? (
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--primary)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Score distribution appears once at least one submitted attempt has a numeric score.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question statistics</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead className="text-right">Correct %</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Avg points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questionStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8">
                      <EmptyState
                        title="No question data"
                        description="This assessment does not have any questions to report on."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  questionStats.map((stat, index) => (
                    <TableRow key={stat.questionId}>
                      <TableCell className="max-w-md">
                        <span className="line-clamp-2 font-medium">
                          {stat.title ?? `Question ${index + 1}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{stat.attemptsCount}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {stat.correctRate !== null ? `${Math.round(stat.correctRate)}%` : "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right tabular-nums">
                        {stat.averagePoints !== null ? roundTo1(stat.averagePoints) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Participant attempts</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="hidden md:table-cell">Submitted</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Answers</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => {
                  const status = attemptStatusMeta(attempt.status);
                  return (
                    <TableRow
                      key={attempt.id}
                      className={cn(selectedAttemptId === attempt.id && "bg-muted/30")}
                    >
                      <TableCell>
                        <div className="font-medium">{attempt.user?.name ?? "Unknown participant"}</div>
                        <div className="text-xs text-muted-foreground">
                          {attempt.user?.email ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge status={status.label} tone={status.tone} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {scorePercentage(attempt.score, attempt.maxScore) ?? "Pending"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums">
                        {attempt.answersCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={selectedAttemptId === attempt.id ? "default" : "outline"}
                          onClick={() =>
                            setSelectedAttemptId((current) =>
                              current === attempt.id ? null : attempt.id,
                            )
                          }
                        >
                          {selectedAttemptId === attempt.id ? "Hide" : "Review"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="border-t px-4 py-4 sm:px-6">
            {selectedAttemptSummary ? (
              <AttemptReviewPanel
                assessmentId={id}
                attemptId={selectedAttemptSummary.id}
                participantName={selectedAttemptSummary.user?.name ?? "Unknown participant"}
                participantEmail={selectedAttemptSummary.user?.email ?? null}
                resultsQueryKey={resultsQueryKey}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Select an attempt to review submitted answers and manually grade open/code responses.
              </p>
            )}
          </div>
        </Card>

        {!hasSubmissions && (
          <p className="text-sm text-muted-foreground">
            No submitted attempts yet — aggregate metrics will populate once participants submit.
          </p>
        )}
      </div>
    </>
  );
}

function AttemptReviewPanel({
  assessmentId,
  attemptId,
  participantName,
  participantEmail,
  resultsQueryKey,
}: {
  assessmentId: string;
  attemptId: number;
  participantName: string;
  participantEmail: string | null;
  resultsQueryKey: readonly unknown[];
}) {
  const queryClient = useQueryClient();

  const attemptQuery = useQuery({
    queryKey: qk.assessmentAttempts.detail(attemptId),
    queryFn: () => assessmentAttemptsService.get(attemptId),
  });

  const gradeMutation = useMutation({
    mutationFn: ({
      answerId,
      isCorrect,
      pointsAwarded,
    }: {
      answerId: number;
      isCorrect: boolean;
      pointsAwarded: number;
    }) =>
      assessmentAttemptsService.gradeAnswer(attemptId, answerId, {
        isCorrect,
        pointsAwarded,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.assessmentAttempts.detail(attemptId) }),
        queryClient.invalidateQueries({ queryKey: resultsQueryKey }),
        queryClient.invalidateQueries({ queryKey: qk.assessments.detail(assessmentId) }),
      ]);
      toast.success("Manual grade saved");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save manual grade");
    },
  });

  if (attemptQuery.isLoading) {
    return <LoadingState label="Loading attempt review…" />;
  }

  if (attemptQuery.isError || !attemptQuery.data) {
    const message =
      attemptQuery.error instanceof Error ? attemptQuery.error.message : "Failed to load attempt";
    if (/forbidden|403/i.test(message)) {
      return (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          You do not have access to review this attempt.
        </div>
      );
    }
    return <ErrorState message={message} onRetry={() => attemptQuery.refetch()} />;
  }

  const attempt = attemptQuery.data;
  const questionItems = attempt.assessment?.questions ?? [];
  const answers = attempt.answers ?? [];
  const manualQuestionItems = questionItems.filter(
    (item) => item.question?.type === "OPEN" || item.question?.type === "CODE",
  );
  const pendingManualCount = manualQuestionItems.filter((item) => {
    const answer = answers.find((entry) => entry.questionId === item.questionId);
    return answer?.needsManualReview && answer.isCorrect === null;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Attempt review</div>
          <div className="text-sm font-semibold sm:text-base">{participantName}</div>
          <div className="text-xs text-muted-foreground">{participantEmail ?? "—"}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge
              status={attemptStatusMeta(attempt.status).label}
              tone={attemptStatusMeta(attempt.status).tone}
            />
            <span>·</span>
            <span>{attempt.submittedAt ? `Submitted ${formatDateTime(attempt.submittedAt)}` : "In progress"}</span>
            <span>·</span>
            <span>
              {scoreWithPoints(attempt.score, attempt.maxScore) ?? "Score updates after grading"}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-56">
          <MetricCard
            label="Manual review"
            value={manualQuestionItems.length}
            hint={
              pendingManualCount > 0
                ? `${pendingManualCount} still pending`
                : manualQuestionItems.length > 0
                  ? "All reviewed"
                  : "No manual grading needed"
            }
          />
          <MetricCard
            label="Attempt status"
            value={attempt.status === "GRADED" ? "Graded" : attempt.status === "SUBMITTED" ? "Submitted" : "In progress"}
          />
        </div>
      </div>

      {questionItems.length === 0 ? (
        <EmptyState
          title="No answer detail available"
          description="This attempt does not include question-level data to review."
        />
      ) : (
        <div className="space-y-3">
          {questionItems.map((item, index) => {
            const answer = answers.find((entry) => entry.questionId === item.questionId) ?? null;
            const questionTitle = item.question?.title ?? `Question ${index + 1}`;
            const maxPoints = Number(item.points ?? 0);
            const type = item.question?.type ?? "OPEN";
            const selectedOption =
              type === "MULTIPLE_CHOICE" && answer?.selectedOptionId
                ? item.question?.answerOptions?.find((option) => option.id === answer.selectedOptionId) ?? null
                : null;
            const canManuallyGrade =
              answer !== null &&
              (type === "OPEN" || type === "CODE") &&
              answer.needsManualReview &&
              answer.isCorrect === null;
            const gradingBusy =
              gradeMutation.isPending && gradeMutation.variables?.answerId === answer?.id;

            return (
              <Card key={item.id}>
                <CardHeader className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        Question {index + 1} · {questionTypeLabel(type)}
                      </div>
                      <CardTitle className="text-base">{questionTitle}</CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        status={answerStateLabel(type, answer)}
                        tone={answerStateTone(type, answer)}
                      />
                      <StatusBadge
                        status={
                          typeof answer?.pointsAwarded === "number"
                            ? `${answer.pointsAwarded} / ${maxPoints} pts`
                            : `${maxPoints} pts`
                        }
                        tone="muted"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AnswerPreview
                    answer={answer}
                    selectedOptionText={selectedOption?.text ?? null}
                    type={type}
                  />

                  {type === "MULTIPLE_CHOICE" ? (
                    <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
                      Multiple-choice answers are graded automatically and cannot be changed here.
                    </div>
                  ) : canManuallyGrade && answer ? (
                    <ManualGradeForm
                      answer={answer}
                      maxPoints={maxPoints}
                      isSaving={gradingBusy}
                      onSubmit={(input) => gradeMutation.mutate(input)}
                    />
                  ) : (
                    <ReviewedAnswerSummary answer={answer} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnswerPreview({
  answer,
  selectedOptionText,
  type,
}: {
  answer: ParticipantAnswer | null;
  selectedOptionText: string | null;
  type: QuestionType;
}) {
  if (!answer) {
    return (
      <div className="rounded-md border border-dashed bg-card p-3 text-sm text-muted-foreground">
        No answer was submitted for this question.
      </div>
    );
  }

  if (type === "MULTIPLE_CHOICE") {
    return (
      <div className="rounded-md border bg-card p-3 text-sm">
        <div className="text-xs text-muted-foreground">Selected option</div>
        <div className="mt-1 font-medium">{selectedOptionText ?? "Unknown option"}</div>
        <div className="mt-2 text-xs text-muted-foreground">
          {answer.isCorrect === true
            ? "Marked correct automatically."
            : answer.isCorrect === false
              ? "Marked incorrect automatically."
              : "Awaiting scoring."}
        </div>
      </div>
    );
  }

  const answerText = answer.textAnswer ?? answer.answerText ?? "";
  return (
    <div className="rounded-md border bg-card p-3 text-sm">
      <div className="text-xs text-muted-foreground">
        {type === "CODE" ? "Submitted code" : "Submitted response"}
      </div>
      <pre
        className={cn(
          "mt-2 whitespace-pre-wrap break-words text-sm",
          type === "CODE" && "overflow-x-auto rounded bg-muted/40 p-3 font-mono text-xs sm:text-sm",
        )}
      >
        {answerText || "No written response provided."}
      </pre>
    </div>
  );
}

function ManualGradeForm({
  answer,
  maxPoints,
  isSaving,
  onSubmit,
}: {
  answer: ParticipantAnswer;
  maxPoints: number;
  isSaving: boolean;
  onSubmit: (input: { answerId: number; isCorrect: boolean; pointsAwarded: number }) => void;
}) {
  const [decision, setDecision] = useState<"correct" | "incorrect" | null>(
    answer.isCorrect === true ? "correct" : answer.isCorrect === false ? "incorrect" : null,
  );
  const [pointsAwarded, setPointsAwarded] = useState(
    typeof answer.pointsAwarded === "number" ? String(answer.pointsAwarded) : "",
  );

  useEffect(() => {
    setDecision(answer.isCorrect === true ? "correct" : answer.isCorrect === false ? "incorrect" : null);
    setPointsAwarded(typeof answer.pointsAwarded === "number" ? String(answer.pointsAwarded) : "");
  }, [answer.id, answer.isCorrect, answer.pointsAwarded]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (decision === null) {
      toast.error("Select whether the answer is correct or incorrect.");
      return;
    }

    const parsedPoints = Number(pointsAwarded);
    if (!Number.isFinite(parsedPoints)) {
      toast.error("Enter points awarded before saving.");
      return;
    }

    if (parsedPoints < 0 || parsedPoints > maxPoints) {
      toast.error(`Points awarded must be between 0 and ${maxPoints}.`);
      return;
    }

    onSubmit({
      answerId: answer.id,
      isCorrect: decision === "correct",
      pointsAwarded: parsedPoints,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border bg-card p-4">
      <div className="space-y-2">
        <div className="text-sm font-medium">Manual grading</div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={decision === "correct" ? "default" : "outline"}
            onClick={() => setDecision("correct")}
            disabled={isSaving}
          >
            Correct
          </Button>
          <Button
            type="button"
            size="sm"
            variant={decision === "incorrect" ? "default" : "outline"}
            onClick={() => setDecision("incorrect")}
            disabled={isSaving}
          >
            Incorrect
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`points-${answer.id}`}>
          Points awarded
        </label>
        <Input
          id={`points-${answer.id}`}
          type="number"
          min={0}
          max={maxPoints}
          step="0.5"
          value={pointsAwarded}
          onChange={(event) => setPointsAwarded(event.target.value)}
          disabled={isSaving}
        />
        <p className="text-xs text-muted-foreground">Allowed range: 0 to {maxPoints} points.</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save grade"}
        </Button>
      </div>
    </form>
  );
}

function ReviewedAnswerSummary({ answer }: { answer: ParticipantAnswer | null }) {
  if (!answer) {
    return null;
  }

  if (answer.isCorrect === null && answer.needsManualReview) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        This answer still needs manual review.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
      <div className="font-medium text-foreground">Manual review completed</div>
      <div className="mt-1">
        {answer.isCorrect === true
          ? "Marked correct."
          : answer.isCorrect === false
            ? "Marked incorrect."
            : "Grading saved."}
      </div>
    </div>
  );
}

function ResultsHeader({
  id,
  assessment,
}: {
  id: string;
  assessment: AssessmentResults["assessment"];
}) {
  return (
    <PageHeader
      breadcrumbs={
        <>
          <Link to="/app/assessments" className="hover:underline">
            Assessments
          </Link>
          <span className="mx-1">/</span>
          <Link to="/app/assessments/$id" params={{ id }} className="hover:underline">
            {assessment.title}
          </Link>
        </>
      }
      title="Results"
      meta={
        <>
          <StatusBadge status={assessmentStatusLabel(assessment.status)} tone="info" />
          <span>·</span>
          <span>{assessment.training?.title ?? "No training"}</span>
          <span>·</span>
          <span>{assessmentTypeLabel(assessment.type)}</span>
        </>
      }
      actions={
        <Button asChild size="sm">
          <Link to="/app/assessments/$id/post-test" params={{ id }}>
            <Sparkles className="mr-1.5 h-4 w-4" /> Create post-test
          </Link>
        </Button>
      }
    />
  );
}

const SCORE_BUCKETS = [
  { bucket: "0–20", min: 0, max: 20 },
  { bucket: "21–40", min: 21, max: 40 },
  { bucket: "41–60", min: 41, max: 60 },
  { bucket: "61–80", min: 61, max: 80 },
  { bucket: "81–100", min: 81, max: 100 },
];

function buildScoreDistribution(attempts: AssessmentResults["attempts"]) {
  const buckets = SCORE_BUCKETS.map((bucket) => ({ bucket: bucket.bucket, count: 0 }));
  for (const attempt of attempts) {
    if (
      typeof attempt.score !== "number" ||
      typeof attempt.maxScore !== "number" ||
      attempt.maxScore <= 0
    ) {
      continue;
    }
    const pct = (attempt.score / attempt.maxScore) * 100;
    const index = SCORE_BUCKETS.findIndex((bucket) => pct >= bucket.min && pct <= bucket.max);
    if (index >= 0) buckets[index].count += 1;
  }
  return buckets;
}

function scorePercentage(score: number | null, maxScore: number | null) {
  if (typeof score !== "number" || typeof maxScore !== "number" || maxScore <= 0) return null;
  return `${Math.round((score / maxScore) * 100)}%`;
}

function scoreWithPoints(score: number | null, maxScore: number | null) {
  const percentage = scorePercentage(score, maxScore);
  if (typeof score !== "number" || typeof maxScore !== "number") return percentage;
  if (!percentage) return `${score} / ${maxScore} points`;
  return `${score} / ${maxScore} points (${percentage})`;
}

function attemptStatusMeta(status: AttemptStatus): {
  label: string;
  tone: "success" | "info" | "muted";
} {
  if (status === "GRADED") return { label: "Graded", tone: "success" };
  if (status === "SUBMITTED") return { label: "Submitted", tone: "info" };
  return { label: "In progress", tone: "muted" };
}

function answerStateLabel(type: QuestionType, answer: ParticipantAnswer | null) {
  if (!answer) return "No answer";
  if (type === "MULTIPLE_CHOICE") return "Auto-graded";
  if (answer.isCorrect === null && answer.needsManualReview) return "Needs manual review";
  return "Manual review complete";
}

function answerStateTone(
  type: QuestionType,
  answer: ParticipantAnswer | null,
): "danger" | "muted" | "success" | "warning" {
  if (!answer) return "muted";
  if (type === "MULTIPLE_CHOICE") return answer.isCorrect === false ? "danger" : "success";
  if (answer.isCorrect === null && answer.needsManualReview) return "warning";
  return "success";
}

function assessmentTypeLabel(type: AssessmentType) {
  if (type === "PRE_TEST") return "Pre-test";
  if (type === "POST_TEST") return "Post-test";
  return "Quiz";
}

function questionTypeLabel(type: QuestionType) {
  if (type === "MULTIPLE_CHOICE") return "Multiple choice";
  if (type === "CODE") return "Code";
  return "Open";
}

function assessmentStatusLabel(status: AssessmentStatus) {
  if (status === "DRAFT") return "Draft";
  if (status === "PUBLISHED") return "Published";
  return "Archived";
}

function roundTo1(value: number) {
  return Math.round(value * 10) / 10;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}
