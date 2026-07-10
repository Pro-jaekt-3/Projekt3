import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  QrCode,
  Copy,
  ExternalLink,
  Eye,
  AlertTriangle,
  Check,
  ClipboardList,
  Clock,
  Pencil,
  Trash2,
  Send,
  Archive,
  RotateCcw,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "react-qr-code";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricCard } from "@/components/common/MetricCard";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { qk } from "@/lib/query-keys";
import { assessmentsService } from "@/services/assessments";
import { topicsService } from "@/services/topics";
import { questionsService } from "@/services/questions";
import { ensureRole } from "@/lib/route-guards";
import { cn } from "@/lib/utils";
import type {
  Assessment,
  AssessmentQuestion,
  AssessmentStatus,
  AssessmentType,
} from "@/types";

export const Route = createFileRoute("/app/assessments/$id")({
  validateSearch: z.object({ published: z.coerce.number().optional() }),
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: AssessmentDetail,
});

const STATUS_META: Record<
  AssessmentStatus,
  { label: string; tone: "muted" | "info" | "neutral" }
> = {
  DRAFT: { label: "Draft", tone: "muted" },
  PUBLISHED: { label: "Published", tone: "info" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

const TYPE_LABEL: Record<AssessmentType, string> = {
  PRE_TEST: "Pre-test",
  POST_TEST: "Post-test",
  QUIZ: "Quiz",
};

const QUESTION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  NEEDS_REVIEW: "Needs Review",
  REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

function AssessmentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { published } = useSearch({ from: "/app/assessments/$id" });

  const [accessOpen, setAccessOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AssessmentType>("QUIZ");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("");
  const [showPublishedBanner, setShowPublishedBanner] = useState(Boolean(published));

  const assessmentQuery = useQuery({
    queryKey: qk.assessments.detail(id),
    queryFn: () => assessmentsService.get(id),
  });

  useEffect(() => {
    if (published) {
      setAccessOpen(true);
      setShowPublishedBanner(true);
    }
  }, [published]);

  useEffect(() => {
    const assessment = assessmentQuery.data;
    if (!assessment) return;
    setTitle(assessment.title);
    setDescription(assessment.description ?? "");
    setType(assessment.type);
    setTimeLimitMinutes(
      assessment.timeLimitMinutes !== null && assessment.timeLimitMinutes !== undefined
        ? String(assessment.timeLimitMinutes)
        : "",
    );
    setEditError(null);
  }, [assessmentQuery.data?.id]);

  const editMutation = useMutation({
    mutationFn: () =>
      assessmentsService.update(id, {
        title: title.trim(),
        description: description.trim() || null,
        type,
        timeLimitMinutes: timeLimitMinutes.trim() ? Number(timeLimitMinutes) : null,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: qk.assessments.detail(id) });
      queryClient.invalidateQueries({ queryKey: qk.assessments.lists() });
      setActionError(null);
      setEditError(null);
      toast.success(`Saved “${updated.title}”`);
      setEditOpen(false);
    },
    onError: (error) => {
      const message = errText(error);
      setEditError(message);
      toast.error(message);
    },
  });

  const questionsMutation = useMutation({
    mutationFn: (questionIds: number[]) =>
      assessmentsService.update(id, { questions: questionIds }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: qk.assessments.detail(id) });
      queryClient.invalidateQueries({ queryKey: qk.assessments.lists() });
      setQuestionsError(null);
      toast.success(`Updated questions for “${updated.title}”`);
      setQuestionsOpen(false);
    },
    onError: (error) => {
      const message = errText(error);
      setQuestionsError(message);
      toast.error(message);
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: AssessmentStatus) => assessmentsService.updateStatus(id, status),
    onSuccess: (updated, status) => {
      queryClient.invalidateQueries({ queryKey: qk.assessments.detail(id) });
      queryClient.invalidateQueries({ queryKey: qk.assessments.lists() });
      setActionError(null);
      setShowPublishedBanner(status === "PUBLISHED");
      if (status === "PUBLISHED") {
        setAccessOpen(true);
      }
      toast.success(`Assessment marked as ${STATUS_META[status].label.toLowerCase()}`);
      if (status === "ARCHIVED") {
        toast("Archived assessments stay read-only until restored to draft.");
      }
      setTitle(updated.title);
      setDescription(updated.description ?? "");
      setType(updated.type);
      setTimeLimitMinutes(
        updated.timeLimitMinutes !== null && updated.timeLimitMinutes !== undefined
          ? String(updated.timeLimitMinutes)
          : "",
      );
    },
    onError: (error) => {
      const message = errText(error);
      setActionError(message);
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => assessmentsService.remove(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: qk.assessments.all });
      setActionError(null);
      toast.success(result.message || "Assessment deleted");
      setDeleteOpen(false);
      navigate({ to: "/app/assessments" });
    },
    onError: (error) => {
      const message = errText(error);
      setActionError(message);
      toast.error(message);
    },
  });

  const matchRoute = useMatchRoute();
  const isChildActive = Boolean(
    matchRoute({ to: "/app/assessments/$id/results" }) ||
    matchRoute({ to: "/app/assessments/$id/post-test" }),
  );

  if (assessmentQuery.isLoading) {
    return <LoadingState label="Loading assessment…" />;
  }

  if (assessmentQuery.isError || !assessmentQuery.data) {
    const message =
      assessmentQuery.error instanceof Error
        ? assessmentQuery.error.message
        : "Failed to load assessment";
    if (/not found/i.test(message)) {
      return (
        <div className="p-8">
          <EmptyState
            title="Assessment not found"
            description="The assessment you are looking for does not exist or has been removed."
          />
        </div>
      );
    }
    return <ErrorState message={message} onRetry={() => assessmentQuery.refetch()} />;
  }

  const assessment = assessmentQuery.data;
  const statusMeta = STATUS_META[assessment.status];
  const questions = assessment.questions ?? [];
  const approvedCount = questions.filter((item) => item.question?.status === "APPROVED").length;
  const canEdit = assessment.status === "DRAFT";
  // Client-side publish guard (M3): the backend stays the last line of defence, but the
  // UI blocks the call up-front when it already knows it would be rejected.
  const canPublish = questions.length > 0 && approvedCount === questions.length;
  const publishBlockedReason =
    questions.length === 0
      ? "Add at least one approved question before publishing"
      : "All selected questions must be approved before publishing";
  const publishDisabled = statusMutation.isPending || deleteMutation.isPending;
  const editDisabled = !canEdit || editMutation.isPending || statusMutation.isPending;

  const summaryRows = [
    { label: "Type", value: TYPE_LABEL[assessment.type] },
    { label: "Status", value: statusMeta.label },
    { label: "Training", value: assessment.training?.title ?? "—" },
    { label: "Created", value: formatDateTime(assessment.createdAt) },
    { label: "Updated", value: formatDateTime(assessment.updatedAt) },
    {
      label: "Time limit",
      value: assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} min` : "—",
    },
  ];

  const validationChecks = [
    {
      ok: questions.length > 0 && approvedCount === questions.length,
      label: "All selected questions are approved",
    },
    { ok: canEdit, label: "Draft can still be edited" },
    { ok: assessment.status === "PUBLISHED", label: "Participant access is enabled" },
    { ok: !!assessment.description, label: "Instructions added" },
  ];

  const statusActions = statusActionsFor(assessment.status);

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to="/app/assessments" className="hover:underline">
            Assessments
          </Link>
        }
        title={assessment.title}
        description={assessment.description ?? "Assessment details and status controls."}
        meta={
          <>
            <StatusBadge status={statusMeta.label} tone={statusMeta.tone} />
            <span>·</span>
            <span>{assessment.training?.title ?? "No training"}</span>
            <span>·</span>
            <span>{TYPE_LABEL[assessment.type]}</span>
          </>
        }
        actions={
          <>
            {assessment.status === "PUBLISHED" && (
              <Button variant="outline" size="sm" onClick={() => setAccessOpen(true)}>
                <QrCode className="mr-1.5 h-4 w-4" /> Access & QR
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditError(null);
                setEditOpen(true);
              }}
              disabled={editDisabled}
              title={!canEdit ? "Only draft assessments can be edited" : undefined}
            >
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              disabled={statusMutation.isPending || deleteMutation.isPending}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete
            </Button>
            {statusActions.map((action) => {
              const blockedByValidation = action.target === "PUBLISHED" && !canPublish;
              return (
                <Button
                  key={action.target}
                  variant={action.variant}
                  size="sm"
                  onClick={() => statusMutation.mutate(action.target)}
                  disabled={publishDisabled || blockedByValidation}
                  title={blockedByValidation ? publishBlockedReason : undefined}
                >
                  <action.icon className="mr-1.5 h-4 w-4" />{" "}
                  {statusMutation.isPending && statusMutation.variables === action.target
                    ? action.pendingLabel
                    : action.label}
                </Button>
              );
            })}
          </>
        }
      />

      {showPublishedBanner && assessment.status === "PUBLISHED" && (
        <div className="border-b bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30 sm:px-6 lg:px-8">
          <div className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-200">
            <Check className="mt-0.5 h-4 w-4" />
            <div>
              <strong>Assessment published.</strong> Participant access is now available through
              the access panel.
            </div>
          </div>
        </div>
      )}

      {isChildActive ? (
        <Outlet />
      ) : (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {actionError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {actionError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            label="Questions"
            value={questions.length}
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <MetricCard label="Approved" value={`${approvedCount} / ${questions.length}`} />
          <MetricCard label="Status" value={statusMeta.label} />
          <MetricCard
            label="Time limit"
            value={assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} min` : "—"}
            icon={<Clock className="h-4 w-4" />}
          />
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex w-full flex-wrap sm:w-auto sm:inline-flex">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="access">Access & Live</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {summaryRows.map((row) => (
                  <SumRow key={row.label} label={row.label} value={row.value} />
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Validation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {validationChecks.map((check) => (
                  <Validate key={check.label} ok={check.ok} label={check.label} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {approvedCount} of {questions.length} attached question
                {questions.length === 1 ? "" : "s"} approved.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuestionsError(null);
                  setQuestionsOpen(true);
                }}
                disabled={!canEdit || questionsMutation.isPending}
                title={!canEdit ? "Only draft assessments can be edited" : undefined}
              >
                <ListChecks className="mr-1.5 h-4 w-4" /> Manage questions
              </Button>
            </div>
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead className="hidden md:table-cell">Topic</TableHead>
                      <TableHead className="hidden sm:table-cell">Difficulty</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.length > 0 ? (
                      questions.map((item, index) => (
                        <AssessmentQuestionRow key={item.id} item={item} index={index} />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8">
                          <EmptyState
                            title="No questions attached"
                            description="This assessment does not have any question rows yet."
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="mt-4">
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Assignment and attempt tracking will be wired when the solving and results routes
                are connected. This detail page now uses the real assessment record only.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Access</CardTitle>
                <CardDescription>
                  QR code, participant link and publish state are available here.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => setAccessOpen(true)}
                  disabled={assessment.status !== "PUBLISHED"}
                >
                  <QrCode className="mr-1.5 h-4 w-4" /> Open access & live session
                </Button>
                {assessment.status !== "PUBLISHED" && (
                  <div className="rounded-md border bg-surface p-3 text-sm text-muted-foreground">
                    Publish the assessment first to enable participant access.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="mt-4">
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-10">
                <p className="text-sm text-muted-foreground">
                  View submitted attempts, score distribution, and manually grade open/code answers.
                </p>
                <Button asChild>
                  <Link to="/app/assessments/$id/results" params={{ id }}>
                    View results
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      )}

      <EditAssessmentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title={title}
        description={description}
        type={type}
        timeLimitMinutes={timeLimitMinutes}
        editError={editError}
        canEdit={canEdit}
        isPending={editMutation.isPending}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onTypeChange={setType}
        onTimeLimitMinutesChange={setTimeLimitMinutes}
        onSubmit={() => {
          if (!title.trim()) {
            setEditError("Title is required");
            toast.error("Title is required");
            return;
          }
          setEditError(null);
          editMutation.mutate();
        }}
      />

      <ManageQuestionsDialog
        open={questionsOpen}
        onOpenChange={(open) => {
          setQuestionsOpen(open);
          if (!open) setQuestionsError(null);
        }}
        assessment={assessment}
        canEdit={canEdit}
        isPending={questionsMutation.isPending}
        saveError={questionsError}
        onSave={(questionIds) => questionsMutation.mutate(questionIds)}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{assessment.title}”. If other records still depend on it,
              the server will refuse the delete and return its error message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AccessDrawer open={accessOpen} onOpenChange={setAccessOpen} assessment={assessment} />
    </>
  );
}

function AssessmentQuestionRow({
  item,
  index,
}: {
  item: AssessmentQuestion;
  index: number;
}) {
  const question = item.question;
  const questionStatus = question?.status ? QUESTION_STATUS_LABEL[question.status] : "Unavailable";

  return (
    <TableRow>
      <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
      <TableCell className="max-w-md">
        {question ? (
          <Link
            to="/app/questions/$id"
            params={{ id: String(question.id) }}
            className="line-clamp-2 font-medium hover:underline"
          >
            {question.title}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">Question unavailable</span>
        )}
      </TableCell>
      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
        {question?.topic?.name ?? "—"}
      </TableCell>
      <TableCell className="hidden sm:table-cell text-xs">{difficultyLabel(question?.difficulty)}</TableCell>
      <TableCell>
        <StatusBadge status={questionStatus} />
      </TableCell>
    </TableRow>
  );
}

function EditAssessmentDialog({
  open,
  onOpenChange,
  title,
  description,
  type,
  timeLimitMinutes,
  editError,
  canEdit,
  isPending,
  onTitleChange,
  onDescriptionChange,
  onTypeChange,
  onTimeLimitMinutesChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  type: AssessmentType;
  timeLimitMinutes: string;
  editError: string | null;
  canEdit: boolean;
  isPending: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTypeChange: (value: AssessmentType) => void;
  onTimeLimitMinutesChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit assessment</DialogTitle>
          <DialogDescription>
            Only draft assessments can be edited. Publishing or submitted attempts lock the record.
          </DialogDescription>
        </DialogHeader>
        <form
          id="edit-assessment-form"
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="assessment-title">Title</Label>
            <Input
              id="assessment-title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              autoFocus
              disabled={!canEdit || isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assessment-description">Description</Label>
            <Textarea
              id="assessment-description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              disabled={!canEdit || isPending}
              rows={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Assessment type</Label>
            <Select
              value={type}
              onValueChange={(value) => onTypeChange(value as AssessmentType)}
              disabled={!canEdit || isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRE_TEST">Pre-test</SelectItem>
                <SelectItem value="POST_TEST">Post-test</SelectItem>
                <SelectItem value="QUIZ">Quiz</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assessment-time-limit">Time limit (minutes, optional)</Label>
            <Input
              id="assessment-time-limit"
              type="number"
              min={1}
              max={300}
              className="max-w-[160px]"
              placeholder="No limit"
              value={timeLimitMinutes}
              onChange={(event) => onTimeLimitMinutesChange(event.target.value)}
              disabled={!canEdit || isPending}
            />
          </div>
          {editError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {editError}
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-assessment-form"
            disabled={!canEdit || isPending}
            title={!canEdit ? "Only draft assessments can be edited" : undefined}
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageQuestionsDialog({
  open,
  onOpenChange,
  assessment,
  canEdit,
  isPending,
  saveError,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment: Assessment;
  canEdit: boolean;
  isPending: boolean;
  saveError: string | null;
  onSave: (questionIds: number[]) => void;
}) {
  const topicsQuery = useQuery({
    queryKey: qk.topics.list(),
    queryFn: topicsService.list,
    enabled: open,
  });
  const questionsQuery = useQuery({
    queryKey: qk.questions.list(),
    queryFn: questionsService.list,
    enabled: open,
  });

  const [selected, setSelected] = useState<number[]>([]);

  // Seed the selection from the assessment's current questions each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const current = (assessment.questions ?? []).map((item) => item.questionId);
    setSelected(Array.from(new Set(current)));
  }, [open, assessment.questions]);

  // G4: only APPROVED questions from the same training (via their topic), deduplicated.
  const trainingTopicIds = useMemo(() => {
    const topics = topicsQuery.data ?? [];
    return new Set(
      topics.filter((topic) => topic.trainingId === assessment.trainingId).map((topic) => topic.id),
    );
  }, [topicsQuery.data, assessment.trainingId]);
  const approvedQuestions = useMemo(() => {
    const all = questionsQuery.data ?? [];
    return all.filter(
      (question) => question.status === "APPROVED" && trainingTopicIds.has(question.topicId),
    );
  }, [questionsQuery.data, trainingTopicIds]);

  const toggle = (questionId: number) => {
    setSelected((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : Array.from(new Set([...current, questionId])),
    );
  };

  const loading = topicsQuery.isLoading || questionsQuery.isLoading;
  const loadError = topicsQuery.error ?? questionsQuery.error ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage questions</DialogTitle>
          <DialogDescription>
            Only approved questions from this training can be attached. Questions can only be
            changed while the assessment is a draft with no submitted attempts.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {loading ? (
            <LoadingState label="Loading questions…" />
          ) : loadError ? (
            <ErrorState
              message={loadError instanceof Error ? loadError.message : "Failed to load questions"}
              onRetry={() => {
                topicsQuery.refetch();
                questionsQuery.refetch();
              }}
            />
          ) : approvedQuestions.length === 0 ? (
            <div className="rounded-md border bg-surface p-4 text-sm text-muted-foreground">
              No approved questions match this training yet. Approve questions in the question bank
              before attaching them.
            </div>
          ) : (
            approvedQuestions.map((question) => {
              const active = selected.includes(question.id);
              return (
                <label
                  key={question.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 transition-colors",
                    active ? "border-primary bg-primary-soft/50" : "hover:bg-muted/40",
                  )}
                >
                  <Checkbox
                    checked={active}
                    onCheckedChange={() => toggle(question.id)}
                    disabled={!canEdit || isPending}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{question.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{question.topic?.name ?? "—"}</span>
                      <span>·</span>
                      <span>{difficultyLabel(question.difficulty)}</span>
                    </div>
                  </div>
                  <StatusBadge status="Approved" />
                </label>
              );
            })
          )}
        </div>

        {saveError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {saveError}
          </div>
        )}

        <DialogFooter className="sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {selected.length} question{selected.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => onSave(selected)}
              disabled={!canEdit || isPending || selected.length === 0}
              title={
                selected.length === 0 ? "Select at least one approved question" : undefined
              }
            >
              {isPending ? "Saving…" : "Save questions"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SumRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Validate({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      )}
      <span>{label}</span>
    </div>
  );
}

function AccessDrawer({
  open,
  onOpenChange,
  assessment,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  assessment: Assessment;
}) {
  const link = `${
    typeof window !== "undefined" ? window.location.origin : "https://projekt3.app"
  }/assessment/${assessment.id}/access`;
  const statusMeta = STATUS_META[assessment.status];
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const copy = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard?.writeText(link);
    }
    toast.success("Link copied");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Assessment access & live session</SheetTitle>
          <SheetDescription>{assessment.title}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={statusMeta.label} tone={statusMeta.tone} />
            <span className="text-xs text-muted-foreground">
              Training: <span className="font-medium">{assessment.training?.title ?? "—"}</span>
            </span>
          </div>

          {assessment.status !== "PUBLISHED" ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Publish this assessment before sharing the participant link or QR code.
            </div>
          ) : (
            <>
              <div className="rounded-md border bg-card p-4">
                <div className="flex justify-center">
                  <QRCode value={link} size={176} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Participant link</label>
                <div className="flex gap-2">
                  <Input value={link} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copy}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button asChild variant="outline" size="icon">
                    <a href={link} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <LiveStat label="Status" value={statusMeta.label} />
            <LiveStat label="Questions" value={assessment.questions?.length ?? 0} />
            <LiveStat
              label="Time limit"
              value={assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} min` : "—"}
            />
            <LiveStat label="Type" value={TYPE_LABEL[assessment.type]} />
          </div>

          <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            Live participant monitoring and submission tracking will be added when the attempt and
            results routes are wired.
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={assessment.status !== "PUBLISHED"}
              onClick={() => setQrFullscreen(true)}
            >
              <Eye className="mr-1.5 h-4 w-4" /> Display QR fullscreen
            </Button>
            <Button asChild size="sm">
              <Link to="/app/assessments/$id/results" params={{ id: String(assessment.id) }}>
                View results
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>

      <Dialog open={qrFullscreen} onOpenChange={setQrFullscreen}>
        <DialogContent className="flex max-w-fit flex-col items-center gap-6 p-10">
          <DialogHeader>
            <DialogTitle className="text-center">{assessment.title}</DialogTitle>
          </DialogHeader>
          <QRCode value={link} size={400} />
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

function LiveStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-surface p-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function difficultyLabel(value?: number) {
  if (value === 1) return "Easy";
  if (value === 2) return "Medium";
  if (value === 3) return "Hard";
  return value ? String(value) : "—";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function errText(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function statusActionsFor(status: AssessmentStatus) {
  if (status === "DRAFT") {
    return [
      {
        label: "Archive",
        pendingLabel: "Archiving…",
        target: "ARCHIVED" as const,
        icon: Archive,
        variant: "outline" as const,
      },
      {
        label: "Publish",
        pendingLabel: "Publishing…",
        target: "PUBLISHED" as const,
        icon: Send,
        variant: "default" as const,
      },
    ];
  }

  if (status === "PUBLISHED") {
    return [
      {
        label: "Move to draft",
        pendingLabel: "Reverting…",
        target: "DRAFT" as const,
        icon: RotateCcw,
        variant: "outline" as const,
      },
      {
        label: "Archive",
        pendingLabel: "Archiving…",
        target: "ARCHIVED" as const,
        icon: Archive,
        variant: "outline" as const,
      },
    ];
  }

  return [
    {
      label: "Restore draft",
      pendingLabel: "Restoring…",
      target: "DRAFT" as const,
      icon: RotateCcw,
      variant: "outline" as const,
    },
    {
      label: "Publish",
      pendingLabel: "Publishing…",
      target: "PUBLISHED" as const,
      icon: Send,
      variant: "default" as const,
    },
  ];
}
