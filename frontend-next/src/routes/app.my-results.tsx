import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getAllAttemptIds } from "@/lib/attempt-storage";
import { qk } from "@/lib/query-keys";
import { assessmentAttemptsService } from "@/services/assessmentAttempts";
import type { AssessmentAttempt } from "@/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/app/my-results")({
  component: MyResults,
});

function MyResults() {
  const rememberedAttemptIds = useMemo(
    () => Array.from(new Set(getAllAttemptIds())),
    [],
  );

  const attemptQueries = useQueries({
    queries: rememberedAttemptIds.map((attemptId) => ({
      queryKey: qk.assessmentAttempts.detail(attemptId),
      queryFn: () => assessmentAttemptsService.get(attemptId),
      retry: false,
    })),
  });

  const isLoading = attemptQueries.some((query) => query.isLoading);
  const fatalError = attemptQueries.find(
    (query) => query.isError && !(query.error instanceof Error && /forbidden|not found/i.test(query.error.message)),
  );

  const completed = attemptQueries
    .map((query) => query.data)
    .filter((attempt): attempt is AssessmentAttempt => Boolean(attempt))
    .filter((attempt) => attempt.status === "SUBMITTED" || attempt.status === "GRADED")
    .sort((left, right) => {
      const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
      const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
      return rightTime - leftTime;
    });

  const latestScored = completed.find(
    (attempt) =>
      typeof attempt.score === "number" &&
      typeof attempt.maxScore === "number" &&
      attempt.maxScore > 0,
  );

  const chartData = completed
    .filter(
      (attempt) =>
        typeof attempt.score === "number" &&
        typeof attempt.maxScore === "number" &&
        attempt.maxScore > 0 &&
        attempt.submittedAt,
    )
    .slice()
    .reverse()
    .map((attempt) => ({
      date: formatShortDate(attempt.submittedAt!),
      score: Math.round((attempt.score! / attempt.maxScore!) * 100),
    }));

  return (
    <>
      <PageHeader title="My results" description="Your progress across assessments." />
      {rememberedAttemptIds.length === 0 ? (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No results yet"
            description="Submit an assessment first and your result history will appear here."
          />
        </div>
      ) : isLoading ? (
        <LoadingState label="Loading your results…" />
      ) : fatalError ? (
        <ErrorState
          message={fatalError.error instanceof Error ? fatalError.error.message : "Failed to load results"}
          onRetry={() => fatalError.refetch()}
        />
      ) : completed.length === 0 ? (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No completed attempts yet"
            description="Your in-progress attempts are remembered, but completed results will appear only after submission."
          />
        </div>
      ) : (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Completed" value={completed.length} />
            <MetricCard
              label="Latest score"
              value={latestScored ? `${toPercentage(latestScored)}%` : "Pending"}
            />
            <MetricCard
              label="Awaiting review"
              value={completed.filter(hasManualReview).length}
            />
            <MetricCard
              label="Scored attempts"
              value={completed.filter(hasScore).length}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress over time</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Score trend will appear once at least one submitted attempt has a numeric score.
                </p>
              ) : (
                <div className="h-60">
                  <ResponsiveContainer>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} domain={[0, 100]} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Completed assessments</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assessment</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="hidden md:table-cell">State</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completed.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>
                        <div className="font-medium">{attempt.assessment?.title ?? "Assessment"}</div>
                        <div className="text-xs text-muted-foreground">
                          {attempt.assessment?.training?.title ?? "Training unavailable"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge status={assessmentTypeLabel(attempt.assessment?.type)} tone="info" />
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {hasScore(attempt) ? `${toPercentage(attempt)}%` : "Pending"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <StatusBadge
                          status={hasManualReview(attempt) ? "Pending review" : "Scored"}
                          tone={hasManualReview(attempt) ? "warning" : "success"}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to="/assessment/$id/result"
                            params={{ id: String(attempt.assessmentId) }}
                          >
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function hasScore(attempt: AssessmentAttempt) {
  return (
    typeof attempt.score === "number" &&
    typeof attempt.maxScore === "number" &&
    attempt.maxScore > 0
  );
}

function hasManualReview(attempt: AssessmentAttempt) {
  return (attempt.answers ?? []).some((answer) => answer.needsManualReview);
}

function toPercentage(attempt: AssessmentAttempt) {
  if (!hasScore(attempt)) return 0;
  return Math.round((attempt.score! / attempt.maxScore!) * 100);
}

function assessmentTypeLabel(type?: string) {
  if (type === "PRE_TEST") return "Pre-test";
  if (type === "POST_TEST") return "Post-test";
  if (type === "QUIZ") return "Quiz";
  return "Assessment";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}
