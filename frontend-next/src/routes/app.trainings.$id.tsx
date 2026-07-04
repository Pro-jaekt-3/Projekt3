import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  UserPlus,
  Library,
  ClipboardList,
  BarChart3,
  BookOpen,
  Users,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Filter,
  Pencil,
  Search,
  Trash2,
  Copy,
  RefreshCw,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RECENT_ACTIVITY } from "@/lib/mock-data";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useRole } from "@/lib/role-context";
import { qk } from "@/lib/query-keys";
import { trainingsService } from "@/services/trainings";
import { topicsService } from "@/services/topics";
import { learningObjectivesService } from "@/services/learningObjectives";
import { questionsService } from "@/services/questions";
import { usersService } from "@/services/users";
import { assessmentsService } from "@/services/assessments";
import { analyticsService } from "@/services/analytics";
import { userTrainingsService } from "@/services/userTrainings";
import { trainingToView } from "@/lib/training-view";
import { ensureRole } from "@/lib/route-guards";
import type { Topic, LearningObjective, TrainingRole, UserTraining } from "@/types";

export const Route = createFileRoute("/app/trainings/$id")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: TrainingDetail,
});

const QUESTION_DIFFICULTY_LABEL: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };

const ASSESSMENT_TYPE_LABEL: Record<string, string> = {
  PRE_TEST: "Pre-test",
  POST_TEST: "Post-test",
  QUIZ: "Quiz",
};

const ASSESSMENT_STATUS_META: Record<
  string,
  { label: string; tone: "muted" | "warning" | "success" | "danger" | "neutral" }
> = {
  DRAFT: { label: "Draft", tone: "muted" },
  PUBLISHED: { label: "Published", tone: "success" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

const QUESTION_STATUS_META: Record<
  string,
  { label: string; tone: "muted" | "warning" | "success" | "danger" | "neutral" }
> = {
  DRAFT: { label: "Draft", tone: "muted" },
  NEEDS_REVIEW: { label: "Needs Review", tone: "warning" },
  REVIEW: { label: "In Review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

function TrainingDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useRole();
  const isAdmin = role === "admin";

  const trainingQuery = useQuery({
    queryKey: qk.trainings.detail(id),
    queryFn: () => trainingsService.get(id),
  });

  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const editMutation = useMutation({
    mutationFn: () =>
      trainingsService.update(id, { title: title.trim(), description: description.trim() || null }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: qk.trainings.detail(id) });
      queryClient.invalidateQueries({ queryKey: qk.trainings.lists() });
      toast.success(`Saved “${updated.title}”`);
      setEditOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save training"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => trainingsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.trainings.all });
      toast.success("Training deleted");
      setDeleteOpen(false);
      navigate({ to: "/app/trainings" });
    },
    // FK 500 ("training in use") and any other failure land here with the
    // backend `{ error }` message extracted by apiClient.
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete training"),
  });

  // --- Curriculum: topics + learning objectives (real API) ---
  const topicsQuery = useQuery({
    queryKey: qk.topics.list(),
    queryFn: topicsService.list,
  });
  const objectivesQuery = useQuery({
    queryKey: qk.learningObjectives.list(),
    queryFn: () => learningObjectivesService.list(),
  });

  const trainingTopics = (topicsQuery.data ?? []).filter((t) => t.trainingId === Number(id));
  const trainingTopicIds = new Set(trainingTopics.map((t) => t.id));
  const objectivesByTopic = (objectivesQuery.data ?? [])
    .filter((o) => trainingTopicIds.has(o.topicId))
    .reduce<Record<number, LearningObjective[]>>((acc, o) => {
      (acc[o.topicId] ??= []).push(o);
      return acc;
    }, {});
  const totalObjectives = Object.values(objectivesByTopic).reduce((s, arr) => s + arr.length, 0);

  // --- Question Bank tab: questions for this training's topics (real API) ---
  const questionsQuery = useQuery({
    queryKey: qk.questions.list(),
    queryFn: questionsService.list,
  });
  const assessmentsQuery = useQuery({
    queryKey: qk.assessments.list(),
    queryFn: assessmentsService.list,
  });
  const analyticsSummaryQuery = useQuery({
    queryKey: qk.analytics.list(["summary", { trainingId: Number(id) }]),
    queryFn: () => analyticsService.summary({ trainingId: Number(id) }),
  });
  const analyticsPrePostQuery = useQuery({
    queryKey: qk.analytics.list(["pre-post-comparison", Number(id)]),
    queryFn: () => analyticsService.prePostComparison({ trainingId: Number(id) }),
  });
  const analyticsByTopicQuery = useQuery({
    queryKey: qk.analytics.list(["by-topic", { trainingId: Number(id) }]),
    queryFn: () => analyticsService.byTopic({ trainingId: Number(id) }),
  });
  const [questionSearch, setQuestionSearch] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [pendingMemberUserId, setPendingMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<TrainingRole>("PARTICIPANT");
  const [memberRemoveTarget, setMemberRemoveTarget] = useState<UserTraining | null>(null);

  // Real UserTraining memberships (GET /trainings/:id/members — ADMIN or owner).
  const membersQuery = useQuery({
    queryKey: qk.userTrainings.list(Number(id)),
    queryFn: () => userTrainingsService.listMembers(id),
  });
  const members = membersQuery.data ?? [];
  const instructorMembers = members.filter((m) => m.role === "INSTRUCTOR");
  const participantMembers = members.filter((m) => m.role === "PARTICIPANT");
  const visibleParticipantMembers = participantMembers.filter((m) => {
    if (!participantSearch) return true;
    const q = participantSearch.toLowerCase();
    return (
      (m.user?.name ?? "").toLowerCase().includes(q) ||
      (m.user?.email ?? "").toLowerCase().includes(q)
    );
  });

  // Admin picks from the full user list; instructors add members by email
  // (GET /users is ADMIN-only).
  const usersQuery = useQuery({
    queryKey: qk.users.list(),
    queryFn: usersService.list,
    enabled: isAdmin,
  });
  const memberUserIds = new Set(members.map((m) => m.userId));
  const addableUsers = (usersQuery.data ?? []).filter((u) => !memberUserIds.has(u.id));

  const topicsById = new Map(trainingTopics.map((t) => [t.id, t]));
  const objectivesById = new Map((objectivesQuery.data ?? []).map((o) => [o.id, o]));
  const trainingQuestions = (questionsQuery.data ?? []).filter((q) =>
    trainingTopicIds.has(q.topicId),
  );
  // Real readiness counts derived from the question bank (replaces hardcoded fakes).
  const approvedQuestionCount = trainingQuestions.filter((q) => q.status === "APPROVED").length;
  const needsReviewQuestionCount = trainingQuestions.filter((q) => q.status === "REVIEW").length;
  const visibleQuestions = trainingQuestions.filter((q) =>
    questionSearch
      ? q.title.toLowerCase().includes(questionSearch.toLowerCase()) ||
        q.description.toLowerCase().includes(questionSearch.toLowerCase())
      : true,
  );

  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [topicName, setTopicName] = useState("");
  const [topicDeleteTarget, setTopicDeleteTarget] = useState<Topic | null>(null);

  const [objectiveDialogOpen, setObjectiveDialogOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<LearningObjective | null>(null);
  const [objectiveTitle, setObjectiveTitle] = useState("");
  const [objectiveDescription, setObjectiveDescription] = useState("");
  const [objectiveTopicId, setObjectiveTopicId] = useState("");
  const [objectiveDeleteTarget, setObjectiveDeleteTarget] = useState<LearningObjective | null>(
    null,
  );

  const openCreateTopic = () => {
    setEditingTopic(null);
    setTopicName("");
    setTopicDialogOpen(true);
  };
  const openEditTopic = (topic: Topic) => {
    setEditingTopic(topic);
    setTopicName(topic.name);
    setTopicDialogOpen(true);
  };

  const topicMutation = useMutation({
    mutationFn: () =>
      editingTopic
        ? topicsService.update(editingTopic.id, { name: topicName.trim() })
        : topicsService.create({ name: topicName.trim(), trainingId: Number(id) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.topics.all });
      queryClient.invalidateQueries({ queryKey: qk.questions.all });
      toast.success(editingTopic ? "Topic updated" : "Topic created");
      setTopicDialogOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save topic"),
  });

  const deleteTopicMutation = useMutation({
    mutationFn: (topicId: number) => topicsService.remove(topicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.topics.all });
      toast.success("Topic deleted");
      setTopicDeleteTarget(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete topic"),
  });

  const openCreateObjective = (topicId?: number) => {
    setEditingObjective(null);
    setObjectiveTitle("");
    setObjectiveDescription("");
    setObjectiveTopicId(topicId ? String(topicId) : (trainingTopics[0]?.id.toString() ?? ""));
    setObjectiveDialogOpen(true);
  };
  const openEditObjective = (objective: LearningObjective) => {
    setEditingObjective(objective);
    setObjectiveTitle(objective.title);
    setObjectiveDescription(objective.description ?? "");
    setObjectiveTopicId(String(objective.topicId));
    setObjectiveDialogOpen(true);
  };

  const objectiveMutation = useMutation({
    mutationFn: () =>
      editingObjective
        ? learningObjectivesService.update(editingObjective.id, {
            title: objectiveTitle.trim(),
            description: objectiveDescription.trim() || null,
            topicId: Number(objectiveTopicId),
          })
        : learningObjectivesService.create({
            title: objectiveTitle.trim(),
            description: objectiveDescription.trim() || null,
            topicId: Number(objectiveTopicId),
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.learningObjectives.all });
      toast.success(editingObjective ? "Learning objective updated" : "Learning objective created");
      setObjectiveDialogOpen(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to save learning objective"),
  });

  const deleteObjectiveMutation = useMutation({
    mutationFn: (objectiveId: number) => learningObjectivesService.remove(objectiveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.learningObjectives.all });
      // Question.learningObjectiveId is ON DELETE SET NULL, so deleting this
      // objective detaches (not blocks) any questions that referenced it —
      // refresh questions too so the Question Bank tab doesn't show stale data.
      queryClient.invalidateQueries({ queryKey: qk.questions.all });
      toast.success("Learning objective deleted");
      setObjectiveDeleteTarget(null);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete learning objective"),
  });

  const addMemberMutation = useMutation({
    mutationFn: () =>
      userTrainingsService.addMember(id, {
        ...(isAdmin && pendingMemberUserId
          ? { userId: Number(pendingMemberUserId) }
          : { email: memberEmail.trim() }),
        role: memberRole,
      }),
    onSuccess: (membership) => {
      queryClient.invalidateQueries({ queryKey: qk.userTrainings.all });
      toast.success(
        membership.role === "INSTRUCTOR"
          ? `Ownership granted to ${membership.user?.email ?? "user"}`
          : `${membership.user?.email ?? "User"} enrolled as participant`,
      );
      setAddMemberOpen(false);
      setMemberEmail("");
      setPendingMemberUserId("");
      setMemberRole("PARTICIPANT");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add member"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (member: UserTraining) => userTrainingsService.removeMember(id, member.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.userTrainings.all });
      toast.success("Member removed");
      setMemberRemoveTarget(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove member"),
  });

  const regenerateTokenMutation = useMutation({
    mutationFn: () => userTrainingsService.regenerateToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.trainings.detail(id) });
      toast.success("Enrollment code regenerated — previous QR links no longer work");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to regenerate the code"),
  });

  if (trainingQuery.isLoading) {
    return <LoadingState label="Loading training…" />;
  }

  if (trainingQuery.isError || !trainingQuery.data) {
    const message =
      trainingQuery.error instanceof Error
        ? trainingQuery.error.message
        : "Failed to load training";
    if (/not found/i.test(message)) {
      return (
        <div className="p-8">
          <EmptyState
            title="Training not found"
            description="The training you are looking for does not exist or was archived."
          />
        </div>
      );
    }
    return <ErrorState message={message} onRetry={() => trainingQuery.refetch()} />;
  }

  const training = trainingToView(trainingQuery.data);
  const trainingAssessments = (assessmentsQuery.data ?? []).filter(
    (a) => Number(a.trainingId) === Number(id),
  );

  const topicData = analyticsByTopicQuery.data ?? [];
  const topicsSortedAsc = [...topicData].sort((a, b) => a.percentage - b.percentage);
  const topicsSortedDesc = [...topicData].sort((a, b) => b.percentage - a.percentage);
  const weakestTopic = topicsSortedAsc[0] ?? null;
  const strongestTopic = topicsSortedDesc[0] ?? null;
  const prePostData = analyticsPrePostQuery.data ?? null;
  const summaryData = analyticsSummaryQuery.data ?? null;

  const openEdit = () => {
    setTitle(trainingQuery.data.title);
    setDescription(trainingQuery.data.description ?? "");
    setEditOpen(true);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to="/app/trainings" className="hover:underline">
            My trainings
          </Link>
        }
        title={training.title}
        description={training.description}
        meta={
          <>
            <StatusBadge status={training.status} />
            <span>·</span>
            <span>{participantMembers.length} participants</span>
            <span>·</span>
            <span>Updated {training.lastActivity}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddMemberOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Add member
            </Button>
            <Button asChild size="sm">
              <Link to="/app/assessments/new" search={{ trainingId: training.id } as never}>
                <Plus className="mr-1.5 h-4 w-4" /> Create assessment
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <MetricCard label="Participants" value={participantMembers.length} />
          <MetricCard label="Learning objectives" value={totalObjectives} />
          <MetricCard
            label="Approved questions"
            value={approvedQuestionCount}
            hint={`${trainingQuestions.length} total`}
          />
          <MetricCard
            label="Active assessments"
            value={trainingAssessments.filter((a) => a.status === "PUBLISHED").length}
          />
          <MetricCard
            label="Average score"
            value={`${analyticsSummaryQuery.data?.averageScorePercentage ?? 0}%`}
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
            <TabsTrigger value="questions">Question Bank</TabsTrigger>
            <TabsTrigger value="assessments">Assessments</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Question bank readiness</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Readiness
                    label="Approved questions"
                    value={approvedQuestionCount}
                    total={trainingQuestions.length}
                    tone="success"
                  />
                  <Readiness
                    label="Questions needing review"
                    value={needsReviewQuestionCount}
                    total={trainingQuestions.length}
                    tone="warning"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recommended next actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Recommend
                    title="Review pending questions"
                    body="Approve or reject questions before they can be used in assessments."
                    to="/app/questions"
                  />
                  <Recommend
                    title="Manage equivalent groups"
                    body="Group interchangeable question variants for post-tests."
                    to="/app/questions/equivalent-groups"
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assessment timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <TimelineStep
                    status="pending"
                    title="Pre-test"
                    detail="Awaiting assessment data"
                  />
                  <TimelineStep
                    status="pending"
                    title="Learning period"
                    detail="Practice & feedback"
                  />
                  <TimelineStep
                    status="pending"
                    title="Post-test"
                    detail="Awaiting assessment data"
                  />
                </div>
              </CardContent>
            </Card>

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
          </TabsContent>

          {/* PARTICIPANTS / MEMBERS */}
          <TabsContent value="participants" className="mt-4 space-y-4">
            {/* QR / enrollment code (owner or admin — token comes from GET /trainings/:id) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-4 w-4" /> Self-enrollment link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {trainingQuery.data.enrollmentToken ? (
                  <>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        readOnly
                        className="font-mono text-xs"
                        value={`${window.location.origin}/app/join?trainingId=${id}&token=${trainingQuery.data.enrollmentToken}`}
                      />
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard
                              .writeText(
                                `${window.location.origin}/app/join?trainingId=${id}&token=${trainingQuery.data.enrollmentToken}`,
                              )
                              .then(() => toast.success("Enrollment link copied"))
                              .catch(() => toast.error("Could not copy the link"));
                          }}
                        >
                          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => regenerateTokenMutation.mutate()}
                          disabled={regenerateTokenMutation.isPending}
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          {regenerateTokenMutation.isPending ? "Regenerating…" : "Regenerate"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Share this link (or a QR code pointing to it) with participants — opening it
                      enrolls them into this training. Regenerating invalidates previously shared
                      links.
                    </p>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      No enrollment code yet. Generate one to let participants self-enroll via QR.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateTokenMutation.mutate()}
                      disabled={regenerateTokenMutation.isPending}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Generate code
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Instructors (ownership) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base">Instructors</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMemberRole("INSTRUCTOR");
                    setAddMemberOpen(true);
                  }}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Add instructor
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {membersQuery.isLoading ? (
                  <LoadingState label="Loading members…" />
                ) : membersQuery.isError ? (
                  <ErrorState
                    message={
                      membersQuery.error instanceof Error
                        ? membersQuery.error.message
                        : "Failed to load members"
                    }
                    onRetry={() => membersQuery.refetch()}
                  />
                ) : instructorMembers.length === 0 ? (
                  <div className="rounded-md border border-dashed bg-surface p-3 text-xs text-muted-foreground">
                    No instructor owner yet{isAdmin ? " — grant ownership to an instructor." : "."}
                  </div>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {instructorMembers.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{m.user?.name ?? "—"}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {m.user?.email}
                          </div>
                        </div>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setMemberRemoveTarget(m)}
                            title="Revoke ownership (admin only)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Participants (enrollment) */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <Input
                  placeholder="Search by name or email"
                  className="max-w-sm"
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                />
                <Button variant="outline" size="sm" className="shrink-0" disabled>
                  <Filter className="mr-1.5 h-4 w-4" /> Filters
                </Button>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setMemberRole("PARTICIPANT");
                  setAddMemberOpen(true);
                }}
              >
                <UserPlus className="mr-1.5 h-4 w-4" /> Add participant
              </Button>
            </div>

            {membersQuery.isLoading ? (
              <LoadingState label="Loading participants…" />
            ) : membersQuery.isError ? (
              <ErrorState
                message={
                  membersQuery.error instanceof Error
                    ? membersQuery.error.message
                    : "Failed to load participants"
                }
                onRetry={() => membersQuery.refetch()}
              />
            ) : participantMembers.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No participants yet"
                description="Enroll participants directly or share the self-enrollment link above."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setMemberRole("PARTICIPANT");
                      setAddMemberOpen(true);
                    }}
                  >
                    <UserPlus className="mr-1.5 h-4 w-4" /> Add participant
                  </Button>
                }
              />
            ) : visibleParticipantMembers.length === 0 ? (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No participants match your search"
                description="Try a different name or email."
              />
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Participant</TableHead>
                        <TableHead className="hidden sm:table-cell">Email</TableHead>
                        <TableHead className="hidden md:table-cell">Enrolled</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleParticipantMembers.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <div className="font-medium">{m.user?.name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground sm:hidden">
                              {m.user?.email}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {m.user?.email}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                            {new Date(m.enrolledAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMemberRemoveTarget(m)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* CURRICULUM */}
          <TabsContent value="curriculum" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Topics and learning objectives live here — not as separate pages.
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={openCreateTopic}>
                  Add topic
                </Button>
                <Button
                  size="sm"
                  onClick={() => openCreateObjective()}
                  disabled={trainingTopics.length === 0}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add objective
                </Button>
              </div>
            </div>

            {topicsQuery.isLoading || objectivesQuery.isLoading ? (
              <LoadingState label="Loading curriculum…" />
            ) : topicsQuery.isError || objectivesQuery.isError ? (
              <ErrorState
                message={
                  topicsQuery.error instanceof Error
                    ? topicsQuery.error.message
                    : objectivesQuery.error instanceof Error
                      ? objectivesQuery.error.message
                      : "Failed to load curriculum"
                }
                onRetry={() => {
                  topicsQuery.refetch();
                  objectivesQuery.refetch();
                }}
              />
            ) : trainingTopics.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-5 w-5" />}
                title="Define topics and learning objectives"
                description="Define topics and learning objectives before creating assessment blueprints."
                action={
                  <Button size="sm" onClick={openCreateTopic}>
                    <Plus className="mr-1.5 h-4 w-4" /> Add topic
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {trainingTopics.map((topic) => {
                  const objectives = objectivesByTopic[topic.id] ?? [];
                  return (
                    <Card key={topic.id}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                        <div>
                          <CardTitle className="text-sm">{topic.name}</CardTitle>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {objectives.length} objective{objectives.length === 1 ? "" : "s"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditTopic(topic)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTopicDeleteTarget(topic)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-2">
                        {objectives.length === 0 ? (
                          <div className="rounded-md border border-dashed bg-surface p-3 text-xs text-muted-foreground">
                            No learning objectives yet.
                          </div>
                        ) : (
                          <ul className="divide-y rounded-md border">
                            {objectives.map((o) => (
                              <li
                                key={o.id}
                                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{o.title}</div>
                                  {o.description && (
                                    <div className="truncate text-xs text-muted-foreground">
                                      {o.description}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditObjective(o)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setObjectiveDeleteTarget(o)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCreateObjective(topic.id)}
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add objective
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* QUESTION BANK */}
          <TabsContent value="questions" className="mt-4 space-y-4">
            <Card className="bg-primary-soft border-primary/20">
              <CardContent className="flex flex-col items-start justify-between gap-2 p-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-2 text-sm">
                  <Sparkles className="mt-0.5 h-4 w-4 text-accent-foreground" />
                  <span>
                    <strong>Assessment readiness:</strong>{" "}
                    {trainingQuestions.filter((q) => q.status === "APPROVED").length} approved
                    question
                    {trainingQuestions.filter((q) => q.status === "APPROVED").length === 1
                      ? ""
                      : "s"}{" "}
                    out of {trainingQuestions.length} total.
                  </span>
                </div>
                <Button asChild size="sm">
                  <Link to="/app/questions">Open question bank</Link>
                </Button>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Input
                placeholder="Search question text"
                className="max-w-sm"
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
              />
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link to="/app/questions/$id" params={{ id: "new" }}>
                    <Plus className="mr-1.5 h-4 w-4" /> Create question
                  </Link>
                </Button>
              </div>
            </div>

            {questionsQuery.isLoading || topicsQuery.isLoading ? (
              <LoadingState label="Loading questions…" />
            ) : questionsQuery.isError ? (
              <ErrorState
                message={
                  questionsQuery.error instanceof Error
                    ? questionsQuery.error.message
                    : "Failed to load questions"
                }
                onRetry={() => questionsQuery.refetch()}
              />
            ) : trainingQuestions.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title="No questions yet"
                description="Create questions for this training's topics to start building assessments."
                action={
                  <Button asChild size="sm">
                    <Link to="/app/questions/$id" params={{ id: "new" }}>
                      <Plus className="mr-1.5 h-4 w-4" /> Create question
                    </Link>
                  </Button>
                }
              />
            ) : visibleQuestions.length === 0 ? (
              <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="No questions match your search"
                description="Try a different search term."
              />
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Question</TableHead>
                        <TableHead className="hidden md:table-cell">Topic</TableHead>
                        <TableHead className="hidden lg:table-cell">Objective</TableHead>
                        <TableHead className="hidden sm:table-cell">Difficulty</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleQuestions.map((q) => {
                        const statusMeta = QUESTION_STATUS_META[q.status];
                        return (
                          <TableRow key={q.id} className="cursor-pointer hover:bg-muted/40">
                            <TableCell className="max-w-md">
                              <Link
                                to="/app/questions/$id"
                                params={{ id: String(q.id) }}
                                className="line-clamp-2 font-medium hover:underline"
                              >
                                {q.title}
                              </Link>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {topicsById.get(q.topicId)?.name ?? "—"}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                              {q.learningObjectiveId
                                ? (objectivesById.get(q.learningObjectiveId)?.title ?? "—")
                                : "—"}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-xs">
                              {QUESTION_DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                status={statusMeta?.label ?? q.status}
                                tone={statusMeta?.tone}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ASSESSMENTS */}
          <TabsContent value="assessments" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Manage assessments for this training.
              </div>
              <Button asChild size="sm">
                <Link to="/app/assessments/new">
                  <Plus className="mr-1.5 h-4 w-4" /> Create assessment
                </Link>
              </Button>
            </div>

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
            ) : trainingAssessments.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title="No assessments yet"
                description="Create your first assessment to start collecting results."
                action={
                  <Button asChild size="sm">
                    <Link to="/app/assessments/new">
                      <Plus className="mr-1.5 h-4 w-4" /> Create assessment
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {trainingAssessments.map((a) => {
                  const statusMeta = ASSESSMENT_STATUS_META[a.status];
                  return (
                    <Card key={a.id}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              to="/app/assessments/$id"
                              params={{ id: String(a.id) }}
                              className="block truncate text-sm font-semibold hover:underline"
                            >
                              {a.title}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {ASSESSMENT_TYPE_LABEL[a.type] ?? a.type}
                            </div>
                          </div>
                          <StatusBadge
                            status={statusMeta?.label ?? a.status}
                            tone={statusMeta?.tone}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <KV label="Questions" value={a.questions?.length ?? "—"} />
                          <KV
                            label="Time limit"
                            value={a.timeLimitMinutes ? `${a.timeLimitMinutes} min` : "—"}
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <Button asChild variant="outline" size="sm">
                            <Link to="/app/assessments/$id" params={{ id: String(a.id) }}>
                              Open
                            </Link>
                          </Button>
                          {a.status !== "DRAFT" && (
                            <Button asChild size="sm">
                              <Link to="/app/assessments/$id/results" params={{ id: String(a.id) }}>
                                View results
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* RESULTS */}
          <TabsContent value="results" className="mt-4 space-y-4">
            {analyticsSummaryQuery.isLoading ||
            analyticsPrePostQuery.isLoading ||
            analyticsByTopicQuery.isLoading ? (
              <LoadingState label="Loading results…" />
            ) : analyticsSummaryQuery.isError ||
              analyticsPrePostQuery.isError ||
              analyticsByTopicQuery.isError ? (
              <ErrorState
                message={
                  (analyticsSummaryQuery.error instanceof Error
                    ? analyticsSummaryQuery.error.message
                    : null) ??
                  (analyticsPrePostQuery.error instanceof Error
                    ? analyticsPrePostQuery.error.message
                    : null) ??
                  (analyticsByTopicQuery.error instanceof Error
                    ? analyticsByTopicQuery.error.message
                    : null) ??
                  "Failed to load results"
                }
                onRetry={() => {
                  analyticsSummaryQuery.refetch();
                  analyticsPrePostQuery.refetch();
                  analyticsByTopicQuery.refetch();
                }}
              />
            ) : (summaryData?.attemptCount ?? 0) === 0 ? (
              <EmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="No results yet"
                description="Results appear here once participants submit their assessments."
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard
                    label="Average score"
                    value={`${summaryData?.averageScorePercentage ?? 0}%`}
                    trend={
                      (prePostData?.pairedUserCount ?? 0) > 0
                        ? {
                            value: `${(prePostData!.improvement ?? 0) >= 0 ? "+" : ""}${prePostData!.improvement ?? 0}%`,
                            positive: (prePostData!.improvement ?? 0) >= 0,
                          }
                        : undefined
                    }
                  />
                  <MetricCard label="Submitted attempts" value={summaryData?.attemptCount ?? 0} />
                  <MetricCard
                    label="Strongest topic"
                    value={strongestTopic?.topicTitle ?? "—"}
                    hint={strongestTopic ? `${strongestTopic.percentage}%` : undefined}
                  />
                  <MetricCard
                    label="Weakest topic"
                    value={weakestTopic?.topicTitle ?? "—"}
                    hint={weakestTopic ? `${weakestTopic.percentage}%` : undefined}
                  />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Pre-test vs post-test improvement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(prePostData?.pairedUserCount ?? 0) === 0 ? (
                        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                          No paired pre/post data yet.
                        </div>
                      ) : (
                        <div className="h-60">
                          <ResponsiveContainer>
                            <BarChart
                              data={[
                                {
                                  label: "Pre-test",
                                  score: prePostData!.preTest.averagePercentage,
                                },
                                {
                                  label: "Post-test",
                                  score: prePostData!.postTest.averagePercentage,
                                },
                              ]}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="label" fontSize={11} />
                              <YAxis domain={[0, 100]} fontSize={11} />
                              <Tooltip />
                              <Bar dataKey="score" fill="var(--primary)" radius={4} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Topic breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {topicData.length === 0 ? (
                        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                          No topic data yet.
                        </div>
                      ) : (
                        <div className="h-60">
                          <ResponsiveContainer>
                            <BarChart
                              data={topicData.map((t) => ({
                                topic: t.topicTitle,
                                score: t.percentage,
                              }))}
                              layout="vertical"
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" domain={[0, 100]} fontSize={11} />
                              <YAxis type="category" dataKey="topic" fontSize={11} width={100} />
                              <Tooltip />
                              <Bar dataKey="score" fill="var(--primary)" radius={4} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit training</DialogTitle>
            <DialogDescription>Update the training title and description.</DialogDescription>
          </DialogHeader>
          <form
            id="edit-training-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) {
                toast.error("Title is required");
                return;
              }
              editMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="edit-training-form" disabled={editMutation.isPending}>
              {editMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this training?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{training.title}”. If the training still has topics or
              assessments attached, the server will refuse to delete it — remove those first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Topic create/edit dialog */}
      <Dialog open={topicDialogOpen} onOpenChange={setTopicDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTopic ? "Edit topic" : "Add topic"}</DialogTitle>
            <DialogDescription>
              {editingTopic
                ? "Rename this topic."
                : "Add a topic to organize learning objectives and questions."}
            </DialogDescription>
          </DialogHeader>
          <form
            id="topic-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!topicName.trim()) {
                toast.error("Topic name is required");
                return;
              }
              topicMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="topic-name">Name</Label>
              <Input
                id="topic-name"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                autoFocus
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTopicDialogOpen(false)}
              disabled={topicMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="topic-form" disabled={topicMutation.isPending}>
              {topicMutation.isPending ? "Saving…" : editingTopic ? "Save changes" : "Add topic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Topic delete confirm */}
      <AlertDialog
        open={!!topicDeleteTarget}
        onOpenChange={(open) => !open && setTopicDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this topic?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{topicDeleteTarget?.name}”. If it still has learning
              objectives or questions attached, the server will refuse to delete it — remove those
              first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTopicMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (topicDeleteTarget) deleteTopicMutation.mutate(topicDeleteTarget.id);
              }}
              disabled={deleteTopicMutation.isPending}
            >
              {deleteTopicMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Learning objective create/edit dialog */}
      <Dialog open={objectiveDialogOpen} onOpenChange={setObjectiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingObjective ? "Edit learning objective" : "Add learning objective"}
            </DialogTitle>
            <DialogDescription>
              {editingObjective
                ? "Update this learning objective."
                : "Add a learning objective under a topic."}
            </DialogDescription>
          </DialogHeader>
          <form
            id="objective-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!objectiveTitle.trim()) {
                toast.error("Title is required");
                return;
              }
              if (!objectiveTopicId) {
                toast.error("Topic is required");
                return;
              }
              objectiveMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="objective-topic">Topic</Label>
              <Select value={objectiveTopicId} onValueChange={setObjectiveTopicId}>
                <SelectTrigger id="objective-topic">
                  <SelectValue placeholder="Select a topic" />
                </SelectTrigger>
                <SelectContent>
                  {trainingTopics.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="objective-title">Title</Label>
              <Input
                id="objective-title"
                value={objectiveTitle}
                onChange={(e) => setObjectiveTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="objective-desc">Description</Label>
              <Textarea
                id="objective-desc"
                value={objectiveDescription}
                onChange={(e) => setObjectiveDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setObjectiveDialogOpen(false)}
              disabled={objectiveMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="objective-form" disabled={objectiveMutation.isPending}>
              {objectiveMutation.isPending
                ? "Saving…"
                : editingObjective
                  ? "Save changes"
                  : "Add objective"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add member dialog (UserTraining) — admin picks a user, instructor adds by email */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>
              Enroll a participant or grant instructor ownership on this training.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="member-role">Role</Label>
              <Select value={memberRole} onValueChange={(v) => setMemberRole(v as TrainingRole)}>
                <SelectTrigger id="member-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARTICIPANT">Participant (can take assessments)</SelectItem>
                  <SelectItem value="INSTRUCTOR">Instructor (owns this training)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isAdmin ? (
              <div className="space-y-1.5">
                <Label htmlFor="member-user-select">User</Label>
                <Select value={pendingMemberUserId} onValueChange={setPendingMemberUserId}>
                  <SelectTrigger id="member-user-select">
                    <SelectValue placeholder="Select a user…" />
                  </SelectTrigger>
                  <SelectContent>
                    {addableUsers.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name ?? u.email} ({u.role.toLowerCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {addableUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Every user is already a member of this training.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="member-email">User email</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  The user must already have an account with this email.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddMemberOpen(false)}
              disabled={addMemberMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                addMemberMutation.isPending ||
                (isAdmin ? !pendingMemberUserId : !memberEmail.trim())
              }
              onClick={() => addMemberMutation.mutate()}
            >
              {addMemberMutation.isPending
                ? "Adding…"
                : memberRole === "INSTRUCTOR"
                  ? "Grant ownership"
                  : "Enroll participant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove member confirm */}
      <AlertDialog
        open={!!memberRemoveTarget}
        onOpenChange={(open) => !open && setMemberRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {memberRemoveTarget?.role === "INSTRUCTOR"
                ? "Revoke instructor ownership?"
                : "Remove this participant?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {memberRemoveTarget?.role === "INSTRUCTOR"
                ? `${memberRemoveTarget?.user?.email ?? "This user"} will lose access to manage this training's content.`
                : `${memberRemoveTarget?.user?.email ?? "This user"} will no longer see this training's assessments.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMemberMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (memberRemoveTarget) removeMemberMutation.mutate(memberRemoveTarget);
              }}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Learning objective delete confirm */}
      <AlertDialog
        open={!!objectiveDeleteTarget}
        onOpenChange={(open) => !open && setObjectiveDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this learning objective?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{objectiveDeleteTarget?.title}”. Questions linked to it will
              be detached (kept, just no longer mapped to this objective), not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteObjectiveMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (objectiveDeleteTarget) deleteObjectiveMutation.mutate(objectiveDeleteTarget.id);
              }}
              disabled={deleteObjectiveMutation.isPending}
            >
              {deleteObjectiveMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Readiness({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "success" | "warning" | "info";
}) {
  const pct = Math.min(100, (value / Math.max(total, 1)) * 100);
  const color =
    tone === "success" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-sky-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {value} / {total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Recommend({ title, body, to }: { title: string; body: string; to: string }) {
  return (
    <Link to={to} className="block rounded-md border bg-card p-3 hover:bg-muted/50">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{body}</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

function TimelineStep({
  status,
  title,
  detail,
}: {
  status: "done" | "active" | "pending";
  title: string;
  detail: string;
}) {
  const dot =
    status === "done"
      ? "bg-emerald-500"
      : status === "active"
        ? "bg-primary animate-pulse"
        : "bg-muted-foreground/40";
  return (
    <div className="flex-1 rounded-md border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-surface p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
