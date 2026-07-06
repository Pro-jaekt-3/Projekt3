import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BarChart3, Users, Trophy, TrendingUp, HelpCircle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { FilterBar } from "@/components/analytics/FilterBar";
import { qk } from "@/lib/query-keys";
import { analyticsService } from "@/services/analytics";
import type {
  AnalyticsSummary,
  PrePostComparison,
  TopicAnalytics,
  DifficultyAnalytics,
  QuestionAnalytics,
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
    ensureRole({ auth: context.auth, href: location.href }, ["instructor"]),
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
  const byDifficulty = useQuery({
    queryKey: qk.analytics.list(["by-difficulty", filters]),
    queryFn: () => analyticsService.byDifficulty(filters),
  });
  const questions = useQuery({
    queryKey: qk.analytics.list(["questions", "success-rate", filters]),
    queryFn: () => analyticsService.questions({ filters }),
  });

  const queries = [summary, prePost, byTopic, byDifficulty, questions];
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
            <Button asChild variant="outline" size="sm">
              <Link to="/app/trends" search={search}>
                <TrendingUp className="mr-1.5 h-4 w-4" />
                Trends
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/question-analysis" search={search}>
                <HelpCircle className="mr-1.5 h-4 w-4" />
                Questions
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
            difficulties={byDifficulty.data ?? []}
            questions={questions.data ?? []}
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
  difficulties,
  questions,
  filtersActive,
}: {
  summary: AnalyticsSummary | undefined;
  prePost: PrePostComparison | undefined;
  topics: TopicAnalytics[];
  difficulties: DifficultyAnalytics[];
  questions: QuestionAnalytics[];
  filtersActive: boolean;
}) {
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);

  useEffect(() => {
    if (questions.length === 0) {
      setSelectedQuestionId(null);
      return;
    }

    if (
      selectedQuestionId === null ||
      !questions.some((question) => question.questionId === selectedQuestionId)
    ) {
      setSelectedQuestionId(questions[0].questionId);
    }
  }, [questions, selectedQuestionId]);

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
    difficulties.length === 0 &&
    questions.length === 0 &&
    !hasPrePost;

  const selectedQuestion =
    selectedQuestionId !== null
      ? questions.find((question) => question.questionId === selectedQuestionId) ?? null
      : null;

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
            <CardTitle className="text-base">Topic details</CardTitle>
          </CardHeader>
          {topics.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead className="text-right">Correct</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topics.map((topic) => (
                    <TableRow key={topic.topicId}>
                      <TableCell className="font-medium">{topic.topicTitle}</TableCell>
                      <TableCell className="text-right tabular-nums">{topic.attemptCount}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {pct(topic.percentage)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <CardContent>
              <SectionEmpty label="No topic data for these filters." />
            </CardContent>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Per-question success drill-down</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Select one question to inspect how many submitted answers were marked correct versus not yet correct.
            </p>
          </div>
          <div className="w-full sm:w-80">
            <Select
              value={selectedQuestionId !== null ? String(selectedQuestionId) : undefined}
              onValueChange={(value) => setSelectedQuestionId(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a question" />
              </SelectTrigger>
              <SelectContent>
                {questions.map((question) => (
                  <SelectItem key={question.questionId} value={String(question.questionId)}>
                    {question.questionText}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {selectedQuestion ? (
            <QuestionSuccessDrilldown question={selectedQuestion} />
          ) : (
            <SectionEmpty label="No answered questions are available for drill-down." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const SUCCESS_COLORS = {
  correct: "var(--chart-3)",
  other: "var(--chart-1)",
} as const;

function QuestionSuccessDrilldown({ question }: { question: QuestionAnalytics }) {
  const otherCount = Math.max(0, question.answerCount - question.correctCount);
  const pieData = [
    { name: "Correct", value: question.correctCount, fill: SUCCESS_COLORS.correct },
    { name: "Not yet correct", value: otherCount, fill: SUCCESS_COLORS.other },
  ].filter((slice) => slice.value > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
      <div className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected question</div>
          <h3 className="mt-1 text-sm font-semibold sm:text-base">{question.questionText}</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Answers" value={question.answerCount} />
          <MetricCard label="Correct" value={question.correctCount} />
          <MetricCard label="Success rate" value={pct(question.correctPercentage)} />
          <MetricCard label="Avg points" value={roundTo1(question.averagePoints)} />
        </div>

        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={56}
                outerRadius={92}
                paddingAngle={2}
                label={({ name, percent }) =>
                  typeof percent === "number" ? `${name} ${Math.round(percent * 100)}%` : name
                }
              >
                {pieData.map((slice) => (
                  <Cell key={slice.name} fill={slice.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number | string) => [`${value} answer(s)`, "Count"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-md border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Interpretation</div>
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Correct</span> means answers with
              <code className="mx-1">isCorrect === true</code>.
            </p>
            <p>
              <span className="font-medium text-foreground">Not yet correct</span> includes wrong answers and any
              answers that have not been marked correct yet.
            </p>
            <p className="text-xs">
              For OPEN and CODE questions, pending manual review stays outside the correct slice until grading is completed.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slice</TableHead>
                <TableHead className="text-right">Answers</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Correct</TableCell>
                <TableCell className="text-right tabular-nums">{question.correctCount}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {pct(question.correctPercentage)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Not yet correct</TableCell>
                <TableCell className="text-right tabular-nums">{otherCount}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {pct(roundTo1(Math.max(0, 100 - question.correctPercentage)))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
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

function roundTo1(value: number) {
  return Math.round(value * 10) / 10;
}
