import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, Trophy } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/common/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { FilterBar } from "@/components/analytics/FilterBar";
import { qk } from "@/lib/query-keys";
import { analyticsService } from "@/services/analytics";
import type {
  AnalyticsSummary,
  PrePostComparison,
  TopicAnalytics,
  LearningObjectiveAnalytics,
  DifficultyAnalytics,
} from "@/services/analytics";
import { ensureRole } from "@/lib/route-guards";
import {
  analyticsSearchSchema,
  searchToFilters,
  hasAnyAnalyticsFilter,
} from "@/lib/analytics-filters";

export const Route = createFileRoute("/app/analytics")({
  validateSearch: analyticsSearchSchema,
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: AnalyticsDashboard,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");
const pct = (value: number) => `${value}%`;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;

function AnalyticsDashboard() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filters = searchToFilters(search);

  const summary = useQuery({
    queryKey: qk.analytics.list(["summary", filters]),
    queryFn: () => analyticsService.summary(filters),
  });
  // Pre/post honors only trainingId on the backend (see analytics service).
  const prePost = useQuery({
    queryKey: qk.analytics.list(["pre-post-comparison", filters.trainingId ?? null]),
    queryFn: () => analyticsService.prePostComparison({ trainingId: filters.trainingId }),
  });
  const byTopic = useQuery({
    queryKey: qk.analytics.list(["by-topic", filters]),
    queryFn: () => analyticsService.byTopic(filters),
  });
  const byObjective = useQuery({
    queryKey: qk.analytics.list(["by-learning-objective", filters]),
    queryFn: () => analyticsService.byLearningObjective(filters),
  });
  const byDifficulty = useQuery({
    queryKey: qk.analytics.list(["by-difficulty", filters]),
    queryFn: () => analyticsService.byDifficulty(filters),
  });

  const queries = [summary, prePost, byTopic, byObjective, byDifficulty];
  const isLoading = queries.some((q) => q.isLoading);
  const failed = queries.find((q) => q.isError);

  return (
    <>
      <PageHeader
        title="Analytics dashboard"
        description="Overview across trainings, filtered by the selectors below. Computed from submitted attempts only — advisory; review before acting."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/participants" search={search}>
                <Users className="mr-1.5 h-4 w-4" />
                Participant progress
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/leaderboard" search={search}>
                <Trophy className="mr-1.5 h-4 w-4" />
                Leaderboard
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <FilterBar value={search} onChange={(next) => navigate({ search: next })} />

        {isLoading ? (
          <LoadingState label="Loading analytics…" />
        ) : failed ? (
          <ErrorState
            message={errText(failed.error)}
            onRetry={() => queries.forEach((q) => q.refetch())}
          />
        ) : (
          <DashboardBody
            summary={summary.data}
            prePost={prePost.data}
            topics={byTopic.data ?? []}
            objectives={byObjective.data ?? []}
            difficulties={byDifficulty.data ?? []}
            filtersActive={hasAnyAnalyticsFilter(search)}
          />
        )}
      </div>
    </>
  );
}

function DashboardBody({
  summary,
  prePost,
  topics,
  objectives,
  difficulties,
  filtersActive,
}: {
  summary: AnalyticsSummary | undefined;
  prePost: PrePostComparison | undefined;
  topics: TopicAnalytics[];
  objectives: LearningObjectiveAnalytics[];
  difficulties: DifficultyAnalytics[];
  filtersActive: boolean;
}) {
  const pairedCount = prePost?.pairedUserCount ?? 0;
  const hasPrePost = pairedCount > 0;
  const prePostChart = prePost
    ? [
        { label: "Pre-test", value: prePost.preTest.averagePercentage },
        { label: "Post-test", value: prePost.postTest.averagePercentage },
      ]
    : [];

  const everythingEmpty =
    (!summary || summary.answerCount === 0) &&
    topics.length === 0 &&
    objectives.length === 0 &&
    difficulties.length === 0 &&
    !hasPrePost;

  if (everythingEmpty) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-5 w-5" />}
        title={filtersActive ? "No data for these filters" : "No analytics yet"}
        description={
          filtersActive
            ? "No submitted answers match the current filters. Try widening or clearing them."
            : "Analytics are computed from submitted attempts only. Once participants submit assessments, the overview appears here."
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Participants"
          value={summary ? summary.participantCount : "—"}
          hint={summary ? `${summary.attemptCount} submitted attempts` : undefined}
        />
        <MetricCard
          label="Answers analyzed"
          value={summary ? summary.answerCount : "—"}
          hint="Submitted answers only"
        />
        <MetricCard
          label="Average score"
          value={summary ? pct(summary.averageScorePercentage) : "—"}
          hint="Weighted points across answers"
        />
        <MetricCard
          label="MC correct rate"
          value={summary ? pct(summary.multipleChoice.correctPercentage) : "—"}
          hint={summary ? `${summary.multipleChoice.answerCount} MC answers` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pre-test vs post-test</CardTitle>
          </CardHeader>
          <CardContent>
            {hasPrePost && prePost ? (
              <>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">
                    Improvement:{" "}
                    <span
                      className={
                        prePost.improvement >= 0
                          ? "font-semibold text-emerald-600"
                          : "font-semibold text-rose-600"
                      }
                    >
                      {signed(prePost.improvement)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {pairedCount} participant{pairedCount === 1 ? "" : "s"} with both tests
                  </span>
                </div>
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={prePostChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis domain={[0, 100]} fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="value" fill="var(--primary)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Paired averages over the {pairedCount} participant
                  {pairedCount === 1 ? "" : "s"} who submitted both a pre- and a post-test.
                </p>
              </>
            ) : (
              <SectionEmpty label="No participants with both a pre- and post-test yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Topic breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {topics.length ? (
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={topics} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} fontSize={11} />
                    <YAxis type="category" dataKey="topicTitle" width={110} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="percentage" fill="var(--primary)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <SectionEmpty label="No topic data for these filters." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Difficulty breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {difficulties.length ? (
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={difficulties}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="difficulty" fontSize={11} />
                    <YAxis domain={[0, 100]} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="percentage" fill="var(--primary)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <SectionEmpty label="No difficulty data for these filters." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By learning objective</CardTitle>
          </CardHeader>
          {objectives.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Objective</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead className="text-right">Correct</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {objectives.map((o) => (
                    <TableRow key={o.learningObjectiveId}>
                      <TableCell className="font-medium">{o.learningObjectiveTitle}</TableCell>
                      <TableCell className="text-right tabular-nums">{o.attemptCount}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {pct(o.percentage)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <CardContent>
              <SectionEmpty label="No learning-objective data for these filters." />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
