import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Check, ChevronLeft, ChevronRight, AlertTriangle, Sparkles, X, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { PARTICIPANTS } from "@/lib/mock-data";
import { qk } from "@/lib/query-keys";
import { assessmentsService } from "@/services/assessments";
import { trainingsService } from "@/services/trainings";
import { topicsService } from "@/services/topics";
import { learningObjectivesService } from "@/services/learningObjectives";
import { questionsService } from "@/services/questions";
import { cn } from "@/lib/utils";
import type { AssessmentType, LearningObjective, Question, Topic, Training } from "@/types";
import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/assessments/new")({
  validateSearch: z.object({ trainingId: z.string().optional() }),
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: CreateAssessmentWizard,
});

const STEPS = [
  { id: 1, title: "Basic info" },
  { id: 2, title: "Scope" },
  { id: 3, title: "Questions" },
  { id: 4, title: "Assign" },
  { id: 5, title: "Preview & Draft" },
];

function CreateAssessmentWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { trainingId } = useSearch({ from: "/app/assessments/new" });
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trainingsQuery = useQuery({
    queryKey: qk.trainings.list(),
    queryFn: trainingsService.list,
  });
  const topicsQuery = useQuery({
    queryKey: qk.topics.list(),
    queryFn: topicsService.list,
  });
  const objectivesQuery = useQuery({
    queryKey: qk.learningObjectives.list(),
    queryFn: () => learningObjectivesService.list(),
  });
  const questionsQuery = useQuery({
    queryKey: qk.questions.list(),
    queryFn: questionsService.list,
  });

  const [form, setForm] = useState<AssessmentFormState>({
    title: "Databases — Pre-test (new)",
    description:
      "Diagnostic pre-test to map prior knowledge of SQL basics, joins and normalization.",
    type: "Pre-test",
    trainingId: trainingId ?? "",
    timeLimit: 30,
    availability: "1 week",
    randomizeQuestions: true,
    randomizeAnswers: false,
    topicIds: [] as string[],
    learningObjectiveId: "all",
    generationDifficulty: "any" as "any" | "easy" | "medium" | "hard",
    difficulty: { easy: 40, medium: 40, hard: 20 },
    questionCount: 8,
    selectedQuestionIds: [] as string[],
    assignTo: "training" as "training" | "selected",
    selectedParticipantIds: PARTICIPANTS.map((p) => p.id),
    accessMode: "assigned" as "assigned" | "link",
    dueDate: "2026-11-08",
    attemptLimit: 1,
  });

  const trainings = trainingsQuery.data ?? [];
  const topics = topicsQuery.data ?? [];
  const objectives = objectivesQuery.data ?? [];
  const questions = questionsQuery.data ?? [];
  const selectedTrainingId = Number(form.trainingId);

  const training = trainings.find((item) => item.id === selectedTrainingId) ?? null;
  const trainingTopics = useMemo(
    () => topics.filter((topic) => topic.trainingId === selectedTrainingId),
    [topics, selectedTrainingId],
  );
  const trainingTopicIds = useMemo(
    () => new Set(trainingTopics.map((topic) => topic.id)),
    [trainingTopics],
  );
  const visibleTopicIds = new Set(form.topicIds.map((id) => Number(id)));
  const trainingQuestions = useMemo(
    () =>
      questions.filter((question) => {
        if (question.status !== "APPROVED") return false;
        if (!trainingTopicIds.has(question.topicId)) return false;
        if (visibleTopicIds.size > 0 && !visibleTopicIds.has(question.topicId)) return false;
        return true;
      }),
    [questions, trainingTopicIds, visibleTopicIds],
  );
  const selectedQuestions = useMemo(
    () =>
      trainingQuestions.filter((question) =>
        form.selectedQuestionIds.includes(String(question.id)),
      ),
    [trainingQuestions, form.selectedQuestionIds],
  );
  const visibleObjectives = useMemo(() => {
    if (form.topicIds.length === 0) return [];
    const selectedTopicIds = new Set(form.topicIds.map((id) => Number(id)));
    return objectives.filter((objective) => selectedTopicIds.has(objective.topicId));
  }, [objectives, form.topicIds]);
  const topicQuestionCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const question of questions) {
      if (question.status !== "APPROVED") continue;
      counts.set(question.topicId, (counts.get(question.topicId) ?? 0) + 1);
    }
    return counts;
  }, [questions]);

  useEffect(() => {
    if (trainings.length === 0) return;
    if (trainings.some((item) => String(item.id) === form.trainingId)) return;
    setForm((current) => ({
      ...current,
      trainingId: String(trainings[0].id),
    }));
  }, [form.trainingId, trainings]);

  useEffect(() => {
    if (trainingTopics.length === 0) {
      if (
        form.topicIds.length === 0 &&
        form.selectedQuestionIds.length === 0 &&
        form.learningObjectiveId === "all"
      ) {
        return;
      }
      setForm((current) => ({
        ...current,
        topicIds: [],
        learningObjectiveId: "all",
        selectedQuestionIds: [],
      }));
      return;
    }

    const validTopicIds = new Set(trainingTopics.map((topic) => String(topic.id)));
    const nextTopicIds = form.topicIds.filter((id) => validTopicIds.has(id));
    const resolvedTopicIds = nextTopicIds.length > 0 ? nextTopicIds : trainingTopics.map((topic) => String(topic.id));
    const resolvedTopicIdSet = new Set(resolvedTopicIds.map((id) => Number(id)));
    const validQuestionIds = new Set(
      questions
        .filter(
          (question) =>
            question.status === "APPROVED" && resolvedTopicIdSet.has(question.topicId),
        )
        .map((question) => String(question.id)),
    );
    const nextSelectedQuestionIds = form.selectedQuestionIds.filter((id) => validQuestionIds.has(id));
    const validObjectiveIds = new Set(
      objectives
        .filter((objective) => resolvedTopicIdSet.has(objective.topicId))
        .map((objective) => String(objective.id)),
    );
    const nextLearningObjectiveId =
      form.learningObjectiveId === "all" || validObjectiveIds.has(form.learningObjectiveId)
        ? form.learningObjectiveId
        : "all";

    if (
      arraysEqual(resolvedTopicIds, form.topicIds) &&
      arraysEqual(nextSelectedQuestionIds, form.selectedQuestionIds) &&
      nextLearningObjectiveId === form.learningObjectiveId
    ) {
      return;
    }

    setForm((current) => ({
      ...current,
      topicIds: resolvedTopicIds,
      learningObjectiveId: nextLearningObjectiveId,
      selectedQuestionIds: nextSelectedQuestionIds,
    }));
  }, [
    trainingTopics,
    questions,
    objectives,
    form.topicIds,
    form.selectedQuestionIds,
    form.learningObjectiveId,
  ]);

  const createMutation = useMutation({
    mutationFn: () =>
      assessmentsService.create({
        title: form.title.trim(),
        description: form.description.trim() || null,
        trainingId: selectedTrainingId,
        type: mapAssessmentType(form.type),
        questions: Array.from(new Set(form.selectedQuestionIds)).map((id) => Number(id)),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: qk.assessments.all });
      setSubmitError(null);
      toast.success(`Assessment “${created.title}” created as draft`, {
        description: "Publish it later from the assessment detail page.",
      });
      navigate({
        to: "/app/assessments/$id",
        params: { id: String(created.id) },
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to create assessment";
      setSubmitError(message);
      toast.error(message);
    },
  });
  const generateMutation = useMutation({
    mutationFn: async () => {
      const singleTopicId =
        form.topicIds.length === 1 ? Number(form.topicIds[0]) : undefined;
      const learningObjectiveId =
        form.learningObjectiveId !== "all" ? Number(form.learningObjectiveId) : undefined;

      return assessmentsService.generate({
        title: form.title.trim(),
        description: form.description.trim() || null,
        trainingId: selectedTrainingId,
        topicId: singleTopicId,
        learningObjectiveId,
        difficulty:
          form.generationDifficulty === "any" ? undefined : form.generationDifficulty,
        count: form.questionCount,
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: qk.assessments.all });
      setSubmitError(null);
      toast.success(`Generated “${created.title}” as a draft`, {
        description: "Review the generated draft before deciding whether to publish it.",
      });
      navigate({
        to: "/app/assessments/$id",
        params: { id: String(created.id) },
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to generate assessment";
      setSubmitError(message);
      toast.error(message);
    },
  });

  const back = () => setStep((s) => Math.max(1, s - 1));
  const next = () => setStep((s) => Math.min(5, s + 1));

  const createDraft = () => {
    const uniqueQuestionIds = Array.from(new Set(form.selectedQuestionIds));
    const validationError = validateDraft({
      title: form.title,
      trainingId: form.trainingId,
      selectedQuestionIds: uniqueQuestionIds,
    });
    if (validationError) {
      setSubmitError(validationError);
      toast.error(validationError);
      return;
    }
    if (uniqueQuestionIds.length !== form.selectedQuestionIds.length) {
      setForm((current) => ({
        ...current,
        selectedQuestionIds: uniqueQuestionIds,
      }));
    }
    setSubmitError(null);
    createMutation.mutate();
  };
  const generateDraft = () => {
    const validationError = validateGeneratedDraft({
      title: form.title,
      trainingId: form.trainingId,
      count: form.questionCount,
    });
    if (validationError) {
      setSubmitError(validationError);
      toast.error(validationError);
      return;
    }
    setSubmitError(null);
    generateMutation.mutate();
  };

  const loading =
    trainingsQuery.isLoading ||
    topicsQuery.isLoading ||
    objectivesQuery.isLoading ||
    questionsQuery.isLoading;
  const dataError =
    trainingsQuery.error ??
    topicsQuery.error ??
    objectivesQuery.error ??
    questionsQuery.error ??
    null;

  if (loading) {
    return (
      <>
        <PageHeader
          breadcrumbs={
            <>
              <Link to="/app/assessments" className="hover:underline">
                Assessments
              </Link>
              <span className="mx-1">/</span>
              <span>New assessment</span>
            </>
          }
          title="Create assessment"
          description="Define basics, blueprint, questions, assignment and review before publishing."
        />
        <LoadingState label="Loading assessment builder…" />
      </>
    );
  }

  if (dataError) {
    return (
      <>
        <PageHeader
          breadcrumbs={
            <>
              <Link to="/app/assessments" className="hover:underline">
                Assessments
              </Link>
              <span className="mx-1">/</span>
              <span>New assessment</span>
            </>
          }
          title="Create assessment"
          description="Define basics, blueprint, questions, assignment and review before publishing."
        />
        <ErrorState
          message={dataError instanceof Error ? dataError.message : "Failed to load assessment data"}
          onRetry={() => {
            trainingsQuery.refetch();
            topicsQuery.refetch();
            objectivesQuery.refetch();
            questionsQuery.refetch();
          }}
        />
      </>
    );
  }

  if (trainings.length === 0) {
    return (
      <>
        <PageHeader
          breadcrumbs={
            <>
              <Link to="/app/assessments" className="hover:underline">
                Assessments
              </Link>
              <span className="mx-1">/</span>
              <span>New assessment</span>
            </>
          }
          title="Create assessment"
          description="Define basics, blueprint, questions, assignment and review before publishing."
        />
        <div className="p-4 sm:p-6 lg:p-8">
          <EmptyState
            icon={<Save className="h-5 w-5" />}
            title="No trainings available"
            description="Create a training first before building an assessment."
            action={
              <Button asChild size="sm">
                <Link to="/app/trainings">Open trainings</Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={
          <>
            <Link to="/app/assessments" className="hover:underline">
              Assessments
            </Link>
            <span className="mx-1">/</span>
            <span>New assessment</span>
          </>
        }
        title="Create assessment"
        description="Define basics, blueprint, questions, assignment and review before publishing."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/assessments" })}>
              <X className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={createDraft} disabled={createMutation.isPending}>
              <Save className="mr-1.5 h-4 w-4" /> Save as draft
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Stepper step={step} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            {step === 1 && <Step1 form={form} setForm={setForm} trainings={trainings} />}
            {step === 2 && (
              <Step2
                form={form}
                setForm={setForm}
                topics={trainingTopics}
                objectives={visibleObjectives}
                topicQuestionCounts={topicQuestionCounts}
              />
            )}
            {step === 3 && (
              <Step3
                form={form}
                setForm={setForm}
                questions={trainingQuestions}
                selected={selectedQuestions}
                onGenerate={generateDraft}
                generatePending={generateMutation.isPending}
              />
            )}
            {step === 4 && <Step4 form={form} setForm={setForm} />}
            {step === 5 && (
              <Step5
                form={form}
                training={training?.title}
                selected={selectedQuestions}
                submitError={submitError}
              />
            )}

            <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-2 sm:flex-row sm:items-center">
              <Button variant="outline" onClick={back} disabled={step === 1}>
                <ChevronLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
              {step < 5 ? (
                <Button onClick={next}>
                  Continue <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={createDraft} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating draft…" : "Create draft assessment"}
                </Button>
              )}
            </div>
          </div>

          <aside className="hidden lg:block">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <SumRow label="Title" value={form.title} />
                <SumRow label="Type" value={form.type} />
                <SumRow label="Training" value={training?.title ?? "—"} />
                <SumRow label="Questions" value={`${form.selectedQuestionIds.length}`} />
                <SumRow label="Time limit" value={`${form.timeLimit} min`} />
                <SumRow
                  label="Assigned"
                  value={
                    form.assignTo === "training"
                      ? `Entire training (${PARTICIPANTS.length})`
                      : `${form.selectedParticipantIds.length} selected`
                  }
                />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {STEPS.map((s, i) => {
        const status = s.id < step ? "done" : s.id === step ? "active" : "pending";
        return (
          <li key={s.id} className="flex items-center gap-3 sm:flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                  status === "done" && "border-primary bg-primary text-primary-foreground",
                  status === "active" && "border-primary text-primary",
                  status === "pending" && "border-border text-muted-foreground",
                )}
              >
                {status === "done" ? <Check className="h-3.5 w-3.5" /> : s.id}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  status === "pending" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {s.title}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="hidden h-px flex-1 bg-border sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

function SumRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

type AssessmentFormState = {
  title: string;
  description: string;
  type: "Pre-test" | "Post-test" | "Regular test" | "Practice";
  trainingId: string;
  timeLimit: number;
  availability: string;
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  topicIds: string[];
  learningObjectiveId: string;
  generationDifficulty: "any" | "easy" | "medium" | "hard";
  difficulty: { easy: number; medium: number; hard: number };
  questionCount: number;
  selectedQuestionIds: string[];
  assignTo: "training" | "selected";
  selectedParticipantIds: string[];
  accessMode: "assigned" | "link";
  dueDate: string;
  attemptLimit: number;
};

function Step1({
  form,
  setForm,
  trainings,
}: {
  form: AssessmentFormState;
  setForm: React.Dispatch<React.SetStateAction<AssessmentFormState>>;
  trainings: Training[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Basic info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Title">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Description / instructions">
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assessment type">
            <Select
              value={form.type}
              onValueChange={(value) =>
                setForm({ ...form, type: value as AssessmentFormState["type"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pre-test">Pre-test</SelectItem>
                <SelectItem value="Post-test">Post-test</SelectItem>
                <SelectItem value="Regular test">Regular test</SelectItem>
                <SelectItem value="Practice">Practice</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Training">
            <Select
              value={form.trainingId}
              onValueChange={(v) => setForm({ ...form, trainingId: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trainings.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Time limit (minutes)">
            <Input
              type="number"
              value={form.timeLimit}
              onChange={(e) => setForm({ ...form, timeLimit: +e.target.value })}
            />
          </Field>
          <Field label="Availability window">
            <Input
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
            />
          </Field>
        </div>
        <div className="space-y-2 rounded-md border bg-surface p-3">
          <ToggleRow
            label="Randomize question order"
            desc="Each participant sees a different order."
            value={form.randomizeQuestions}
            onChange={(v) => setForm({ ...form, randomizeQuestions: v })}
          />
          <ToggleRow
            label="Randomize answer options"
            desc="Shuffles answer choices for multiple/single choice."
            value={form.randomizeAnswers}
            onChange={(v) => setForm({ ...form, randomizeAnswers: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Step2({
  form,
  setForm,
  topics,
  objectives,
  topicQuestionCounts,
}: {
  form: AssessmentFormState;
  setForm: React.Dispatch<React.SetStateAction<AssessmentFormState>>;
  topics: Topic[];
  objectives: LearningObjective[];
  topicQuestionCounts: Map<number, number>;
}) {
  const toggleTopic = (id: string) => {
    setForm((current) => ({
      ...current,
      topicIds: current.topicIds.includes(id)
        ? current.topicIds.filter((topicId) => topicId !== id)
        : Array.from(new Set([...current.topicIds, id])),
    }));
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scope — assessment blueprint</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="text-sm">Topics</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {topics.map((t) => {
              const id = String(t.id);
              const active = form.topicIds.includes(id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTopic(id)}
                  className={cn(
                    "flex items-start gap-2 rounded-md border bg-card p-3 text-left transition-colors",
                    active ? "border-primary bg-primary-soft" : "hover:bg-muted/40",
                  )}
                >
                  <Checkbox checked={active} className="mt-0.5 pointer-events-none" />
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {topicQuestionCounts.get(t.id) ?? 0} approved questions
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {topics.length === 0 && (
            <div className="mt-2 rounded-md border bg-surface p-3 text-sm text-muted-foreground">
              This training has no topics yet. Add topics and approved questions before creating an assessment.
            </div>
          )}
        </div>

        <div>
          <Label className="text-sm">Difficulty distribution</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <DiffField
              label="Easy"
              value={form.difficulty.easy}
              onChange={(v) => setForm({ ...form, difficulty: { ...form.difficulty, easy: v } })}
            />
            <DiffField
              label="Medium"
              value={form.difficulty.medium}
              onChange={(v) => setForm({ ...form, difficulty: { ...form.difficulty, medium: v } })}
            />
            <DiffField
              label="Hard"
              value={form.difficulty.hard}
              onChange={(v) => setForm({ ...form, difficulty: { ...form.difficulty, hard: v } })}
            />
          </div>
        </div>

        <Field label="Number of questions">
          <Input
            type="number"
            className="max-w-[120px]"
            value={form.questionCount}
            onChange={(e) => setForm({ ...form, questionCount: +e.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Learning objective filter">
            <Select
              value={form.learningObjectiveId}
              onValueChange={(value) => setForm({ ...form, learningObjectiveId: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All learning objectives</SelectItem>
                {objectives.map((objective) => (
                  <SelectItem key={objective.id} value={String(objective.id)}>
                    {objective.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="AI generation difficulty">
            <Select
              value={form.generationDifficulty}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  generationDifficulty: value as AssessmentFormState["generationDifficulty"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any difficulty</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-medium">Coverage notice</div>
              <div className="text-xs">
                6 approved questions are missing equivalent variants. You can still proceed, but
                post-tests will require manual variants.
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DiffField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1 flex items-center gap-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className="h-8"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}

function Step3({
  form,
  setForm,
  questions,
  selected,
  onGenerate,
  generatePending,
}: {
  form: AssessmentFormState;
  setForm: React.Dispatch<React.SetStateAction<AssessmentFormState>>;
  questions: Question[];
  selected: Question[];
  onGenerate: () => void;
  generatePending: boolean;
}) {
  const toggle = (id: string) => {
    setForm((current) => ({
      ...current,
      selectedQuestionIds: current.selectedQuestionIds.includes(id)
        ? current.selectedQuestionIds.filter((questionId) => questionId !== id)
        : Array.from(new Set([...current.selectedQuestionIds, id])),
    }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Questions</CardTitle>
            <Button variant="outline" size="sm" onClick={onGenerate} disabled={generatePending}>
              <Sparkles className="mr-1.5 h-4 w-4" />{" "}
              {generatePending ? "Generating draft…" : "Generate draft assessment"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Only approved questions can be published. Generation creates a draft assessment that
            you review before any separate publish step.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {questions.length === 0 ? (
            <div className="rounded-md border bg-surface p-4 text-sm text-muted-foreground">
              No approved questions match the selected training and topic scope.
            </div>
          ) : (
            questions.map((q) => {
              const id = String(q.id);
              const active = form.selectedQuestionIds.includes(id);
              return (
                <label
                  key={q.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 transition-colors",
                    active ? "border-primary bg-primary-soft/50" : "hover:bg-muted/40",
                  )}
                >
                  <Checkbox
                    checked={active}
                    onCheckedChange={() => toggle(id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{q.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{q.topic?.name ?? "—"}</span>
                      <span>·</span>
                      <span>{q.learningObjective?.title ?? "No objective"}</span>
                      <span>·</span>
                      <span>{difficultyLabel(q.difficulty)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status="Approved" />
                    {q.equivalentGroup && (
                      <span className="text-[10px] text-muted-foreground">
                        Group: {q.equivalentGroup.name}
                      </span>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </CardContent>
      </Card>
      <div className="rounded-md border bg-surface p-3 text-sm text-muted-foreground">
        <strong className="text-foreground">{selected.length}</strong> question
        {selected.length !== 1 ? "s" : ""} selected.
      </div>
    </div>
  );
}

function Step4({
  form,
  setForm,
}: {
  form: AssessmentFormState;
  setForm: React.Dispatch<React.SetStateAction<AssessmentFormState>>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assign</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="text-sm">Who can take this assessment?</Label>
          <div className="mt-2 grid gap-2">
            <ChoiceRow
              active={form.assignTo === "training"}
              onClick={() => setForm({ ...form, assignTo: "training" })}
              title={`Entire training (${PARTICIPANTS.length} participants)`}
              desc="All current and future participants of the training."
            />
            <ChoiceRow
              active={form.assignTo === "selected"}
              onClick={() => setForm({ ...form, assignTo: "selected" })}
              title="Selected participants only"
              desc="Manually pick who can take the assessment."
            />
          </div>
        </div>

        <div>
          <Label className="text-sm">Access mode</Label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <ChoiceRow
              active={form.accessMode === "assigned"}
              onClick={() => setForm({ ...form, accessMode: "assigned" })}
              title="Assigned users only"
              desc="Strict assignment. No link sharing."
            />
            <ChoiceRow
              active={form.accessMode === "link"}
              onClick={() => setForm({ ...form, accessMode: "link" })}
              title="Access link / QR for assigned users"
              desc="QR shareable; still respects assignment."
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due date">
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>
          <Field label="Attempt limit">
            <Input
              type="number"
              value={form.attemptLimit}
              onChange={(e) => setForm({ ...form, attemptLimit: +e.target.value })}
            />
          </Field>
        </div>

        <div className="rounded-md border bg-surface p-3 text-xs text-muted-foreground">
          Participants will only see assessments assigned to them.
        </div>
      </CardContent>
    </Card>
  );
}

function Step5({
  form,
  training,
  selected,
  submitError,
}: {
  form: AssessmentFormState;
  training?: string;
  selected: Question[];
  submitError: string | null;
}) {
  const checks = [
    { ok: selected.length > 0 && selected.every((q) => q.status === "APPROVED"), label: "All questions approved" },
    { ok: form.assignTo, label: "Participants assigned" },
    { ok: !!form.dueDate, label: "Availability set" },
    { ok: !!form.description, label: "Instructions added" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview & create draft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm">
            <SumRow label="Title" value={form.title} />
            <SumRow label="Training" value={training ?? "—"} />
            <SumRow label="Type" value={form.type} />
            <SumRow label="Questions" value={`${selected.length}`} />
            <SumRow label="Time limit" value={`${form.timeLimit} min`} />
            <SumRow label="Availability" value={form.availability} />
            <SumRow label="Due date" value={form.dueDate} />
          </div>

          <div className="rounded-md border bg-surface p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Validation
            </div>
            <ul className="space-y-1.5 text-sm">
              {checks.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  {c.ok ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
          {submitError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview (as participant)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-card p-4">
            <div className="text-sm font-semibold">{form.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {training} · {form.timeLimit} min · {selected.length} questions
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{form.description}</p>
            <Button className="mt-4" disabled>
              Start assessment
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function difficultyLabel(value: number) {
  return value === 1 ? "Easy" : value === 2 ? "Medium" : value === 3 ? "Hard" : String(value);
}

function mapAssessmentType(value: AssessmentFormState["type"]): AssessmentType {
  if (value === "Pre-test") return "PRE_TEST";
  if (value === "Post-test") return "POST_TEST";
  return "QUIZ";
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function validateDraft({
  title,
  trainingId,
  selectedQuestionIds,
}: {
  title: string;
  trainingId: string;
  selectedQuestionIds: string[];
}) {
  if (!title.trim()) return "Title is required";
  if (!trainingId) return "Training is required";
  if (selectedQuestionIds.length === 0) return "Select at least one approved question";
  return null;
}

function validateGeneratedDraft({
  title,
  trainingId,
  count,
}: {
  title: string;
  trainingId: string;
  count: number;
}) {
  if (!title.trim()) return "Title is required";
  if (!trainingId) return "Training is required";
  if (!Number.isInteger(count) || count < 1) return "Question count must be at least 1";
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </label>
  );
}

function ChoiceRow({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 rounded-md border bg-card p-3 text-left",
        active ? "border-primary bg-primary-soft" : "hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "mt-1 h-3.5 w-3.5 rounded-full border",
          active ? "border-primary bg-primary" : "border-border",
        )}
      />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}
