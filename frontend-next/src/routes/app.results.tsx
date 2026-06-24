import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/common/MetricCard";
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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { qk } from "@/lib/query-keys";
import { analyticsService } from "@/services/analytics";
import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/results")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: GlobalResults,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");
const pct = (value: number) => `${value}%`;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;

function GlobalResults() {
  const prePost = useQuery({
    queryKey: qk.analytics.list("pre-post-comparison"),
    queryFn: analyticsService.prePostComparison,
  });
  const byTopic = useQuery({
    queryKey: qk.analytics.list("by-topic"),
    queryFn: analyticsService.byTopic,
  });
  const byObjective = useQuery({
    queryKey: qk.analytics.list("by-learning-objective"),
    queryFn: analyticsService.byLearningObjective,
  });
  const byDifficulty = useQuery({
    queryKey: qk.analytics.list("by-difficulty"),
    queryFn: analyticsService.byDifficulty,
  });
  const worst = useQuery({
    queryKey: qk.analytics.list("worst-questions"),
    queryFn: () => analyticsService.worstQuestions(10),
  });
  const questions = useQuery({
    queryKey: qk.analytics.list("questions"),
    queryFn: () => analyticsService.questions(),
  });

  const queries = [prePost, byTopic, byObjective, byDifficulty, worst, questions];

  if (queries.some((q) => q.isLoading)) {
    return <LoadingState label="Loading analytics…" />;
  }

  const failed = queries.find((q) => q.isError);
  if (failed) {
    return (
      <ErrorState
        message={errText(failed.error)}
        onRetry={() => queries.forEach((q) => q.refetch())}
      />
    );
  }

  const pp = prePost.data;
  const topics = byTopic.data ?? [];
  const objectives = byObjective.data ?? [];
  const difficulties = byDifficulty.data ?? [];
  const worstRows = worst.data ?? [];
  const questionRows = questions.data ?? [];

  const hasPrePost = !!pp && (pp.preTest.attemptCount > 0 || pp.postTest.attemptCount > 0);
  const weakestTopic = topics.length
    ? topics.reduce((min, t) => (t.percentage < min.percentage ? t : min))
    : null;

  const prePostChart = pp
    ? [
        { label: "Pre-test", value: pp.preTest.averagePercentage },
        { label: "Post-test", value: pp.postTest.averagePercentage },
      ]
    : [];

  const everythingEmpty =
    !hasPrePost &&
    topics.length === 0 &&
    objectives.length === 0 &&
    difficulties.length === 0 &&
    worstRows.length === 0 &&
    questionRows.length === 0;

  return (
    <>
      <PageHeader
        title="Results & analytics"
        description="Cross-training learning analytics. Advisory only — based on submitted attempts; review before acting."
      />

      {everythingEmpty ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <EmptyState
            icon={<BarChart3 className="h-5 w-5" />}
            title="No analytics yet"
            description="Analytics are computed from submitted attempts only. Once participants submit assessments, breakdowns appear here."
          />
        </div>
      ) : (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Pre-test average"
              value={pp ? pct(pp.preTest.averagePercentage) : "—"}
              hint={pp ? `${pp.preTest.attemptCount} submitted` : "No attempts"}
            />
            <MetricCard
              label="Post-test average"
              value={pp ? pct(pp.postTest.averagePercentage) : "—"}
              hint={pp ? `${pp.postTest.attemptCount} submitted` : "No attempts"}
            />
            <MetricCard
              label="Pre→Post improvement"
              value={pp ? signed(pp.improvement) : "—"}
              trend={pp ? { value: "cohort average", positive: pp.improvement >= 0 } : undefined}
            />
            <MetricCard
              label="Weakest topic"
              value={weakestTopic ? weakestTopic.topicTitle : "—"}
              hint={weakestTopic ? `${pct(weakestTopic.percentage)} correct` : "No data"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pre-test vs post-test</CardTitle>
              </CardHeader>
              <CardContent>
                {hasPrePost ? (
                  <>
                    <div className="h-60">
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
                      Cohort averages across all submitted pre/post attempts (not paired per
                      participant).
                    </p>
                  </>
                ) : (
                  <SectionEmpty label="No submitted pre/post attempts yet." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Topic breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {topics.length ? (
                  <div className="h-60">
                    <ResponsiveContainer>
                      <BarChart data={topics} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} fontSize={11} />
                        <YAxis
                          type="category"
                          dataKey="topicTitle"
                          width={110}
                          fontSize={11}
                        />
                        <Tooltip />
                        <Bar dataKey="percentage" fill="var(--primary)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <SectionEmpty label="No topic data yet." />
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
                  <div className="h-60">
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
                  <SectionEmpty label="No difficulty data yet." />
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
                          <TableCell className="font-medium">
                            {o.learningObjectiveTitle}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {o.attemptCount}
                          </TableCell>
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
                  <SectionEmpty label="No learning-objective data yet." />
                </CardContent>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hardest questions</CardTitle>
            </CardHeader>
            {worstRows.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead className="text-right">Answers</TableHead>
                      <TableHead className="text-right">Correct rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {worstRows.map((q) => (
                      <TableRow key={q.questionId}>
                        <TableCell className="font-medium">{q.questionText}</TableCell>
                        <TableCell className="text-right tabular-nums">{q.answerCount}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {pct(q.percentage)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <CardContent>
                <SectionEmpty label="No question results yet." />
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">All questions</CardTitle>
            </CardHeader>
            {questionRows.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead className="text-right">Answers</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">Correct</TableHead>
                      <TableHead className="text-right">Correct rate</TableHead>
                      <TableHead className="hidden sm:table-cell text-right">Avg points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questionRows.map((q) => (
                      <TableRow key={q.questionId}>
                        <TableCell className="font-medium">{q.questionText}</TableCell>
                        <TableCell className="text-right tabular-nums">{q.answerCount}</TableCell>
                        <TableCell className="hidden sm:table-cell text-right tabular-nums">
                          {q.correctCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {pct(q.correctPercentage)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right tabular-nums">
                          {q.averagePoints}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <CardContent>
                <SectionEmpty label="No question results yet." />
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
