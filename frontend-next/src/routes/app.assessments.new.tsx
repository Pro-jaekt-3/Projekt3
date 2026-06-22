import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { TRAININGS, QUESTIONS, PARTICIPANTS, TOPICS, getTraining } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

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
  { id: 5, title: "Preview & Publish" },
];

function CreateAssessmentWizard() {
  const navigate = useNavigate();
  const { trainingId } = useSearch({ from: "/app/assessments/new" });
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    title: "Databases — Pre-test (new)",
    description:
      "Diagnostic pre-test to map prior knowledge of SQL basics, joins and normalization.",
    type: "Pre-test",
    trainingId: trainingId ?? "tr-db",
    timeLimit: 30,
    availability: "1 week",
    randomizeQuestions: true,
    randomizeAnswers: false,
    topicIds: ["t-sql", "t-joins", "t-norm"] as string[],
    difficulty: { easy: 40, medium: 40, hard: 20 },
    questionCount: 8,
    selectedQuestionIds: ["q1", "q2", "q3", "q4", "q5"] as string[],
    assignTo: "training" as "training" | "selected",
    selectedParticipantIds: PARTICIPANTS.map((p) => p.id),
    accessMode: "assigned" as "assigned" | "link",
    dueDate: "2026-11-08",
    attemptLimit: 1,
  });

  const training = getTraining(form.trainingId);
  const trainingQuestions = QUESTIONS.filter((q) => q.training === training?.title);
  const selectedQuestions = trainingQuestions.filter((q) =>
    form.selectedQuestionIds.includes(q.id),
  );

  const back = () => setStep((s) => Math.max(1, s - 1));
  const next = () => setStep((s) => Math.min(5, s + 1));

  const publish = () => {
    toast.success("Assessment published", {
      description: "Open the access panel to share the QR code or link.",
    });
    navigate({
      to: "/app/assessments/$id",
      params: { id: "a4" },
      search: { published: 1 } as never,
    });
  };

  const saveDraft = () => {
    toast("Saved as draft");
    navigate({ to: "/app/assessments" });
  };

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
            <Button variant="outline" size="sm" onClick={saveDraft}>
              <Save className="mr-1.5 h-4 w-4" /> Save as draft
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Stepper step={step} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            {step === 1 && <Step1 form={form} setForm={setForm} />}
            {step === 2 && <Step2 form={form} setForm={setForm} />}
            {step === 3 && (
              <Step3
                form={form}
                setForm={setForm}
                questions={trainingQuestions}
                selected={selectedQuestions}
              />
            )}
            {step === 4 && <Step4 form={form} setForm={setForm} />}
            {step === 5 && (
              <Step5 form={form} training={training?.title} selected={selectedQuestions} />
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
                <Button onClick={publish}>Publish assessment</Button>
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

type Form = ReturnType<typeof useState<any>>[0] extends infer _ ? any : never; // simplification

function Step1({ form, setForm }: { form: any; setForm: any }) {
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
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pre-test">Pre-test</SelectItem>
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
                {TRAININGS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
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

function Step2({ form, setForm }: { form: any; setForm: any }) {
  const toggleTopic = (id: string) => {
    setForm({
      ...form,
      topicIds: form.topicIds.includes(id)
        ? form.topicIds.filter((t: string) => t !== id)
        : [...form.topicIds, id],
    });
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
            {TOPICS.map((t) => {
              const active = form.topicIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTopic(t.id)}
                  className={cn(
                    "flex items-start gap-2 rounded-md border bg-card p-3 text-left transition-colors",
                    active ? "border-primary bg-primary-soft" : "hover:bg-muted/40",
                  )}
                >
                  <Checkbox checked={active} className="mt-0.5 pointer-events-none" />
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.objectives.length} objectives
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
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
}: {
  form: any;
  setForm: any;
  questions: any[];
  selected: any[];
}) {
  const toggle = (id: string) => {
    setForm({
      ...form,
      selectedQuestionIds: form.selectedQuestionIds.includes(id)
        ? form.selectedQuestionIds.filter((q: string) => q !== id)
        : [...form.selectedQuestionIds, id],
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Questions</CardTitle>
            <Button variant="outline" size="sm">
              <Sparkles className="mr-1.5 h-4 w-4" /> Ask AI to suggest missing drafts
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Only approved questions can be published. AI suggestions become drafts that you review.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {questions.map((q) => {
            const active = form.selectedQuestionIds.includes(q.id);
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
                  onCheckedChange={() => toggle(q.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{q.text}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{q.topic}</span>
                    <span>·</span>
                    <span>{q.objective}</span>
                    <span>·</span>
                    <span className="capitalize">{q.difficulty}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={q.status} />
                  {q.variants > 0 && (
                    <span className="text-[10px] text-muted-foreground">{q.variants} variants</span>
                  )}
                </div>
              </label>
            );
          })}
        </CardContent>
      </Card>
      <div className="rounded-md border bg-surface p-3 text-sm text-muted-foreground">
        <strong className="text-foreground">{selected.length}</strong> question
        {selected.length !== 1 ? "s" : ""} selected.
      </div>
    </div>
  );
}

function Step4({ form, setForm }: { form: any; setForm: any }) {
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

function Step5({ form, training, selected }: { form: any; training?: string; selected: any[] }) {
  const checks = [
    { ok: selected.every((q: any) => q.status === "Approved"), label: "All questions approved" },
    { ok: form.assignTo, label: "Participants assigned" },
    { ok: !!form.dueDate, label: "Availability set" },
    { ok: !!form.description, label: "Instructions added" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview & publish</CardTitle>
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
