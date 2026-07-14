import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  GraduationCap,
  ClipboardList,
  Brain,
  AlertCircle,
  Plus,
  UserPlus,
  Cpu,
  Eye,
} from "lucide-react";
import { useRole } from "@/lib/role-context";
import { PageHeader } from "@/components/common/PageHeader";
import { MetricCard } from "@/components/common/MetricCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { qk } from "@/lib/query-keys";
import { trainingsService } from "@/services/trainings";
import { questionsService } from "@/services/questions";
import { usersService } from "@/services/users";
import { aiService } from "@/services/ai";
import { analyticsService } from "@/services/analytics";
import { assessmentsService } from "@/services/assessments";
import { useAttemptFanOut } from "@/hooks/useAttemptFanOut";
import type { AssessmentAttempt } from "@/types";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardRouter,
});

// Shared shape for the plain "fetch a list" queries repeated across the three
// role dashboards below (trainings/questions/users/AI models/summary).
function useListQuery<T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) {
  return useQuery({ queryKey, queryFn });
}

function DashboardRouter() {
  const { role } = useRole();
  if (role === "admin") return <AdminDashboard />;
  if (role === "participant") return <ParticipantDashboard />;
  return <InstructorDashboard />;
}

// ---------- Instructor ----------

function InstructorDashboard() {
  const { user } = useRole();

  const trainingsQuery = useListQuery(qk.trainings.list(), trainingsService.list);
  const questionsQuery = useListQuery(qk.questions.list(), questionsService.list);
  const assessmentsQuery = useListQuery(qk.assessments.list(), assessmentsService.list);
  const summaryQuery = useListQuery(qk.analytics.list(["summary"]), () =>
    analyticsService.summary(),
  );

  const needsReview =
    questionsQuery.data?.filter((q) => q.status === "NEEDS_REVIEW").length ?? 0;
  const openAssessments =
    assessmentsQuery.data?.filter((a) => a.status === "PUBLISHED").length ?? 0;
  const draftAssessments =
    assessmentsQuery.data?.filter((a) => a.status === "DRAFT").length ?? 0;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.name.split(" ")[0] ?? ""}`}
        description="Here's what needs your attention across your trainings today."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/questions">Add question</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app/assessments/new">
                <Plus className="mr-1.5 h-4 w-4" /> Create assessment
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            label="Active trainings"
            value={trainingsQuery.data?.length ?? 0}
            hint="across all subjects"
            icon={<GraduationCap className="h-4 w-4" />}
          />
          <MetricCard
            label="Questions to review"
            value={needsReview}
            hint="awaiting your decision"
            icon={<Brain className="h-4 w-4" />}
          />
          <MetricCard
            label="Open assessments"
            value={openAssessments}
            hint={`${draftAssessments} in draft`}
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <MetricCard
            label="Recent submissions"
            value={summaryQuery.data?.attemptCount ?? 0}
            hint="submitted attempts"
            icon={<Eye className="h-4 w-4" />}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items needing review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ReviewRow
              label={`${needsReview} questions need review`}
              hint="Awaiting your decision"
              to="/app/questions"
            />
            <ReviewRow
              label={`${draftAssessments} assessments in draft`}
              hint="Continue editing"
              to="/app/assessments"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ReviewRow({ label, hint, to }: { label: string; hint: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-start justify-between rounded-md border bg-card p-3 hover:bg-muted/50"
    >
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <AlertCircle className="h-4 w-4 text-amber-500" />
    </Link>
  );
}

// ---------- Admin ----------

function AdminDashboard() {
  const usersQuery = useListQuery(qk.users.list(), usersService.list);
  const trainingsQuery = useListQuery(qk.trainings.list(), trainingsService.list);
  const aiModelsQuery = useListQuery(qk.aiModels.list(), aiService.listModels);
  const enabledModels = aiModelsQuery.data?.filter((m) => m.isActive).length ?? 0;
  const instructorCount =
    usersQuery.data?.filter((u) => u.role === "INSTRUCTOR").length ?? 0;

  return (
    <>
      <PageHeader
        title="Admin overview"
        description="System-level health and configuration."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/users">
                <UserPlus className="mr-1.5 h-4 w-4" /> Invite user
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app/ai-models">
                <Cpu className="mr-1.5 h-4 w-4" /> Add AI model
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            label="Total users"
            value={usersQuery.data?.length ?? 0}
            icon={<Users className="h-4 w-4" />}
          />
          <MetricCard
            label="Active trainings"
            value={trainingsQuery.data?.length ?? 0}
            icon={<GraduationCap className="h-4 w-4" />}
          />
          <MetricCard
            label="Instructors"
            value={instructorCount}
            icon={<GraduationCap className="h-4 w-4" />}
          />
          <MetricCard
            label="AI models enabled"
            value={`${enabledModels} / ${aiModelsQuery.data?.length ?? 0}`}
            icon={<Brain className="h-4 w-4" />}
          />
        </div>
      </div>
    </>
  );
}

// ---------- Participant ----------

function ParticipantDashboard() {
  const { user } = useRole();

  // Real participant data (mirrors the pattern in app.my-assessments.tsx /
  // app.my-results.tsx): fetch available assessments, then fan out to each
  // remembered attempt id to learn the actual per-assessment state.
  const assessmentsQuery = useListQuery(
    qk.assessments.list({ scope: "available" }),
    assessmentsService.listAvailable,
  );

  const attemptQueries = useAttemptFanOut(assessmentsQuery.data);

  const cards = (assessmentsQuery.data ?? []).map((assessment, index) => ({
    assessment,
    attempt: attemptQueries[index]?.data,
  }));

  const todoCount = cards.filter(
    ({ attempt }) => participantAssessmentState(attempt) === "To do",
  ).length;
  const inProgressCount = cards.filter(
    ({ attempt }) => participantAssessmentState(attempt) === "In progress",
  ).length;
  const completedAttempts = cards
    .map(({ attempt }) => attempt)
    .filter((attempt): attempt is AssessmentAttempt => Boolean(attempt))
    .filter((attempt) => attempt.status === "SUBMITTED" || attempt.status === "GRADED");

  const scoredAttempts = completedAttempts
    .filter(
      (attempt): attempt is AssessmentAttempt & { score: number; maxScore: number } =>
        typeof attempt.score === "number" &&
        typeof attempt.maxScore === "number" &&
        attempt.maxScore > 0,
    )
    .sort((left, right) => {
      const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
      const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
      return rightTime - leftTime;
    });
  const latestScorePercentage =
    scoredAttempts.length > 0
      ? Math.round((scoredAttempts[0].score / scoredAttempts[0].maxScore) * 100)
      : null;

  // Chronological (oldest first) view of the same real scored attempts, for
  // the "progress over time" chart below.
  const progressData = [...scoredAttempts]
    .sort((left, right) => {
      const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
      const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
      return leftTime - rightTime;
    })
    .map((attempt) => ({
      date: attempt.submittedAt
        ? new Date(attempt.submittedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : "—",
      score: Math.round((attempt.score / attempt.maxScore) * 100),
    }));

  const upNext = cards.filter(
    ({ attempt }) => participantAssessmentState(attempt) !== "Completed",
  );

  return (
    <>
      <PageHeader
        title={`Hi, ${user?.name.split(" ")[0] ?? ""}`}
        description="Your assigned assessments and progress."
        actions={
          upNext.length > 0 ? (
            <Button asChild size="sm">
              <Link to="/app/my-assessments">Open my assessments</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/app/my-results">View my results</Link>
            </Button>
          )
        }
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard label="To do" value={todoCount} />
          <MetricCard label="In progress" value={inProgressCount} />
          <MetricCard label="Completed" value={completedAttempts.length} />
          <MetricCard
            label="Latest score"
            value={latestScorePercentage !== null ? `${latestScorePercentage}%` : "—"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Progress over time</CardTitle>
            </CardHeader>
            <CardContent>
              {progressData.length > 0 ? (
                <div className="h-56 w-full">
                  <ResponsiveContainer>
                    <LineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="currentColor" fontSize={11} />
                      <YAxis stroke="currentColor" fontSize={11} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          fontSize: 12,
                        }}
                      />
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
              ) : (
                <EmptyState
                  title="No completed assessments yet"
                  description="Your score history will appear here once you submit an assessment."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Up next</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upNext.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing due — you're all caught up.</p>
              ) : (
                upNext.map(({ assessment, attempt }) => (
                  <Link
                    key={assessment.id}
                    to="/app/my-assessments"
                    className="block rounded-md border bg-card p-3 hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{assessment.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {assessment.training?.title ?? "—"}
                        </div>
                      </div>
                      <StatusBadge status={participantAssessmentState(attempt)} />
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {assessment.timeLimitMinutes
                        ? `${assessment.timeLimitMinutes} min`
                        : "No time limit"}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function participantAssessmentState(
  attempt?: Pick<AssessmentAttempt, "status">,
): "To do" | "In progress" | "Completed" {
  if (!attempt) return "To do";
  if (attempt.status === "IN_PROGRESS") return "In progress";
  if (attempt.status === "SUBMITTED" || attempt.status === "GRADED") return "Completed";
  return "To do";
}
