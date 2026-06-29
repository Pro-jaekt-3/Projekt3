import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, Filter } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/common/StatusBadge";
import { getAttemptId } from "@/lib/attempt-storage";
import { qk } from "@/lib/query-keys";
import { assessmentsService } from "@/services/assessments";
import { assessmentAttemptsService } from "@/services/assessmentAttempts";
import type { Assessment, AssessmentAttempt } from "@/types";

export const Route = createFileRoute("/app/my-assessments")({
  component: MyAssessments,
});

type ParticipantTab = "All" | "To do" | "In progress" | "Completed";

const TABS: ParticipantTab[] = ["All", "To do", "In progress", "Completed"];

function MyAssessments() {
  const [tab, setTab] = useState<ParticipantTab>("All");

  const assessmentsQuery = useQuery({
    queryKey: qk.assessments.list({ scope: "available" }),
    queryFn: assessmentsService.listAvailable,
  });

  const attempts = useQueries({
    queries: (assessmentsQuery.data ?? []).map((assessment) => {
      const rememberedAttemptId = getAttemptId(assessment.id);
      return {
        queryKey: qk.assessmentAttempts.detail(
          rememberedAttemptId ?? `missing-${assessment.id}`,
        ),
        queryFn: () => assessmentAttemptsService.get(rememberedAttemptId!),
        enabled: rememberedAttemptId !== null,
        retry: false,
      };
    }),
  });

  const cards = (assessmentsQuery.data ?? []).map((assessment, index) => ({
    assessment,
    attempt: attempts[index]?.data,
    attemptLoading: attempts[index]?.isLoading ?? false,
  }));

  const filtered = cards.filter(({ assessment, attempt }) => {
    if (tab === "All") return true;
    return participantState(assessment, attempt) === tab;
  });

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
      ) : filtered.length === 0 ? (
        <div className="space-y-4 p-4 sm:p-6 lg:p-8">
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
            <Button variant="outline" size="sm">
              <Filter className="mr-1.5 h-4 w-4" /> Filters
            </Button>
          </div>

          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="No assessments available"
            description="Published assessments assigned to participants will appear here."
          />
        </div>
      ) : (
        <div className="space-y-4 p-4 sm:p-6 lg:p-8">
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
            <Button variant="outline" size="sm">
              <Filter className="mr-1.5 h-4 w-4" /> Filters
            </Button>
          </div>

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
        </div>
      )}
    </>
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
    state === "Completed"
      ? "View result"
      : state === "In progress"
        ? "Continue"
        : "Start";

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
