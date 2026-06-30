import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { qk } from "@/lib/query-keys";
import { assessmentsService } from "@/services/assessments";
import { ensureRole } from "@/lib/route-guards";
import type { AssessmentResults, AssessmentStatus, AssessmentType, AttemptStatus } from "@/types";
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

  // Per-assessment results are a bespoke analytics payload (AssessmentResults),
  // not a plain Assessment. ADMIN/INSTRUCTOR only (enforced by ensureRole + backend).
  // Distinct cache key (assessment detail key + "results") so it never collides with
  // the plain assessment-detail query.
  const resultsQuery = useQuery({
    queryKey: [...qk.assessments.detail(id), "results"] as const,
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => {
                  const status = attemptStatusMeta(attempt.status);
                  return (
                    <TableRow key={attempt.id}>
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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

function attemptStatusMeta(status: AttemptStatus): {
  label: string;
  tone: "success" | "info" | "muted";
} {
  if (status === "GRADED") return { label: "Graded", tone: "success" };
  if (status === "SUBMITTED") return { label: "Submitted", tone: "info" };
  return { label: "In progress", tone: "muted" };
}

function assessmentTypeLabel(type: AssessmentType) {
  if (type === "PRE_TEST") return "Pre-test";
  if (type === "POST_TEST") return "Post-test";
  return "Quiz";
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
