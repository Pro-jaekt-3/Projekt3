import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ArrowLeft, BookOpen, Clock, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { getAttemptId } from "@/lib/attempt-storage";
import { qk } from "@/lib/query-keys";
import { assessmentAttemptsService } from "@/services/assessmentAttempts";

export const Route = createFileRoute("/assessment/$id/result")({
  component: ParticipantResult,
});

function ParticipantResult() {
  const { id } = Route.useParams();
  const rememberedAttemptId = getAttemptId(id);

  const attemptQuery = useQuery({
    queryKey: qk.assessmentAttempts.detail(rememberedAttemptId ?? `missing-${id}`),
    queryFn: () => assessmentAttemptsService.get(rememberedAttemptId!),
    enabled: rememberedAttemptId !== null,
    retry: false,
  });

  if (rememberedAttemptId === null) {
    return (
      <ResultShell>
        <EmptyResultState
          title="No result found"
          description="Open or submit the assessment first so we can load your latest attempt result."
        />
      </ResultShell>
    );
  }

  if (attemptQuery.isLoading) {
    return <LoadingState label="Loading result…" />;
  }

  if (attemptQuery.isError || !attemptQuery.data) {
    return (
      <ResultShell>
        <ErrorState
          message={attemptQuery.error instanceof Error ? attemptQuery.error.message : "Failed to load result"}
          onRetry={() => attemptQuery.refetch()}
        />
      </ResultShell>
    );
  }

  const attempt = attemptQuery.data;
  const assessment = attempt.assessment;
  const submittedAt = attempt.submittedAt ? new Date(attempt.submittedAt) : null;
  const startedAt = new Date(attempt.startedAt);
  const score = typeof attempt.score === "number" ? attempt.score : null;
  const maxScore = typeof attempt.maxScore === "number" ? attempt.maxScore : null;
  const percentage =
    typeof score === "number" && typeof maxScore === "number" && maxScore > 0
      ? Math.round((score / maxScore) * 100)
      : null;
  const minutesSpent =
    submittedAt && !Number.isNaN(startedAt.getTime()) && !Number.isNaN(submittedAt.getTime())
      ? Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 60000))
      : null;

  const answers = attempt.answers ?? [];
  const autoCorrect = answers.filter((answer) => answer.isCorrect === true).length;
  const pendingReview = answers.filter((answer) => answer.needsManualReview).length;
  const answeredCount = answers.length;
  const totalQuestions = assessment?.questions?.length ?? answeredCount;

  const questionSummaries = (assessment?.questions ?? []).map((item) => {
    const answer = answers.find((entry) => entry.questionId === item.questionId);
    const awarded = typeof answer?.pointsAwarded === "number" ? answer.pointsAwarded : null;
    const possible = Number(item.points ?? 0);

    return {
      id: item.questionId,
      title: item.question?.title ?? `Question ${item.orderIndex + 1}`,
      possible,
      awarded,
      status:
        answer?.needsManualReview
          ? "Pending manual review"
          : answer?.isCorrect === true
            ? "Correct"
            : answer?.isCorrect === false
              ? "Incorrect"
              : "Not answered",
    };
  });

  return (
    <ResultShell>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                {assessment?.training?.title ?? "Assessment"}
              </div>
              <h1 className="mt-0.5 text-xl font-semibold sm:text-2xl">
                {assessment?.title ?? "Assessment result"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={attempt.status === "GRADED" ? "Graded" : "Submitted"} />
                <span>·</span>
                <span>Submitted {submittedAt ? formatDateTime(submittedAt) : "recently"}</span>
                <span>·</span>
                <span>
                  {minutesSpent !== null ? `Time spent ${minutesSpent} min` : "Time spent unavailable"}
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-semibold tabular-nums text-primary">
                {percentage !== null ? `${percentage}%` : "Pending"}
              </div>
              <div className="text-xs text-muted-foreground">
                {score !== null && maxScore !== null ? `${score} / ${maxScore} points` : "awaiting review"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Answered" value={`${answeredCount} / ${totalQuestions}`} />
        <MetricCard label="Auto-correct" value={autoCorrect} />
        <MetricCard label="Manual review" value={pendingReview} />
        <MetricCard
          label="Time spent"
          value={minutesSpent !== null ? `${minutesSpent}m` : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Result summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <SummaryRow
            icon={<ClipboardList className="h-4 w-4" />}
            label="Assessment type"
            value={assessmentTypeLabel(assessment?.type)}
          />
          <SummaryRow
            icon={<Clock className="h-4 w-4" />}
            label="Scoring"
            value={
              pendingReview > 0
                ? "Multiple-choice answers are graded now; open/code answers are still under manual review"
                : percentage !== null
                  ? "Automatically graded result available"
                  : "Waiting for manual grading"
            }
          />
          <SummaryRow
            icon={<Check className="h-4 w-4" />}
            label="Question coverage"
            value={`${answeredCount} answered out of ${totalQuestions}`}
          />
          <SummaryRow
            icon={<BookOpen className="h-4 w-4" />}
            label="Review state"
            value={pendingReview > 0 ? `${pendingReview} answer(s) need manual review` : "All answers processed"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-question status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questionSummaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No question-level result data is available yet.</p>
          ) : (
            questionSummaries.map((question, index) => (
              <div key={question.id} className="rounded-md border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Question {index + 1}</div>
                    <div className="text-sm font-medium">{question.title}</div>
                  </div>
                  <StatusBadge
                    status={question.status}
                    tone={
                      question.status === "Correct"
                        ? "success"
                        : question.status === "Incorrect"
                          ? "danger"
                          : question.status === "Pending manual review"
                            ? "warning"
                            : "muted"
                    }
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {question.awarded !== null
                    ? `Points awarded: ${question.awarded} / ${question.possible}`
                    : `Possible points: ${question.possible}`}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/app/my-results">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to My Results
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/my-assessments">My assessments</Link>
        </Button>
      </div>
    </ResultShell>
  );
}

function ResultShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <Link
            to="/app/my-results"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to My Results
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/my-assessments">My assessments</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

function EmptyResultState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-8 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild variant="outline">
          <Link to="/app/my-assessments">Back to My assessments</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function assessmentTypeLabel(type?: string) {
  if (type === "PRE_TEST") return "Pre-test";
  if (type === "POST_TEST") return "Post-test";
  if (type === "QUIZ") return "Quiz";
  return "Assessment";
}

function formatDateTime(value: Date) {
  return value.toLocaleString();
}
