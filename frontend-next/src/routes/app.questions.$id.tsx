import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Wand2,
  Plus,
  Save,
  ArrowLeft,
  Check,
  X,
  Trash2,
  AlertTriangle,
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

import { ensureRole } from "@/lib/route-guards";
import { qk } from "@/lib/query-keys";
import { questionsService } from "@/services/questions";
import type { CreateQuestionInput } from "@/services/questions";
import { topicsService } from "@/services/topics";
import { equivalenceGroupsService, equivalenceGroupsKeys } from "@/services/equivalenceGroups";
import { aiAuthoringService, aiAuthoringKeys } from "@/services/aiAuthoring";
import type { AiModelSummary, DraftedQuestion } from "@/services/aiAuthoring";
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
  const groupsQuery = useQuery({
    queryKey: equivalenceGroupsKeys.list(),
    queryFn: equivalenceGroupsService.list,
    enabled: !isNew,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<QuestionType>("OPEN");
  const [difficulty, setDifficulty] = useState(2);
  const [topicId, setTopicId] = useState("");
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
    if (q.type === "MULTIPLE_CHOICE" && q.answerOptions && q.answerOptions.length > 0) {
      setOptions(q.answerOptions.map((o) => ({ text: o.text, isCorrect: o.isCorrect })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionQuery.data?.id]);

  const topics = topicsQuery.data ?? [];

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
      equivalenceGroupsService.addQuestion(groupId, questionQuery.data!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.questions.detail(id) });
      queryClient.invalidateQueries({ queryKey: equivalenceGroupsKeys.all });
      toast.success("Added to equivalent group");
      setSelectedGroupId("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add to group"),
  });

  const removeFromGroupMutation = useMutation({
    mutationFn: () =>
      equivalenceGroupsService.removeQuestion(
        questionQuery.data!.equivalenceGroupId!,
        questionQuery.data!.id,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.questions.detail(id) });
      queryClient.invalidateQueries({ queryKey: equivalenceGroupsKeys.all });
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
              ) : existing?.equivalenceGroup ? (
                <div className="flex items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm">
                  <span>
                    Part of <span className="font-medium">{existing.equivalenceGroup.title ?? "(untitled)"}</span>
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
                            {g.title ?? "(untitled)"}
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
            </CardContent>
          </Card>

          <AIAssistantPanel
            questionId={existing?.id}
            existingGroupId={existing?.equivalenceGroupId ?? null}
            questionType={type}
            difficulty={difficulty}
            topicName={topics.find((t) => String(t.id) === topicId)?.name ?? null}
            onApplyDraft={(question) => {
              setTitle(question.title);
              setDescription(question.description);
              setType(question.type);
              setDifficulty(question.difficulty);
              if (question.type === "MULTIPLE_CHOICE" && question.answerOptions.length > 0) {
                setOptions(
                  question.answerOptions.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
                );
              } else {
                setOptions(emptyOptions());
              }
            }}
          />
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

const DIFFICULTY_TEXT: Record<number, string> = { 1: "easy", 2: "medium", 3: "hard" };

// CLIENT-SIDE ONLY hint: pre-selects which installed local Ollama model an instructor
// is likely to want per question type, used only as a fallback when no cloud model is
// active. The dropdown's current selection IS sent as `aiModelId` on generate.
const QUESTION_TYPE_MODEL_AFFINITY: Record<QuestionType, string[]> = {
  OPEN: ["qwen3:8b", "llama3.1:8b"],
  MULTIPLE_CHOICE: ["qwen3:8b", "mistral"],
  CODE: ["qwen2.5-coder", "codellama", "qwen3:8b"],
};

// Prefers an active cloud (non-Ollama) model when one exists, so generation doesn't
// default to requiring a local Ollama install just because it's first in the list.
function pickPreferredModel(
  models: AiModelSummary[],
  type: QuestionType,
): AiModelSummary | undefined {
  const cloudModels = models.filter((m) => !m.isLocal);
  if (cloudModels.length > 0) return cloudModels[0];

  for (const name of QUESTION_TYPE_MODEL_AFFINITY[type] ?? []) {
    const match = models.find((m) => m.modelName === name);
    if (match) return match;
  }
  return models[0];
}

// "Groq · llama-3.3-70b-versatile" vs "Local · gpt-oss:120b" — lets the instructor
// tell cloud models apart from local Ollama ones even though both may show provider
// "OPENAI" (Groq is served through an OpenAI-compatible endpoint).
function modelProviderLabel(m: AiModelSummary): string {
  if (m.isLocal) return "Local";
  if (m.baseUrl?.toLowerCase().includes("groq")) return "Groq";
  if (m.provider === "OPENAI") return "OpenAI";
  if (m.provider === "DEEPSEEK") return "DeepSeek";
  return m.provider;
}

const aiErrText = (e: unknown) => (e instanceof Error ? e.message : "AI request failed");

interface AIAssistantPanelProps {
  questionId?: number;
  existingGroupId: number | null;
  questionType: QuestionType;
  difficulty: number;
  topicName: string | null;
  onApplyDraft: (question: DraftedQuestion) => void;
}

function AIAssistantPanel({
  questionId,
  existingGroupId,
  questionType,
  difficulty,
  topicName,
  onApplyDraft,
}: AIAssistantPanelProps) {
  const queryClient = useQueryClient();

  const modelsQuery = useQuery({
    queryKey: aiAuthoringKeys.list("models"),
    queryFn: aiAuthoringService.listModels,
  });
  const statusQuery = useQuery({
    queryKey: aiAuthoringKeys.list("ollama-status"),
    queryFn: aiAuthoringService.ollamaStatus,
  });

  // Any active model (local Ollama or cloud/OpenAI-compatible, e.g. Groq) can run
  // generation — the backend resolves whichever aiModelId is sent.
  const activeModels = (modelsQuery.data ?? []).filter((m) => m.isActive);
  const localModels = activeModels.filter((m) => m.isLocal);
  const preferred = pickPreferredModel(activeModels, questionType);
  const [selectedModelName, setSelectedModelName] = useState("");
  const effectiveModelName = selectedModelName || preferred?.modelName || "";
  const selectedModel = activeModels.find((m) => m.modelName === effectiveModelName);
  const effectiveModelId = selectedModel?.id;
  const selectedIsLocal = selectedModel?.isLocal ?? false;

  const [instructions, setInstructions] = useState("");
  const [draft, setDraft] = useState<{
    question: DraftedQuestion;
    resultText?: string;
    model: string;
    interactionId: number;
  } | null>(null);

  const [equivBId, setEquivBId] = useState("");
  const [equiv, setEquiv] = useState<{
    suggestion: string;
    interactionId: number;
    questionBId: number;
  } | null>(null);
  const [equivGroupConflictOpen, setEquivGroupConflictOpen] = useState(false);

  const ollamaReachable = statusQuery.data?.reachable ?? false;
  const hasLocalModel = localModels.length > 0;
  const hasAnyModel = activeModels.length > 0;
  // Ollama reachability only gates generation when the SELECTED model is local —
  // a cloud model (e.g. Groq) works regardless of local Ollama status.
  const canGenerate = hasAnyModel && !!topicName && (!selectedIsLocal || ollamaReachable);

  // ---- Draft generation (POST /ai/question-draft) ----
  // Structured drafts on local models can take 30-60s+; apiFetch has no client-side
  // timeout, so the request simply waits — the mutation's isPending state below is
  // the only thing gating the UI.
  const generateMutation = useMutation({
    mutationFn: () =>
      aiAuthoringService.generateQuestionDraft({
        topic: topicName ?? "",
        questionType,
        difficulty: DIFFICULTY_TEXT[difficulty] ?? String(difficulty),
        instructions: instructions.trim() || undefined,
        aiModelId: effectiveModelId,
      }),
    onSuccess: (res) => {
      setDraft({
        question: res.question,
        resultText: res.resultText,
        model: res.model,
        interactionId: res.aiInteractionId,
      });
      // Advisory prefill only — nothing is saved until the instructor hits Save.
      onApplyDraft(res.question);
      toast.success("AI draft generated — form pre-filled below. Review, then Save.");
    },
    onError: (e) => toast.error(aiErrText(e)),
  });

  const reviewDraftMutation = useMutation({
    mutationFn: (status: "ACCEPTED" | "REJECTED") =>
      aiAuthoringService.reviewInteraction(draft!.interactionId, status),
    onSuccess: (_res, status) => {
      toast(
        status === "ACCEPTED"
          ? "AI draft marked accepted."
          : "AI draft marked rejected. Pre-filled fields are left as-is — edit or clear them manually.",
      );
      setDraft(null);
    },
    onError: (e) => toast.error(aiErrText(e)),
  });

  // ---- Equivalence (POST /ai/equivalence-suggestion) — compares two EXISTING questions ----
  const questionsQuery = useQuery({
    queryKey: qk.questions.list(),
    queryFn: questionsService.list,
    enabled: questionId !== undefined,
  });
  const otherQuestions = (questionsQuery.data ?? []).filter((q) => q.id !== questionId);

  const equivMutation = useMutation({
    mutationFn: () =>
      aiAuthoringService.suggestEquivalence({
        questionAId: questionId!,
        questionBId: Number(equivBId),
        instructions: instructions.trim() || undefined,
      }),
    onSuccess: (res) =>
      setEquiv({
        suggestion: res.suggestion,
        interactionId: res.aiInteractionId,
        questionBId: res.questionBId,
      }),
    onError: (e) => toast.error(aiErrText(e)),
  });

  const reviewEquivMutation = useMutation({
    mutationFn: async (status: "ACCEPTED" | "REJECTED") => {
      await aiAuthoringService.reviewInteraction(equiv!.interactionId, status);
      // Accepting links B into A's existing group via existing DEV A grouping
      // (Question.equivalenceGroupId, onDelete SetNull).
      if (status === "ACCEPTED" && existingGroupId !== null && equiv) {
        await equivalenceGroupsService.addQuestion(existingGroupId, equiv.questionBId);
      }
      return status;
    },
    onSuccess: (status) => {
      if (status === "ACCEPTED") {
        if (existingGroupId !== null) {
          queryClient.invalidateQueries({ queryKey: equivalenceGroupsKeys.all });
          queryClient.invalidateQueries({ queryKey: qk.questions.all });
          toast.success("Equivalence accepted — linked into this question's group.");
        } else {
          toast.success(
            "Equivalence accepted. Assign this question to an equivalent group above to link them.",
          );
        }
      } else {
        toast("Equivalence suggestion rejected");
      }
      setEquiv(null);
      setEquivBId("");
    },
    onError: (e) => toast.error(aiErrText(e)),
  });

  // Detect when question B is already in a different equivalent group than A.
  const questionBData = equiv ? otherQuestions.find((q) => q.id === equiv.questionBId) : null;
  const equivBGroupId = questionBData?.equivalenceGroupId ?? null;
  const hasGroupConflict =
    existingGroupId !== null && equivBGroupId !== null && equivBGroupId !== existingGroupId;

  const handleEquivAccept = () => {
    if (hasGroupConflict) {
      setEquivGroupConflictOpen(true);
    } else {
      reviewEquivMutation.mutate("ACCEPTED");
    }
  };

  return (
    <>
      <Card className="border-primary/30 bg-primary-soft/30">
        <CardHeader>
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 text-accent-foreground" />
            <div>
              <CardTitle className="text-sm">AI assistant</CardTitle>
              <CardDescription className="text-xs">
                AI suggestions must be reviewed by an instructor before use. Accepting never
                auto-publishes — drafts land as DRAFT for review.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Model availability / Ollama reachability (only relevant for a local model) */}
          {statusQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Checking AI model status…</p>
          ) : !hasAnyModel ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
              <span>No active AI model. Activate one under AI Models to enable generation.</span>
            </div>
          ) : selectedIsLocal && !ollamaReachable ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
              <span>
                Ollama is not reachable
                {statusQuery.data?.baseUrl ? ` at ${statusQuery.data.baseUrl}` : ""}. AI generation
                is disabled until the local model is running, or pick a cloud model above.
              </span>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs">AI model</Label>
            <Select
              value={effectiveModelName}
              onValueChange={setSelectedModelName}
              disabled={!hasAnyModel}
            >
              <SelectTrigger>
                <SelectValue placeholder="No active model" />
              </SelectTrigger>
              <SelectContent>
                {activeModels.map((m) => (
                  <SelectItem key={m.id} value={m.modelName}>
                    {modelProviderLabel(m)} · {m.displayName ?? m.modelName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-1 pt-1">
              {selectedModel && (
                <StatusBadge
                  status={modelProviderLabel(selectedModel)}
                  tone={selectedModel.isLocal ? "success" : "warning"}
                />
              )}
              {preferred && (
                <StatusBadge status={`Suggested for ${TYPE_LABEL[questionType]}`} tone="muted" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              This model runs the generation below.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Instructions (optional)</Label>
            <Textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Extra guidance for the model…"
            />
          </div>

          {/* Generate question draft from the selected topic + objective */}
          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              disabled={!canGenerate || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              <Wand2 className="mr-1.5 h-4 w-4" />
              {generateMutation.isPending ? "Generating…" : "Generate question from topic"}
            </Button>
            {generateMutation.isPending ? (
              <p className="text-[11px] text-muted-foreground">
                Structured generation can take up to a minute on local models — please wait.
              </p>
            ) : (
              hasAnyModel &&
              (!selectedIsLocal || ollamaReachable) &&
              !topicName && (
                <p className="text-[11px] text-muted-foreground">
                  Select a topic first.
                </p>
              )
            )}
          </div>

          {draft && (
            <div className="rounded-md border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                AI draft applied to the form (advisory)
              </div>
              <p className="mt-1 text-sm font-medium">{draft.question.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {TYPE_LABEL[draft.question.type]} · {DIFFICULTY_LABEL[draft.question.difficulty]}
                {draft.question.type === "MULTIPLE_CHOICE"
                  ? ` · ${draft.question.answerOptions.length} options`
                  : ""}
                {` · ${draft.model}`}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Title, description, type, difficulty
                {draft.question.type === "MULTIPLE_CHOICE" ? " and options were" : " were"}{" "}
                pre-filled below. Review and edit, then Save when ready — nothing is saved yet.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reviewDraftMutation.isPending}
                  onClick={() => reviewDraftMutation.mutate("ACCEPTED")}
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={reviewDraftMutation.isPending}
                  onClick={() => reviewDraftMutation.mutate("REJECTED")}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </div>
          )}

          {/* TODO(Dev B): "Generate equivalent question" (POST /ai/equivalent-question,
            aiAuthoringService.generateEquivalentQuestion) generates a NEW question from
            this one — for the pre-test -> post-test flow. That entry point belongs to
            Dev B's post-test wizard (app.assessments.$id.post-test.tsx), not this
            question-bank editor. Not wired here; service function is ready to consume. */}

          {/* Equivalence check between this (saved) question and another existing one */}
          {questionId !== undefined && (
            <div className="space-y-1.5 border-t pt-3">
              <Label className="text-xs">Check equivalence with another question</Label>
              <Select value={equivBId} onValueChange={setEquivBId} disabled={!ollamaReachable}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a question to compare" />
                </SelectTrigger>
                <SelectContent>
                  {otherQuestions.map((q) => (
                    <SelectItem key={q.id} value={String(q.id)}>
                      {q.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled={
                  !ollamaReachable || !hasLocalModel || !equivBId || equivMutation.isPending
                }
                onClick={() => equivMutation.mutate()}
              >
                <Wand2 className="mr-1.5 h-4 w-4" />
                {equivMutation.isPending ? "Comparing…" : "Suggest equivalence"}
              </Button>

              {equiv && (
                <div className="rounded-md border bg-card p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    AI equivalence assessment (advisory)
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{equiv.suggestion}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewEquivMutation.isPending}
                      onClick={handleEquivAccept}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Accept
                      {existingGroupId !== null ? " & link" : ""}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={reviewEquivMutation.isPending}
                      onClick={() => reviewEquivMutation.mutate("REJECTED")}
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={equivGroupConflictOpen} onOpenChange={setEquivGroupConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move question to a different group?</AlertDialogTitle>
            <AlertDialogDescription>
              The selected question already belongs to another equivalent group. Accepting will move
              it into this question's group. Its previous group membership will be overwritten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewEquivMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setEquivGroupConflictOpen(false);
                reviewEquivMutation.mutate("ACCEPTED");
              }}
              disabled={reviewEquivMutation.isPending}
            >
              Move and accept
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
