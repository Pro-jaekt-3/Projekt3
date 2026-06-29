import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { HelpCircle, ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { MetricCard } from "@/components/common/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { FilterBar } from "@/components/analytics/FilterBar";
import { OptionDistribution } from "@/components/analytics/OptionDistribution";
import { qk } from "@/lib/query-keys";
import { analyticsService } from "@/services/analytics";
import type { QuestionOptionDistribution } from "@/services/analytics";
import { ensureRole } from "@/lib/route-guards";
import { analyticsSearchSchema, searchToFilters } from "@/lib/analytics-filters";

// The selected question rides in the URL search (questionId), so drill-down from
// the list and the back-link round-trip with the rest of the analytics filters.
// questionId is NOT in the shared schema, so it is added route-locally here
// (without touching analytics-filters.ts).
const questionSearchSchema = analyticsSearchSchema.extend({
  questionId: z.coerce.number().int().positive().optional().catch(undefined),
});
type QuestionSearch = z.infer<typeof questionSearchSchema>;

export const Route = createFileRoute("/app/question-analysis")({
  validateSearch: questionSearchSchema,
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: QuestionAnalysisPage,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

const QUESTION_TYPE_LABEL: Record<string, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  OPEN: "Open",
  CODE: "Code",
};

const difficultyLabel = (value: number) =>
  ({ 1: "Easy", 2: "Medium", 3: "Hard" })[value] ?? `Level ${value}`;

function QuestionAnalysisPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filters = searchToFilters(search);

  return (
    <>
      <PageHeader
        title="Per-question analysis"
        description="Option distribution and distractor analysis per question. Computed from submitted answers only — advisory; review before acting."
        breadcrumbs={
          search.questionId !== undefined ? (
            <Link
              to="/app/question-analysis"
              search={{ ...search, questionId: undefined }}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> All questions
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {search.questionId === undefined ? (
          <>
            <FilterBar
              value={search}
              onChange={(next) => navigate({ search: (prev) => ({ ...prev, ...next }) })}
            />
            <QuestionList filters={filters} search={search} />
          </>
        ) : (
          <QuestionDetail questionId={search.questionId} trainingId={filters.trainingId} />
        )}
      </div>
    </>
  );
}

function QuestionList({
  filters,
  search,
}: {
  filters: ReturnType<typeof searchToFilters>;
  search: QuestionSearch;
}) {
  // Worst-first so the questions most worth inspecting surface at the top.
  const questions = useQuery({
    queryKey: qk.analytics.list(["questions", "worst", filters]),
    queryFn: () => analyticsService.questions({ sort: "worst", filters }),
  });

  if (questions.isLoading) return <LoadingState label="Loading questions…" />;
  if (questions.isError) {
    return <ErrorState message={errText(questions.error)} onRetry={() => questions.refetch()} />;
  }

  const rows = questions.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-5 w-5" />}
        title="No answered questions yet"
        description={
          filters.trainingId || filters.topicId || filters.learningObjectiveId || filters.difficulty
            ? "No question has submitted answers for the current filters."
            : "Per-question analysis appears once participants submit answers."
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Questions by lowest correct rate</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead className="text-right">Answers</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Correct</TableHead>
              <TableHead className="text-right">Correct rate</TableHead>
              <TableHead className="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((q) => (
              <TableRow key={q.questionId}>
                <TableCell className="font-medium">
                  <Link
                    to="/app/question-analysis"
                    search={{ ...search, questionId: q.questionId }}
                    className="hover:underline"
                  >
                    {q.questionText}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{q.answerCount}</TableCell>
                <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                  {q.correctCount}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {q.correctPercentage}%
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    to="/app/question-analysis"
                    search={{ ...search, questionId: q.questionId }}
                    className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={`Open analysis for ${q.questionText}`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function QuestionDetail({ questionId, trainingId }: { questionId: number; trainingId?: number }) {
  const distribution = useQuery({
    queryKey: qk.analytics.detail(
      `question-option-distribution:${questionId}:${trainingId ?? "all"}`,
    ),
    queryFn: () => analyticsService.questionOptionDistribution(questionId, { trainingId }),
  });

  if (distribution.isLoading) return <LoadingState label="Loading question analysis…" />;
  if (distribution.isError) {
    const message = errText(distribution.error);
    if (/not found/i.test(message)) {
      return (
        <EmptyState
          icon={<HelpCircle className="h-5 w-5" />}
          title="Question not found"
          description="This question does not exist or is no longer available."
        />
      );
    }
    return <ErrorState message={message} onRetry={() => distribution.refetch()} />;
  }

  const data = distribution.data;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <QuestionHeaderCard data={data} />
      <QuestionDetailBody data={data} />
    </div>
  );
}

function QuestionHeaderCard({ data }: { data: QuestionOptionDistribution }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{data.questionText}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">
          {QUESTION_TYPE_LABEL[data.questionType] ?? data.questionType}
        </Badge>
        <Badge variant="outline">{difficultyLabel(data.difficulty)}</Badge>
        {data.topic && <span>· {data.topic.name}</span>}
        {data.learningObjective && <span>· {data.learningObjective.title}</span>}
      </CardContent>
    </Card>
  );
}

function QuestionDetailBody({ data }: { data: QuestionOptionDistribution }) {
  const isMultipleChoice = data.questionType === "MULTIPLE_CHOICE";

  // Non-MC (OPEN/CODE): no auto-graded option distribution — render the backend's
  // honest explanation, never a fabricated chart.
  if (!isMultipleChoice || data.options.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Option distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <span>Option distribution applies to multiple-choice questions only.</span>
            <span className="max-w-md text-xs">{data.note}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // MC with no submitted answers -> clean empty-state (no zero-division bars).
  if (data.totalSubmittedAnswers === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Option distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
            No submitted answers yet for this question.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard
          label="Submitted answers"
          value={data.totalSubmittedAnswers}
          hint={`${data.answeredCount} chose an option`}
        />
        <MetricCard
          label="Correct (p-value)"
          value={`${data.pValue}%`}
          hint={`${data.correctCount} correct`}
        />
        <MetricCard
          label="No answer"
          value={data.noAnswerCount}
          hint="Submitted without selecting"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Option distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <OptionDistribution options={data.options} />
          <p className="mt-3 text-xs text-muted-foreground">{data.note}</p>
        </CardContent>
      </Card>
    </>
  );
}
