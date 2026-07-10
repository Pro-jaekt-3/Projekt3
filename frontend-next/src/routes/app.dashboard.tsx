import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
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
import { StatusBadge } from "@/components/common/StatusBadge";
import { ASSESSMENTS, USERS, RECENT_ACTIVITY, QUESTIONS, PROGRESS_OVER_TIME } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { assessmentAttemptsService } from "@/services/assessmentAttempts";
import { getAttemptId } from "@/lib/attempt-storage";
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
  const aiDrafts = QUESTIONS.filter((q) => q.source === "ai" && q.status !== "Approved").length;
  const openAssessments = ASSESSMENTS.filter((a) => a.status === "Open").length;
  const draftAssessments = ASSESSMENTS.filter((a) => a.status === "Draft").length;

  const trainingsQuery = useListQuery(qk.trainings.list(), trainingsService.list);
  const questionsQuery = useListQuery(qk.questions.list(), questionsService.list);
  const summaryQuery = useListQuery(qk.analytics.list(["summary"]), () =>
    analyticsService.summary(),
  );

  const needsReview =
    questionsQuery.data?.filter((q) => q.status === "NEEDS_REVIEW").length ?? 0;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
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
            value={needsReview + aiDrafts}
            hint={`${aiDrafts} AI drafts`}
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

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Recommended next action</CardTitle>
                <CardDescription>
                  Results from the Databases pre-test show weak performance in SQL Joins.
                </CardDescription>
              </div>
              <Button asChild size="sm">
                <Link to="/app/assessments">Create post-test</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium">Databases — Pre-test</div>
                    <div className="text-xs text-muted-foreground">
                      26 / 28 submitted · Avg 64% · Weakest: SQL Joins (49%)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/app/assessments">View results</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items needing review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <ReviewRow
                label={`${aiDrafts} AI question drafts`}
                hint="Review or approve"
                to="/app/questions"
              />
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {RECENT_ACTIVITY.map((a, i) => (
                <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="font-medium">{a.who}</span>{" "}
                    <span className="text-muted-foreground">{a.what}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{a.when}</span>
                </li>
              ))}
            </ul>
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
  const activeInstructors = USERS.filter(
    (u) => u.role === "instructor" && u.status === "Active",
  ).length;
  const openAssessments = ASSESSMENTS.filter((a) => a.status === "Open").length;

  const usersQuery = useListQuery(qk.users.list(), usersService.list);
  const trainingsQuery = useListQuery(qk.trainings.list(), trainingsService.list);
  const aiModelsQuery = useListQuery(qk.aiModels.list(), aiService.listModels);
  const enabledModels = aiModelsQuery.data?.filter((m) => m.isActive).length ?? 0;

  return (
    <>
      <PageHeader
        title="Admin overview"
        description="System-level health, usage and configuration warnings."
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
            label="Active instructors"
            value={activeInstructors}
            icon={<GraduationCap className="h-4 w-4" />}
          />
          <MetricCard
            label="Total assessments"
            value={ASSESSMENTS.length}
            hint={`${openAssessments} open now`}
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <MetricCard
            label="AI models enabled"
            value={`${enabledModels} / ${aiModelsQuery.data?.length ?? 0}`}
            icon={<Brain className="h-4 w-4" />}
          />
          <MetricCard label="Submissions (7d)" value="142" icon={<Eye className="h-4 w-4" />} />
          <MetricCard
            label="Completion rate"
            value="78%"
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <MetricCard label="AI usage (7d)" value="68 calls" icon={<Brain className="h-4 w-4" />} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Warnings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <WarnRow
                tone="warning"
                title="1 user without assigned role"
                body="Review pending invitation"
              />
              <WarnRow
                tone="warning"
                title="Disabled AI model in past config"
                body="“Legacy Local” referenced by 2 old drafts"
              />
              <WarnRow
                tone="info"
                title={`${openAssessments} assessments currently open`}
                body="Monitor live sessions"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent system activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {RECENT_ACTIVITY.map((a, i) => (
                  <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <span className="font-medium">{a.who}</span>{" "}
                      <span className="text-muted-foreground">{a.what}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{a.when}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function WarnRow({ tone, title, body }: { tone: "warning" | "info"; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-card p-3">
      <StatusBadge status={tone === "warning" ? "Warning" : "Info"} tone={tone} />
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{body}</div>
      </div>
    </div>
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

  const attemptQueries = useQueries({
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

  const upNext = cards.filter(
    ({ attempt }) => participantAssessmentState(attempt) !== "Completed",
  );

  return (
    <>
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
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
              <div className="h-56 w-full">
                <ResponsiveContainer>
                  <LineChart data={PROGRESS_OVER_TIME}>
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
