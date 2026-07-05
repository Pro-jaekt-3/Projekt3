import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Shield,
  Cloud,
  X,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assessmentsService } from "@/services/assessments";
import { topicsService } from "@/services/topics";
import { questionsService } from "@/services/questions";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { ensureRole } from "@/lib/route-guards";
import type { Assessment, AssessmentStatus, Question, Topic } from "@/types";

export const Route = createFileRoute("/app/assessments/$id/post-test")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: PostTestWizard,
});

const STEPS = [
  { id: 1, title: "Choose pre-test" },
  { id: 2, title: "Blueprint" },
  { id: 3, title: "Equivalent variants" },
  { id: 4, title: "AI-generate missing" },
  { id: 5, title: "Review & publish" },
];

const AI_MODEL_OPTIONS = [
  {
    id: "local-default",
    displayName: "Local QA Model",
    location: "local" as const,
    quality: "Balanced",
    speed: "Fast",
    defaultFor: ["Equivalent variants"],
  },
  {
    id: "cloud-default",
    displayName: "Cloud Reasoning Model",
    location: "cloud" as const,
    quality: "High quality",
    speed: "Moderate",
    defaultFor: ["Equivalent variants"],
  },
];

const STATUS_LABEL: Record<AssessmentStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

function PostTestWizard() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [selectedPreId, setSelectedPreId] = useState(id);
  const [modelId, setModelId] = useState(AI_MODEL_OPTIONS[0]?.id ?? "");
  const [generatedAssessment, setGeneratedAssessment] = useState<Assessment | null>(null);
  const [generatedSignature, setGeneratedSignature] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Record<string, "approved" | "rejected" | "later" | null>>(
    {},
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [config, setConfig] = useState({
    title: "Post-test draft",
    description:
      "Follow-up assessment using approved same-training questions for comparable post-test review.",
    topicId: "all",
    difficulty: "any" as "any" | "easy" | "medium" | "hard",
    count: 0,
  });

  const relatedAssessmentQuery = useQuery({
    queryKey: qk.assessments.detail(id),
    queryFn: () => assessmentsService.get(id),
  });
  const assessmentsQuery = useQuery({
    queryKey: qk.assessments.list(),
    queryFn: assessmentsService.list,
  });
  const topicsQuery = useQuery({
    queryKey: qk.topics.list(),
    queryFn: topicsService.list,
  });
  const questionsQuery = useQuery({
    queryKey: qk.questions.list(),
    queryFn: questionsService.list,
  });

  const loading =
    relatedAssessmentQuery.isLoading ||
    assessmentsQuery.isLoading ||
    topicsQuery.isLoading ||
    questionsQuery.isLoading;
  const dataError =
    relatedAssessmentQuery.error ??
    assessmentsQuery.error ??
    topicsQuery.error ??
    questionsQuery.error ??
    null;

  const allAssessments = assessmentsQuery.data ?? [];
  const preTests = allAssessments.filter((assessment) => assessment.type === "PRE_TEST");
  const topics = topicsQuery.data ?? [];
  const questionsCatalog = questionsQuery.data ?? [];
  const questionById = useMemo(
    () => new Map(questionsCatalog.map((question) => [question.id, question])),
    [questionsCatalog],
  );

  useEffect(() => {
    if (preTests.length === 0) return;
    if (preTests.some((assessment) => String(assessment.id) === selectedPreId)) return;
    setSelectedPreId(String(preTests[0].id));
  }, [preTests, selectedPreId]);

  const selectedPre =
    (String(relatedAssessmentQuery.data?.id) === selectedPreId
      ? relatedAssessmentQuery.data
      : preTests.find((assessment) => String(assessment.id) === selectedPreId)) ?? null;

  const trainingTopics = useMemo(() => {
    if (!selectedPre) return [];
    return topics.filter((topic) => topic.trainingId === selectedPre.trainingId);
  }, [topics, selectedPre]);
  const trainingTopicIds = useMemo(
    () => new Set(trainingTopics.map((topic) => topic.id)),
    [trainingTopics],
  );
  const approvedTrainingQuestions = useMemo(
    () =>
      questionsCatalog.filter(
        (question) => question.status === "APPROVED" && trainingTopicIds.has(question.topicId),
      ),
    [questionsCatalog, trainingTopicIds],
  );
  const preQuestions = useMemo(() => {
    if (!selectedPre) return [];
    return (selectedPre.questions ?? [])
      .map((item) => questionById.get(item.questionId) ?? item.question)
      .filter((question): question is Question => Boolean(question));
  }, [selectedPre, questionById]);
  const variantOptionsByEquivalenceGroupId = useMemo(() => {
    const byGroup = new Map<number, Question[]>();
    for (const question of approvedTrainingQuestions) {
      if (!question.equivalenceGroupId) continue;
      const list = byGroup.get(question.equivalenceGroupId) ?? [];
      list.push(question);
      byGroup.set(question.equivalenceGroupId, list);
    }
    return byGroup;
  }, [approvedTrainingQuestions]);
  const equivalentVariantByPreQuestionId = useMemo(() => {
    const map = new Map<number, Question | null>();
    for (const question of preQuestions) {
      if (!question.equivalenceGroupId) {
        map.set(question.id, null);
        continue;
      }
      const candidate =
        variantOptionsByEquivalenceGroupId
          .get(question.equivalenceGroupId)
          ?.find((item) => item.id !== question.id && item.status === "APPROVED") ?? null;
      map.set(question.id, candidate);
    }
    return map;
  }, [variantOptionsByEquivalenceGroupId, preQuestions]);
  const preQuestionsMissingEquivalenceVariant = useMemo(
    () => preQuestions.filter((question) => !equivalentVariantByPreQuestionId.get(question.id)),
    [preQuestions, equivalentVariantByPreQuestionId],
  );

  useEffect(() => {
    if (!selectedPre) return;
    const suggestedTitle = resolvePostTestTitle(selectedPre.title);
    setConfig((current) => ({
      ...current,
      title: current.title === "Post-test draft" ? suggestedTitle : current.title,
      count:
        current.count > 0 && current.count <= approvedTrainingQuestions.length
          ? current.count
          : Math.max(1, preQuestions.length),
    }));
  }, [selectedPre, preQuestions.length, approvedTrainingQuestions.length]);

  useEffect(() => {
    setGeneratedAssessment(null);
    setGeneratedSignature(null);
    setReviewed({});
    setActionError(null);
  }, [selectedPreId, config.topicId, config.difficulty, config.count, config.title, config.description]);

  const generationSignature = selectedPre
    ? buildGenerationSignature({
        preId: selectedPre.id,
        title: config.title,
        description: config.description,
        topicId: config.topicId,
        difficulty: config.difficulty,
        count: config.count,
      })
    : "";

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPre) {
        throw new Error("Choose a related pre-test first");
      }
      if (
        generatedAssessment &&
        generatedSignature &&
        generatedSignature !== generationSignature &&
        generatedAssessment.status === "DRAFT"
      ) {
        await assessmentsService.removeQuietly(generatedAssessment.id);
      }

      const generated = await assessmentsService.generate({
        title: config.title.trim(),
        description: config.description.trim() || null,
        trainingId: selectedPre.trainingId,
        type: "POST_TEST",
        pairedAssessmentId: selectedPre.id,
        topicId: config.topicId !== "all" ? Number(config.topicId) : undefined,
        difficulty: config.difficulty === "any" ? undefined : config.difficulty,
        count: config.count,
      });
      return generated;
    },
    onSuccess: (generated) => {
      queryClient.invalidateQueries({ queryKey: qk.assessments.all });
      setGeneratedAssessment(generated);
      setGeneratedSignature(generationSignature);
      setActionError(null);
      toast.success(`Generated “${generated.title}” as a draft`, {
        description: "Review the draft and publish it only if you want it live immediately.",
      });
    },
    onError: (error) => {
      const message = errText(error);
      setActionError(message);
      toast.error(message);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (assessmentId: number | string) =>
      assessmentsService.updateStatus(assessmentId, "PUBLISHED"),
    onSuccess: (publishedAssessment) => {
      queryClient.invalidateQueries({ queryKey: qk.assessments.all });
      setActionError(null);
      toast.success("Post-test published");
      navigate({
        to: "/app/assessments/$id",
        params: { id: String(publishedAssessment.id) },
        search: { published: 1 } as never,
      });
    },
    onError: (error) => {
      const message = errText(error);
      setActionError(message);
      toast.error(message);
    },
  });

  const back = () => setStep((current) => Math.max(1, current - 1));
  const next = () => setStep((current) => Math.min(5, current + 1));

  const ensureDraft = async () => {
    const validationError = validatePostTestConfig({
      pre: selectedPre,
      count: config.count,
      title: config.title,
    });
    if (validationError) {
      setActionError(validationError);
      toast.error(validationError);
      throw new Error(validationError);
    }

    setActionError(null);
    if (
      generatedAssessment &&
      generatedSignature === generationSignature &&
      generatedAssessment.status === "DRAFT"
    ) {
      return generatedAssessment;
    }
    return generateMutation.mutateAsync();
  };

  const saveDraft = async () => {
    try {
      const draft = await ensureDraft();
      navigate({
        to: "/app/assessments/$id",
        params: { id: String(draft.id) },
      });
    } catch {
      // Handled by mutation / validation UI.
    }
  };

  const publish = async () => {
    try {
      const draft = await ensureDraft();
      await publishMutation.mutateAsync(draft.id);
    } catch {
      // Handled by mutation / validation UI.
    }
  };

  if (loading) {
    return <LoadingState label="Loading post-test builder…" />;
  }

  if (dataError) {
    const message = errText(dataError);
    if (/not found/i.test(message)) {
      return (
        <div className="p-8">
          <EmptyState
            title="Assessment not found"
            description="The related assessment could not be loaded."
          />
        </div>
      );
    }
    return (
      <ErrorState
        message={message}
        onRetry={() => {
          relatedAssessmentQuery.refetch();
          assessmentsQuery.refetch();
          topicsQuery.refetch();
          questionsQuery.refetch();
        }}
      />
    );
  }

  if (preTests.length === 0 || !selectedPre) {
    return (
      <div className="p-8">
        <EmptyState
          title="No pre-tests available"
          description="Create at least one pre-test before generating a related post-test."
        />
      </div>
    );
  }

  const generatedQuestions = (generatedAssessment?.questions ?? [])
    .map((item) => questionById.get(item.questionId) ?? item.question)
    .filter((question): question is Question => Boolean(question));
  const comparabilityChecks = [
    { ok: generatedAssessment !== null, label: "Draft generated from approved same-training questions" },
    { ok: config.count > 0, label: "Question count defined" },
    {
      ok: preQuestionsMissingEquivalenceVariant.every(
        (question) => reviewed[String(question.id)] === "approved",
      ),
      label: "Missing variants reviewed",
    },
    { ok: true, label: "Publish remains a separate explicit step" },
  ];
  const actionPending = generateMutation.isPending || publishMutation.isPending;

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to="/app/assessments" className="hover:underline">
            Assessments
          </Link>
        }
        title="Create post-test"
        description="Post-tests measure the same knowledge using approved same-training questions and comparable focus."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/assessments" })}>
              <X className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={saveDraft} disabled={actionPending}>
              <Save className="mr-1.5 h-4 w-4" /> {generateMutation.isPending ? "Saving…" : "Save as draft"}
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Stepper step={step} />

        <div className="mt-6 max-w-4xl space-y-4">
          {actionError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {actionError}
            </div>
          )}

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Choose related pre-test</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {preTests.map((assessment) => (
                  <label
                    key={assessment.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border bg-card p-4",
                      String(assessment.id) === selectedPreId && "border-primary bg-primary-soft/50",
                    )}
                  >
                    <input
                      type="radio"
                      checked={String(assessment.id) === selectedPreId}
                      onChange={() => setSelectedPreId(String(assessment.id))}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{assessment.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {assessment.training?.title ?? "No training"}
                          </div>
                        </div>
                        <StatusBadge status={STATUS_LABEL[assessment.status]} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Date: {formatDate(assessment.createdAt)}</span>
                        <span>Questions: {assessment.questions?.length ?? 0}</span>
                        <span>Type: Pre-test</span>
                      </div>
                    </div>
                  </label>
                ))}
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reuse the same blueprint</CardTitle>
                <CardDescription>
                  Same training scope as <strong>{selectedPre.title}</strong>, with optional focus
                  filters for generation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <BlueprintCard
                    title="Topics"
                    lines={trainingTopics.slice(0, 3).map((topic) => topic.name)}
                  />
                  <BlueprintCard
                    title="Difficulty"
                    lines={summarizeDifficulty(preQuestions)}
                  />
                  <BlueprintCard
                    title="Question count"
                    lines={[`${config.count} questions requested`]}
                  />
                  <BlueprintCard
                    title="Scope"
                    lines={[selectedPre.training?.title ?? "Same training"]}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Generated title">
                    <Input
                      value={config.title}
                      onChange={(event) =>
                        setConfig((current) => ({ ...current, title: event.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Question count">
                    <Input
                      type="number"
                      min={1}
                      value={config.count}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          count: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Topic focus">
                    <Select
                      value={config.topicId}
                      onValueChange={(value) =>
                        setConfig((current) => ({
                          ...current,
                          topicId: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All topics</SelectItem>
                        {trainingTopics.map((topic) => (
                          <SelectItem key={topic.id} value={String(topic.id)}>
                            {topic.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Difficulty focus">
                    <Select
                      value={config.difficulty}
                      onValueChange={(value) =>
                        setConfig((current) => ({
                          ...current,
                          difficulty: value as typeof current.difficulty,
                        }))
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
                  <Field label="Description">
                    <Input
                      value={config.description}
                      onChange={(event) =>
                        setConfig((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prefer equivalent variants</CardTitle>
                <CardDescription>
                  Existing equivalent groups are preferred when available. Missing ones stay
                  advisory until you generate a draft.
                </CardDescription>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Original question</TableHead>
                      <TableHead>Equivalent variant</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preQuestions.map((question) => {
                      const candidate = equivalentVariantByPreQuestionId.get(question.id) ?? null;
                      return (
                        <TableRow key={question.id}>
                          <TableCell className="max-w-xs">
                            <span className="line-clamp-2 text-sm font-medium">{question.title}</span>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {question.topic?.name ?? "—"} · {difficultyLabel(question.difficulty)}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {candidate ? (
                              <>
                                <span className="line-clamp-2 text-sm">{candidate.title}</span>
                                <div className="mt-1">
                                  <StatusBadge status="Approved" />
                                </div>
                              </>
                            ) : (
                              <StatusBadge status="Needs Review" tone="warning" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {candidate ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setReviewed((current) => ({
                                    ...current,
                                    [String(question.id)]: "approved",
                                  }))
                                }
                              >
                                Use variant
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setReviewed((current) => ({
                                    ...current,
                                    [String(question.id)]: "later",
                                  }))
                                }
                              >
                                Mark for AI
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <AIPanel
                modelId={modelId}
                setModelId={setModelId}
                onGenerate={() => {
                  void ensureDraft();
                }}
                pending={generateMutation.isPending}
              />

              {generatedAssessment ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Generated draft</CardTitle>
                    <CardDescription>
                      This is still a draft. Publishing remains a separate explicit step.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-md border bg-card p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{generatedAssessment.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {generatedAssessment.training?.title ?? selectedPre.training?.title ?? "—"} ·{" "}
                            {generatedQuestions.length} generated questions
                          </div>
                        </div>
                        <StatusBadge status={STATUS_LABEL[generatedAssessment.status]} />
                      </div>
                      <div className="mt-3 space-y-2">
                        {generatedQuestions.slice(0, 5).map((question) => (
                          <div key={question.id} className="rounded-md border bg-surface p-3">
                            <div className="text-sm font-medium">{question.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {question.topic?.name ?? "—"} · {difficultyLabel(question.difficulty)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {preQuestionsMissingEquivalenceVariant.length > 0 && (
                      <div className="space-y-3">
                        {preQuestionsMissingEquivalenceVariant.map((question) => (
                          <div key={question.id} className="rounded-md border bg-card">
                            <div className="grid gap-4 p-4 md:grid-cols-2">
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  Original
                                </div>
                                <div className="mt-1 text-sm font-medium">{question.title}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {question.topic?.name ?? "—"} · {difficultyLabel(question.difficulty)}
                                </div>
                              </div>
                              <div className="rounded-md border-l-2 border-primary bg-primary-soft/40 p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase tracking-wide text-accent-foreground">
                                    Generated draft (advisory)
                                  </span>
                                  <StatusBadge status="AI generated" tone="primary" />
                                </div>
                                <div className="mt-1 text-sm font-medium">
                                  Review on the draft detail page before publishing.
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-surface px-4 py-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setReviewed((current) => ({
                                    ...current,
                                    [String(question.id)]: "rejected",
                                  }))
                                }
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setReviewed((current) => ({
                                    ...current,
                                    [String(question.id)]: "later",
                                  }))
                                }
                              >
                                Mark for later
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  setReviewed((current) => ({
                                    ...current,
                                    [String(question.id)]: "approved",
                                  }))
                                }
                              >
                                {reviewed[String(question.id)] === "approved" ? (
                                  <>
                                    <Check className="mr-1.5 h-4 w-4" /> Approved
                                  </>
                                ) : (
                                  "Approve as advisory"
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Generate a draft post-test from the selected approved same-training question
                    pool. It stays unpublished until you explicitly publish it.
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {step === 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review & publish</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <Row label="Related pre-test" value={selectedPre.title} />
                  <Row label="Blueprint" value="Reused with generation filters" />
                  <Row label="Questions" value={`${config.count} requested`} />
                  <Row label="Draft status" value={generatedAssessment ? STATUS_LABEL[generatedAssessment.status] : "Not generated yet"} />
                </div>
                <div className="rounded-md border bg-surface p-3 text-sm">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Comparability checklist
                  </div>
                  <ul className="space-y-1.5">
                    {comparabilityChecks.map((check) => (
                      <li key={check.label} className="flex items-center gap-2">
                        {check.ok ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        )}
                        <span>{check.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col-reverse items-stretch justify-between gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={back} disabled={step === 1}>
              <ChevronLeft className="mr-1.5 h-4 w-4" /> Back
            </Button>
            {step < 5 ? (
              <Button onClick={next}>
                Continue <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => void publish()} disabled={actionPending}>
                {publishMutation.isPending ? "Publishing…" : "Publish post-test"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
      {STEPS.map((item, index) => {
        const status = item.id < step ? "done" : item.id === step ? "active" : "pending";
        return (
          <li key={item.id} className="flex items-center gap-2 sm:flex-1">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                status === "done" && "border-primary bg-primary text-primary-foreground",
                status === "active" && "border-primary text-primary",
                status === "pending" && "border-border text-muted-foreground",
              )}
            >
              {status === "done" ? <Check className="h-3.5 w-3.5" /> : item.id}
            </span>
            <span
              className={cn(
                "text-xs font-medium sm:text-sm",
                status === "pending" && "text-muted-foreground",
              )}
            >
              {item.title}
            </span>
            {index < STEPS.length - 1 && <span className="hidden flex-1 border-t border-dashed sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

function BlueprintCard({ title, lines }: { title: string; lines: string[] }) {
  const displayLines = lines.length > 0 ? lines : ["—"];
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="mt-1 space-y-0.5 text-sm">
        {displayLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function AIPanel({
  modelId,
  setModelId,
  onGenerate,
  pending,
}: {
  modelId: string;
  setModelId: (value: string) => void;
  onGenerate: () => void;
  pending: boolean;
}) {
  const model = AI_MODEL_OPTIONS.find((item) => item.id === modelId);
  return (
    <Card className="border-primary/30 bg-primary-soft/30">
      <CardHeader>
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-accent-foreground" />
          <div>
            <CardTitle className="text-base">AI assistant — generate comparable draft</CardTitle>
            <CardDescription>
              Generation is advisory and creates only a draft until you explicitly publish it.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[260px_1fr]">
          <div>
            <label className="text-xs font-medium">Model</label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODEL_OPTIONS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.displayName} — {item.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {model && (
            <div className="flex flex-wrap items-center gap-1.5 self-end">
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
              <StatusBadge status={model.quality} tone="info" />
              <StatusBadge status={model.speed} tone="muted" />
              {model.defaultFor.length > 0 && (
                <StatusBadge status={`Recommended: ${model.defaultFor[0]}`} tone="primary" />
              )}
            </div>
          )}
        </div>
        {model && (
          <div className="text-xs text-muted-foreground">
            {model.location === "local"
              ? "Draft generation stays on local infrastructure."
              : "Cloud model selected — keep participant data out of prompts."}
          </div>
        )}
        <Button onClick={onGenerate} disabled={pending}>
          <Sparkles className="mr-1.5 h-4 w-4" />{" "}
          {pending ? "Generating draft…" : "Generate draft variants with AI"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function summarizeDifficulty(questions: Question[]) {
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const question of questions) {
    if (question.difficulty === 1) counts.easy += 1;
    else if (question.difficulty === 2) counts.medium += 1;
    else if (question.difficulty === 3) counts.hard += 1;
  }
  return [
    `Easy ${counts.easy}`,
    `Medium ${counts.medium}`,
    `Hard ${counts.hard}`,
  ];
}

function difficultyLabel(value?: number) {
  if (value === 1) return "Easy";
  if (value === 2) return "Medium";
  if (value === 3) return "Hard";
  return value ? String(value) : "—";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function resolvePostTestTitle(title: string) {
  if (/pre-test/i.test(title)) {
    return title.replace(/pre-test/i, "Post-test");
  }
  return `${title} — Post-test`;
}

function validatePostTestConfig({
  pre,
  count,
  title,
}: {
  pre: Assessment | null;
  count: number;
  title: string;
}) {
  if (!pre) return "Choose a related pre-test first";
  if (!title.trim()) return "Generated title is required";
  if (!Number.isInteger(count) || count < 1) return "Question count must be at least 1";
  return null;
}

function buildGenerationSignature({
  preId,
  title,
  description,
  topicId,
  difficulty,
  count,
}: {
  preId: number;
  title: string;
  description: string;
  topicId: string;
  difficulty: string;
  count: number;
}) {
  return JSON.stringify({
    preId,
    title: title.trim(),
    description: description.trim(),
    topicId,
    difficulty,
    count,
  });
}

function errText(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}
