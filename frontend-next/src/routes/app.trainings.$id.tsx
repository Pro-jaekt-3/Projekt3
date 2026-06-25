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
  Trash2,
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
import {
  assessmentsForTraining,
  PARTICIPANTS,
  questionsForTraining,
  PRE_POST_COMPARISON,
  TOPIC_PERFORMANCE,
  RECENT_ACTIVITY,
} from "@/lib/mock-data";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useRole } from "@/lib/role-context";
import { qk } from "@/lib/query-keys";
import { trainingsService } from "@/services/trainings";
import { topicsService } from "@/services/topics";
import { learningObjectivesService } from "@/services/learningObjectives";
import { trainingToView } from "@/lib/training-view";
import { ensureRole } from "@/lib/route-guards";
import type { Topic, LearningObjective } from "@/types";

export const Route = createFileRoute("/app/trainings/$id")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: TrainingDetail,
});

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
      toast.success("Learning objective deleted");
      setObjectiveDeleteTarget(null);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete learning objective"),
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
  // Related domains are still on mock (keyed by mock ids/titles); real trainings
  // surface empty states here until topics/assessments/questions are wired.
  const assessments = assessmentsForTraining(training.id);
  const questions = questionsForTraining(training.title);

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
            <span>{training.participants} participants</span>
            <span>·</span>
            <span>Updated {training.lastActivity}</span>
          </>
        }
        actions={
          <>
            {!isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                </Button>
              </>
            )}
            <Button variant="outline" size="sm">
              <UserPlus className="mr-1.5 h-4 w-4" /> Add participant
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
          <MetricCard label="Participants" value={training.participants} />
          <MetricCard label="Learning objectives" value={totalObjectives} />
          <MetricCard
            label="Approved questions"
            value={training.approvedQuestions}
            hint={`${training.questions} total`}
          />
          <MetricCard label="Active assessments" value={training.assessments} />
          <MetricCard label="Average score" value={`${training.avgScore}%`} />
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
                    value={training.approvedQuestions}
                    total={training.questions}
                    tone="success"
                  />
                  <Readiness
                    label="Missing equivalent variants"
                    value={6}
                    total={training.approvedQuestions}
                    tone="warning"
                  />
                  <Readiness
                    label="Questions needing review"
                    value={3}
                    total={training.questions}
                    tone="warning"
                  />
                  <Readiness
                    label="AI drafts pending"
                    value={2}
                    total={training.questions}
                    tone="info"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recommended next actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Recommend
                    title="Create post-test from pre-test"
                    body="SQL Joins shows weak performance (49%)."
                    to="/app/assessments/a1/post-test"
                  />
                  <Recommend
                    title="Review 3 questions"
                    body="Awaiting approval before publish."
                    to="/app/questions"
                  />
                  <Recommend
                    title="Generate equivalent variants"
                    body="6 approved questions missing variants."
                    to="/app/questions"
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
                    status="done"
                    title="Pre-test"
                    detail="26 / 28 submitted · Avg 64%"
                  />
                  <TimelineStep
                    status="active"
                    title="Learning period"
                    detail="Practice & feedback"
                  />
                  <TimelineStep
                    status="pending"
                    title="Post-test"
                    detail="Draft — review questions"
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

          {/* PARTICIPANTS */}
          <TabsContent value="participants" className="mt-4 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <Input placeholder="Search by name or email" className="max-w-sm" />
                <Button variant="outline" size="sm" className="shrink-0">
                  <Filter className="mr-1.5 h-4 w-4" /> Filters
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Import
                </Button>
                <Button size="sm">
                  <UserPlus className="mr-1.5 h-4 w-4" /> Add participants
                </Button>
              </div>
            </div>

            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="hidden md:table-cell">Assigned</TableHead>
                      <TableHead className="hidden md:table-cell">Completion</TableHead>
                      <TableHead className="text-right">Latest score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PARTICIPANTS.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell tabular-nums">
                          {p.assignedAssessments}
                        </TableCell>
                        <TableCell className="hidden md:table-cell tabular-nums">
                          {p.completionRate}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.latestScore ?? "—"}
                          {p.latestScore && "%"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* CURRICULUM */}
          <TabsContent value="curriculum" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Topics and learning objectives live here — not as separate pages.
              </div>
              {!isAdmin && (
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
              )}
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
                  !isAdmin && (
                    <Button size="sm" onClick={openCreateTopic}>
                      <Plus className="mr-1.5 h-4 w-4" /> Add topic
                    </Button>
                  )
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
                        {!isAdmin && (
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
                        )}
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
                                {!isAdmin && (
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
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {!isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCreateObjective(topic.id)}
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add objective
                          </Button>
                        )}
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
                    <strong>Assessment readiness:</strong> {training.approvedQuestions} approved
                    questions, 6 missing equivalent variants.
                  </span>
                </div>
                <Button asChild size="sm">
                  <Link to="/app/questions">Open question bank</Link>
                </Button>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Input placeholder="Search question text" className="max-w-sm" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Generate draft with AI
                </Button>
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" /> Create question
                </Button>
              </div>
            </div>

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
                      <TableHead className="hidden md:table-cell text-right">Variants</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={q.id} className="cursor-pointer hover:bg-muted/40">
                        <TableCell className="max-w-md">
                          <Link
                            to="/app/questions/$id"
                            params={{ id: q.id }}
                            className="line-clamp-2 font-medium hover:underline"
                          >
                            {q.text}
                          </Link>
                          {q.source === "ai" && (
                            <span className="ml-2 inline-block">
                              <StatusBadge status="AI generated" tone="primary" />
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {q.topic}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {q.objective}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs capitalize">
                          {q.difficulty}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={q.status} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right tabular-nums">
                          {q.variants}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ASSESSMENTS */}
          <TabsContent value="assessments" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Manage assessments for this training.
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/assessments/a1/post-test">Create post-test</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/app/assessments/new" search={{ trainingId: training.id } as never}>
                    <Plus className="mr-1.5 h-4 w-4" /> Create assessment
                  </Link>
                </Button>
              </div>
            </div>

            {assessments.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title="No assessments yet"
                description="Create your first assessment to start collecting results."
                action={
                  <Button asChild size="sm">
                    <Link to="/app/assessments/new" search={{ trainingId: training.id } as never}>
                      <Plus className="mr-1.5 h-4 w-4" /> Create assessment
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {assessments.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            to="/app/assessments/$id"
                            params={{ id: a.id }}
                            className="block truncate text-sm font-semibold hover:underline"
                          >
                            {a.title}
                          </Link>
                          <div className="text-xs text-muted-foreground">{a.type}</div>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <KV label="Assigned" value={a.assigned} />
                        <KV label="Submitted" value={a.submitted} />
                        <KV label="Avg" value={a.avgScore ? `${a.avgScore}%` : "—"} />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button asChild variant="outline" size="sm">
                          <Link to="/app/assessments/$id" params={{ id: a.id }}>
                            Open
                          </Link>
                        </Button>
                        {a.status === "Results Ready" && (
                          <Button asChild size="sm">
                            <Link to="/app/assessments/$id/results" params={{ id: a.id }}>
                              View results
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* RESULTS */}
          <TabsContent value="results" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label="Average score"
                value="71%"
                trend={{ value: "+7%", positive: true }}
              />
              <MetricCard label="Completion rate" value="93%" />
              <MetricCard label="Strongest topic" value="SQL Basics" hint="81%" />
              <MetricCard label="Weakest topic" value="Joins" hint="49%" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pre-test vs post-test improvement</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-60">
                    <ResponsiveContainer>
                      <BarChart data={PRE_POST_COMPARISON}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="topic" fontSize={11} />
                        <YAxis domain={[0, 100]} fontSize={11} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="pre" fill="var(--chart-2)" radius={4} />
                        <Bar dataKey="post" fill="var(--primary)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Topic breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-60">
                    <ResponsiveContainer>
                      <BarChart data={TOPIC_PERFORMANCE} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} fontSize={11} />
                        <YAxis type="category" dataKey="topic" fontSize={11} width={100} />
                        <Tooltip />
                        <Bar dataKey="score" fill="var(--primary)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
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

      {/* Learning objective delete confirm */}
      <AlertDialog
        open={!!objectiveDeleteTarget}
        onOpenChange={(open) => !open && setObjectiveDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this learning objective?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{objectiveDeleteTarget?.title}”. If it still has questions
              attached, the server will refuse to delete it — remove those first.
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
