import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, Filter } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/common/StatusBadge";
import { qk } from "@/lib/query-keys";
import { assessmentsService } from "@/services/assessments";
import { useAttemptFanOut } from "@/hooks/useAttemptFanOut";
import type { Assessment, AssessmentAttempt, AssessmentType } from "@/types";

export const Route = createFileRoute("/app/my-assessments")({
  component: MyAssessments,
});

type ParticipantTab = "All" | "To do" | "In progress" | "Completed";

const TABS: ParticipantTab[] = ["All", "To do", "In progress", "Completed"];

const ASSESSMENT_TYPE_LABEL: Record<AssessmentType, string> = {
  PRE_TEST: "Pre-test",
  POST_TEST: "Post-test",
  QUIZ: "Quiz",
};

function MyAssessments() {
  const [tab, setTab] = useState<ParticipantTab>("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [trainingFilter, setTrainingFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<AssessmentType | "all">("all");

  const assessmentsQuery = useQuery({
    queryKey: qk.assessments.list({ scope: "available" }),
    queryFn: assessmentsService.listAvailable,
  });

  const attempts = useAttemptFanOut(assessmentsQuery.data);

  const cards = (assessmentsQuery.data ?? []).map((assessment, index) => ({
    assessment,
    attempt: attempts[index]?.data,
    attemptLoading: attempts[index]?.isLoading ?? false,
  }));

  const trainingOptions = Array.from(
    new Map(
      (assessmentsQuery.data ?? [])
        .filter((a) => a.training)
        .map((a) => [a.training!.id, a.training!]),
    ).values(),
  ).sort((a, b) => a.title.localeCompare(b.title));

  const activeFilterCount = [trainingFilter !== "all", typeFilter !== "all"].filter(Boolean).length;

  const filtered = cards.filter(({ assessment, attempt }) => {
    if (tab !== "All" && participantState(assessment, attempt) !== tab) return false;
    if (trainingFilter !== "all" && String(assessment.trainingId) !== trainingFilter) return false;
    if (typeFilter !== "all" && assessment.type !== typeFilter) return false;
    return true;
  });

  const clearFilters = () => {
    setTrainingFilter("all");
    setTypeFilter("all");
  };

  const controls = (
    <>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(value) => setTab(value as ParticipantTab)}>
          <TabsList>
            {TABS.map((item) => (
              <TabsTrigger key={item} value={item}>
                {item}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen((o) => !o)}
        >
          <Filter className="mr-1.5 h-4 w-4" />
          {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
        </Button>
      </div>

      {filtersOpen && (
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <FilterField label="Training">
              <Select value={trainingFilter} onValueChange={setTrainingFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All trainings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All trainings</SelectItem>
                  {trainingOptions.map((training) => (
                    <SelectItem key={training.id} value={String(training.id)}>
                      {training.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Type">
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as AssessmentType | "all")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(ASSESSMENT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </Card>
      )}
    </>
  );

  return (
    <>
      <PageHeader title="My assessments" description="Assessments assigned to you." />
      {assessmentsQuery.isLoading ? (
        <LoadingState label="Loading assessments…" />
      ) : assessmentsQuery.isError ? (
        <ErrorState
          message={
            assessmentsQuery.error instanceof Error
              ? assessmentsQuery.error.message
              : "Failed to load assessments"
          }
          onRetry={() => assessmentsQuery.refetch()}
        />
      ) : (
        <div className="space-y-4 p-4 sm:p-6 lg:p-8">
          {controls}
          {filtered.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" />}
              title={
                (assessmentsQuery.data ?? []).length === 0
                  ? "No assessments available"
                  : "No assessments match your filters"
              }
              description={
                (assessmentsQuery.data ?? []).length === 0
                  ? "Published assessments assigned to participants will appear here."
                  : "Try a different tab or filter."
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map(({ assessment, attempt, attemptLoading }) => (
                <AssessmentCard
                  key={assessment.id}
                  assessment={assessment}
                  attempt={attempt}
                  attemptLoading={attemptLoading}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[12rem]">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function AssessmentCard({
  assessment,
  attempt,
  attemptLoading,
}: {
  assessment: Assessment;
  attempt?: AssessmentAttempt;
  attemptLoading: boolean;
}) {
  const state = participantState(assessment, attempt);
  const actionLabel =
    state === "Completed" ? "View result" : state === "In progress" ? "Continue" : "Start";

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div>
          <div className="text-xs text-muted-foreground">
            {assessment.training?.title ?? "Available assessment"}
          </div>
          <div className="mt-0.5 text-sm font-semibold">{assessment.title}</div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {assessmentTypeLabel(assessment.type)}
            {" · "}
            {assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} min` : "No limit"}
          </span>
          <StatusBadge status={state} />
        </div>
        <div className="text-xs text-muted-foreground">
          {attemptLoading
            ? "Checking latest attempt…"
            : `Published ${formatDate(assessment.updatedAt)}`}
        </div>
        <div className="mt-auto flex justify-end">
          {state === "Completed" ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/assessment/$id/result" params={{ id: String(assessment.id) }}>
                {actionLabel}
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/assessment/$id/access" params={{ id: String(assessment.id) }}>
                {actionLabel}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function participantState(
  _assessment: Assessment,
  attempt?: Pick<AssessmentAttempt, "status">,
): Exclude<ParticipantTab, "All"> {
  if (!attempt) return "To do";
  if (attempt.status === "IN_PROGRESS") return "In progress";
  if (attempt.status === "SUBMITTED" || attempt.status === "GRADED") return "Completed";
  return "To do";
}

function assessmentTypeLabel(type: Assessment["type"]) {
  if (type === "PRE_TEST") return "Pre-test";
  if (type === "POST_TEST") return "Post-test";
  return "Quiz";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString();
}
