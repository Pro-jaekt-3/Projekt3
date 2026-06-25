import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Shield,
  Cloud,
  Wand2,
  Plus,
  ChevronDown,
  Save,
  ArrowLeft,
  Check,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import { AI_MODELS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

import { ensureRole } from "@/lib/route-guards";
import { qk } from "@/lib/query-keys";
import { questionsService } from "@/services/questions";
import type { CreateQuestionInput } from "@/services/questions";
import { topicsService } from "@/services/topics";
import { learningObjectivesService } from "@/services/learningObjectives";
import { equivalentGroupsService, equivalentGroupsKeys } from "@/services/equivalentGroups";
import type { QuestionType, QuestionStatus } from "@/types";

export const Route = createFileRoute("/app/questions/$id")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: QuestionEditor,
});

const TYPE_LABEL: Record<QuestionType, string> = {
  OPEN: "Open question",
  MULTIPLE_CHOICE: "Multiple choice",
  CODE: "Code / programming",
};

const DIFFICULTY_LABEL: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };

type Tone = "muted" | "warning" | "success" | "danger" | "neutral";

const STATUS_META: Record<QuestionStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "muted" },
  NEEDS_REVIEW: { label: "Needs Review", tone: "warning" },
  REVIEW: { label: "In Review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

const NO_OBJECTIVE = "__none__";

interface OptionDraft {
  text: string;
  isCorrect: boolean;
}

const emptyOptions = (): OptionDraft[] => [
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

function QuestionEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const questionQuery = useQuery({
    queryKey: qk.questions.detail(id),
    queryFn: () => questionsService.get(id),
    enabled: !isNew,
  });
  const topicsQuery = useQuery({ queryKey: qk.topics.list(), queryFn: topicsService.list });
  const objectivesQuery = useQuery({
    queryKey: qk.learningObjectives.list(),
    queryFn: () => learningObjectivesService.list(),
  });
  const groupsQuery = useQuery({
    queryKey: equivalentGroupsKeys.list(),
    queryFn: equivalentGroupsService.list,
    enabled: !isNew,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<QuestionType>("OPEN");
  const [difficulty, setDifficulty] = useState(2);
  const [topicId, setTopicId] = useState("");
  const [learningObjectiveId, setLearningObjectiveId] = useState(NO_OBJECTIVE);
  const [options, setOptions] = useState<OptionDraft[]>(emptyOptions());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");

  // Hydrate the form once when the existing question loads — keyed on id, not the
  // whole data object, so a background refetch doesn't clobber in-progress edits.
  useEffect(() => {
    const q = questionQuery.data;
    if (!q) return;
    setTitle(q.title);
    setDescription(q.description);
    setType(q.type);
    setDifficulty(q.difficulty);
    setTopicId(String(q.topicId));
    setLearningObjectiveId(q.learningObjectiveId ? String(q.learningObjectiveId) : NO_OBJECTIVE);
    if (q.type === "MULTIPLE_CHOICE" && q.answerOptions && q.answerOptions.length > 0) {
      setOptions(q.answerOptions.map((o) => ({ text: o.text, isCorrect: o.isCorrect })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionQuery.data?.id]);

  const topics = topicsQuery.data ?? [];
  const objectivesForTopic = (objectivesQuery.data ?? []).filter(
    (o) => String(o.topicId) === topicId,
  );

  const saveMutation = useMutation({
    mutationFn: (input: CreateQuestionInput) =>
      isNew
        ? questionsService.create(input)
        : questionsService.update(questionQuery.data!.id, input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: qk.questions.all });
      toast.success(isNew ? "Question created" : "Question saved");
      if (isNew) {
        navigate({ to: "/app/questions/$id", params: { id: String(saved.id) }, replace: true });
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save question"),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED") =>
      questionsService.updateStatus(questionQuery.data!.id, status),
    onSuccess: (_updated, status) => {
      queryClient.invalidateQueries({ queryKey: qk.questions.detail(id) });
      queryClient.invalidateQueries({ queryKey: qk.questions.lists() });
      toast.success(`Marked as ${STATUS_META[status].label}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => questionsService.remove(questionQuery.data!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.questions.all });
      toast.success("Question deleted");
      navigate({ to: "/app/questions" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete question"),
  });

  const addToGroupMutation = useMutation({
    mutationFn: (groupId: number) =>
      equivalentGroupsService.addQuestion(groupId, questionQuery.data!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.questions.detail(id) });
      queryClient.invalidateQueries({ queryKey: equivalentGroupsKeys.all });
      toast.success("Added to equivalent group");
      setSelectedGroupId("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add to group"),
  });

  const removeFromGroupMutation = useMutation({
    mutationFn: () =>
      equivalentGroupsService.removeQuestion(
        questionQuery.data!.equivalentGroupId!,
        questionQuery.data!.id,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.questions.detail(id) });
      queryClient.invalidateQueries({ queryKey: equivalentGroupsKeys.all });
      toast.success("Removed from equivalent group");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to remove from group"),
  });

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    const topicIdNum = Number(topicId);
    if (!topicId || !Number.isInteger(topicIdNum) || topicIdNum <= 0) {
      toast.error("Topic is required");
      return;
    }

    let optionsPayload: OptionDraft[] | undefined;
    if (type === "MULTIPLE_CHOICE") {
      const cleaned = options
        .map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }))
        .filter((o) => o.text !== "");
      if (cleaned.length < 2) {
        toast.error("Multiple choice questions require at least two options");
        return;
      }
      if (!cleaned.some((o) => o.isCorrect)) {
        toast.error("Mark at least one option as correct");
        return;
      }
      optionsPayload = cleaned;
    }

    saveMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      difficulty,
      topicId: topicIdNum,
      type,
      options: optionsPayload,
      learningObjectiveId:
        learningObjectiveId === NO_OBJECTIVE ? null : Number(learningObjectiveId),
    });
  };

  if (!isNew && questionQuery.isLoading) {
    return <LoadingState label="Loading question…" />;
  }

  if (!isNew && (questionQuery.isError || !questionQuery.data)) {
    const message =
      questionQuery.error instanceof Error
        ? questionQuery.error.message
        : "Failed to load question";
    if (/not found/i.test(message)) {
      return (
        <div className="p-8">
          <EmptyState
            title="Question not found"
            description="The question you are looking for does not exist or was deleted."
          />
        </div>
      );
    }
    return <ErrorState message={message} onRetry={() => questionQuery.refetch()} />;
  }

  const existing = questionQuery.data;

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to="/app/questions" className="hover:underline">
            Question bank
          </Link>
        }
        title={isNew ? "Create question" : "Edit question"}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/questions">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Link>
            </Button>
            {!isNew && (
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="mr-1.5 h-4 w-4" />
              {saveMutation.isPending ? "Saving…" : isNew ? "Create question" : "Save changes"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_320px] lg:p-8">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Short title shown in lists"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="The full question text shown to participants..."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as QuestionType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <Select
                    value={String(difficulty)}
                    onValueChange={(v) => setDifficulty(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DIFFICULTY_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {type === "MULTIPLE_CHOICE" && (
                <div className="space-y-2">
                  <Label>Answer options</Label>
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={opt.isCorrect}
                        onChange={() => {
                          const next = options.map((o, j) =>
                            j === i ? { ...o, isCorrect: !o.isCorrect } : o,
                          );
                          setOptions(next);
                        }}
                      />
                      <Input
                        value={opt.text}
                        onChange={(e) => {
                          const next = [...options];
                          next[i] = { ...next[i], text: e.target.value };
                          setOptions(next);
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      />
                      {options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setOptions(options.filter((_, j) => j !== i))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOptions([...options, { text: "", isCorrect: false }])}
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add option
                  </Button>
                </div>
              )}

              {(type === "OPEN" || type === "CODE") && (
                <div className="rounded-md border border-dashed bg-surface p-3 text-xs text-muted-foreground">
                  {type === "CODE" ? "Code" : "Open"} questions are graded manually after submission
                  — no answer options to configure here.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Equivalent group</CardTitle>
              <CardDescription>
                Questions in the same group are interchangeable variants. Manage the full list at{" "}
                <Link to="/app/questions/equivalent-groups" className="underline">
                  Equivalent groups
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isNew ? (
                <div className="rounded-md border border-dashed bg-surface p-4 text-sm text-muted-foreground">
                  Save the question first to assign it to an equivalent group.
                </div>
              ) : existing?.equivalentGroup ? (
                <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm">
                  <span>
                    Part of <span className="font-medium">{existing.equivalentGroup.name}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={removeFromGroupMutation.isPending}
                    onClick={() => removeFromGroupMutation.mutate()}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-md border border-dashed bg-surface p-3 text-xs text-muted-foreground">
                    Not part of an equivalent group.
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {(groupsQuery.data ?? []).map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!selectedGroupId || addToGroupMutation.isPending}
                      onClick={() => addToGroupMutation.mutate(Number(selectedGroupId))}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar: metadata + AI assistant */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isNew && existing && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <div>
                    <StatusBadge
                      status={STATUS_META[existing.status].label}
                      tone={STATUS_META[existing.status].tone}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(existing.status === "DRAFT" || existing.status === "NEEDS_REVIEW") && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate("REVIEW")}
                      >
                        Submit for review
                      </Button>
                    )}
                    {existing.status === "REVIEW" && (
                      <>
                        <Button
                          size="sm"
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate("APPROVED")}
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={statusMutation.isPending}
                          onClick={() => statusMutation.mutate("REJECTED")}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" /> Reject
                        </Button>
                      </>
                    )}
                    {(existing.status === "APPROVED" || existing.status === "REJECTED") && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate("ARCHIVED")}
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Topic</Label>
                <Select
                  value={topicId}
                  onValueChange={(v) => {
                    setTopicId(v);
                    setLearningObjectiveId(NO_OBJECTIVE);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Learning objective</Label>
                <Select
                  value={learningObjectiveId}
                  onValueChange={setLearningObjectiveId}
                  disabled={!topicId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_OBJECTIVE}>None</SelectItem>
                    {objectivesForTopic.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <AIAssistantPanel />
        </aside>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{existing?.title}”. If it is used in an assessment, the
              server may refuse to delete it.
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
    </>
  );
}

function AIAssistantPanel() {
  const enabled = AI_MODELS.filter((m) => m.enabled && m.availableToInstructors);
  const [modelId, setModelId] = useState(enabled[0]?.id ?? "");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const model = AI_MODELS.find((m) => m.id === modelId);

  const generate = (action: string) => {
    setBusy(true);
    setSuggestion(null);
    setTimeout(() => {
      setBusy(false);
      setSuggestion(
        action === "explain"
          ? "WHERE filters individual rows before they are grouped by GROUP BY. HAVING runs after grouping and is used to filter aggregated results."
          : "In a relational database, which clause restricts rows before aggregation?",
      );
    }, 700);
  };

  return (
    <Card className="border-primary/30 bg-primary-soft/30">
      <CardHeader>
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-accent-foreground" />
          <div>
            <CardTitle className="text-sm">AI assistant</CardTitle>
            <CardDescription className="text-xs">Suggestions never auto-approve.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Model</Label>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {enabled.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {model && (
            <div className="flex flex-wrap gap-1 pt-1">
              <StatusBadge
                status={model.location === "local" ? "Local" : "Cloud"}
                tone={model.location === "local" ? "success" : "warning"}
                icon={
                  model.location === "local" ? (
                    <Shield className="h-3 w-3" />
                  ) : (
                    <Cloud className="h-3 w-3" />
                  )
                }
              />
              {model.useCases.slice(0, 2).map((u) => (
                <StatusBadge key={u} status={u} tone="muted" />
              ))}
            </div>
          )}
          {model && (
            <p className="text-[11px] text-muted-foreground">
              {model.location === "local"
                ? "Data stays on local infrastructure."
                : "Avoid sending sensitive participant data."}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => generate("draft")}
          >
            <Wand2 className="mr-1.5 h-4 w-4" /> Generate question draft
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => generate("improve")}
          >
            <Wand2 className="mr-1.5 h-4 w-4" /> Improve wording
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => generate("options")}
          >
            <Wand2 className="mr-1.5 h-4 w-4" /> Generate answer options
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => generate("explain")}
          >
            <Wand2 className="mr-1.5 h-4 w-4" /> Generate explanation
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => generate("variant")}
          >
            <Wand2 className="mr-1.5 h-4 w-4" /> Generate equivalent variant
          </Button>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
              Advanced settings{" "}
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Temperature (creativity)</Label>
              <Input type="number" step="0.1" defaultValue="0.4" className="h-8" />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {busy && (
          <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground">
            Thinking…
          </div>
        )}

        {suggestion && (
          <div className="rounded-md border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              AI suggestion
            </div>
            <p className="mt-1 text-sm">{suggestion}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  toast("Inserted into draft");
                  setSuggestion(null);
                }}
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Insert
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toast("Saved as Needs Review")}>
                Save as Needs Review
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)}>
                <X className="mr-1 h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
