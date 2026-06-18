import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users, GraduationCap, ClipboardList, Brain, AlertCircle, Plus,
  UserPlus, Cpu, Eye,
} from "lucide-react";
import { useRole } from "@/lib/role-context";
import { PageHeader } from "@/components/common/PageHeader";
import { MetricCard } from "@/components/common/MetricCard";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { TRAININGS, ASSESSMENTS, USERS, AI_MODELS, RECENT_ACTIVITY, MY_ASSESSMENTS, QUESTIONS, PROGRESS_OVER_TIME } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardRouter,
});

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
  const needsReview = QUESTIONS.filter((q) => q.status === "Needs Review").length;
  const openAssessments = ASSESSMENTS.filter((a) => a.status === "Open").length;
  const draftAssessments = ASSESSMENTS.filter((a) => a.status === "Draft").length;

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
          <MetricCard label="Active trainings" value={TRAININGS.length} hint="across all subjects" icon={<GraduationCap className="h-4 w-4" />} />
          <MetricCard label="Questions to review" value={needsReview + aiDrafts} hint={`${aiDrafts} AI drafts`} icon={<Brain className="h-4 w-4" />} />
          <MetricCard label="Open assessments" value={openAssessments} hint={`${draftAssessments} in draft`} icon={<ClipboardList className="h-4 w-4" />} />
          <MetricCard label="Recent submissions" value="14" hint="last 24 hours" icon={<Eye className="h-4 w-4" />} />
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
                <Link to="/app/assessments/a1/post-test">Create post-test</Link>
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
                      <Link to="/app/assessments/a1/results">View results</Link>
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
              <ReviewRow label={`${aiDrafts} AI question drafts`} hint="Review or approve" to="/app/questions" />
              <ReviewRow label={`${needsReview} questions need review`} hint="Awaiting your decision" to="/app/questions" />
              <ReviewRow label={`${draftAssessments} assessments in draft`} hint="Continue editing" to="/app/assessments" />
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
    <Link to={to} className="flex items-start justify-between rounded-md border bg-card p-3 hover:bg-muted/50">
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
  const activeInstructors = USERS.filter((u) => u.role === "instructor" && u.status === "Active").length;
  const enabledModels = AI_MODELS.filter((m) => m.enabled).length;
  const openAssessments = ASSESSMENTS.filter((a) => a.status === "Open").length;
  return (
    <>
      <PageHeader
        title="Admin overview"
        description="System-level health, usage and configuration warnings."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/users"><UserPlus className="mr-1.5 h-4 w-4" /> Invite user</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app/ai-models"><Cpu className="mr-1.5 h-4 w-4" /> Add AI model</Link>
            </Button>
          </>
        }
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard label="Total users" value={USERS.length} icon={<Users className="h-4 w-4" />} />
          <MetricCard label="Active trainings" value={TRAININGS.length} icon={<GraduationCap className="h-4 w-4" />} />
          <MetricCard label="Active instructors" value={activeInstructors} icon={<GraduationCap className="h-4 w-4" />} />
          <MetricCard label="Total assessments" value={ASSESSMENTS.length} hint={`${openAssessments} open now`} icon={<ClipboardList className="h-4 w-4" />} />
          <MetricCard label="AI models enabled" value={`${enabledModels} / ${AI_MODELS.length}`} icon={<Brain className="h-4 w-4" />} />
          <MetricCard label="Submissions (7d)" value="142" icon={<Eye className="h-4 w-4" />} />
          <MetricCard label="Completion rate" value="78%" icon={<ClipboardList className="h-4 w-4" />} />
          <MetricCard label="AI usage (7d)" value="68 calls" icon={<Brain className="h-4 w-4" />} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Warnings</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <WarnRow tone="warning" title="1 user without assigned role" body="Review pending invitation" />
              <WarnRow tone="warning" title="Disabled AI model in past config" body="“Legacy Local” referenced by 2 old drafts" />
              <WarnRow tone="info" title={`${openAssessments} assessments currently open`} body="Monitor live sessions" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent system activity</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y">
                {RECENT_ACTIVITY.map((a, i) => (
                  <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <div><span className="font-medium">{a.who}</span> <span className="text-muted-foreground">{a.what}</span></div>
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
  const next = MY_ASSESSMENTS.find((a) => a.status !== "Completed");
  const completed = MY_ASSESSMENTS.filter((a) => a.status === "Completed");
  const latest = completed[0];

  return (
    <>
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Your assigned assessments and progress."
        actions={
          next ? (
            <Button asChild size="sm">
              <Link to="/assessment/$id/access" params={{ id: next.id }}>
                {next.status === "In progress" ? "Continue" : "Start next assessment"}
              </Link>
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
          <MetricCard label="To do" value={MY_ASSESSMENTS.filter(a => a.status === "To do").length} />
          <MetricCard label="In progress" value={MY_ASSESSMENTS.filter(a => a.status === "In progress").length} />
          <MetricCard label="Completed" value={completed.length} />
          <MetricCard label="Latest score" value={latest?.score ? `${latest.score}%` : "—"} hint={latest?.title} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Progress over time</CardTitle></CardHeader>
            <CardContent>
              <div className="h-56 w-full">
                <ResponsiveContainer>
                  <LineChart data={PROGRESS_OVER_TIME}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="currentColor" fontSize={11} />
                    <YAxis stroke="currentColor" fontSize={11} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} />
                    <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Up next</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {MY_ASSESSMENTS.filter((a) => a.status !== "Completed").map((a) => (
                <Link
                  key={a.id}
                  to="/assessment/$id/access"
                  params={{ id: a.id }}
                  className="block rounded-md border bg-card p-3 hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{a.training}</div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Due {a.due} · {a.timeLimit} min
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
