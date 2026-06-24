import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
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

export const Route = createFileRoute("/app/system-analytics")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin"]),
  component: SystemAnalytics,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");
const pct = (value: number) => `${value}%`;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;

function SystemAnalytics() {
  const prePost = useQuery({
    queryKey: qk.analytics.list("pre-post-comparison"),
    queryFn: analyticsService.prePostComparison,
  });
  const byTopic = useQuery({
    queryKey: qk.analytics.list("by-topic"),
    queryFn: analyticsService.byTopic,
  });
  const byDifficulty = useQuery({
    queryKey: qk.analytics.list("by-difficulty"),
    queryFn: analyticsService.byDifficulty,
  });
  const worst = useQuery({
    queryKey: qk.analytics.list("worst-questions"),
    queryFn: () => analyticsService.worstQuestions(5),
  });

  const queries = [prePost, byTopic, byDifficulty, worst];

  if (queries.some((q) => q.isLoading)) {
    return <LoadingState label="Loading system analytics…" />;
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
  const difficulties = byDifficulty.data ?? [];
  const worstRows = worst.data ?? [];

  const totalSubmitted = (pp?.preTest.attemptCount ?? 0) + (pp?.postTest.attemptCount ?? 0);
  const hasPrePost = !!pp && totalSubmitted > 0;

  const everythingEmpty =
    !hasPrePost && topics.length === 0 && difficulties.length === 0 && worstRows.length === 0;

  return (
    <>
      <PageHeader
        title="System analytics"
        description="System-wide learning analytics from submitted attempts. Advisory only — review before acting."
      />

      {everythingEmpty ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <EmptyState
            icon={<BarChart3 className="h-5 w-5" />}
            title="No analytics yet"
            description="System analytics are computed from submitted attempts only. Once participants submit assessments, aggregates appear here."
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
            <MetricCard label="Pre/Post attempts" value={totalSubmitted} />
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
                <CardTitle className="text-base">Topic breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {topics.length ? (
                  <div className="h-60">
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
                  <SectionEmpty label="No topic data yet." />
                )}
              </CardContent>
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
                      <TableHead className="hidden sm:table-cell text-right">Answers</TableHead>
                      <TableHead className="text-right">Correct rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {worstRows.map((q) => (
                      <TableRow key={q.questionId}>
                        <TableCell className="font-medium">{q.questionText}</TableCell>
                        <TableCell className="hidden sm:table-cell text-right tabular-nums">
                          {q.answerCount}
                        </TableCell>
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
