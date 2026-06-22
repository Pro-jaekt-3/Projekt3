import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import { ASSESSMENTS, AI_MODELS, QUESTIONS, getAssessment } from "@/lib/mock-data";
import type { Assessment } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/assessments/$id/post-test")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  loader: ({ params }): { related: Assessment } => {
    const a = getAssessment(params.id) ?? ASSESSMENTS[0];
    if (!a) throw notFound();
    return { related: a };
  },
  component: PostTestWizard,
});

const STEPS = [
  { id: 1, title: "Choose pre-test" },
  { id: 2, title: "Blueprint" },
  { id: 3, title: "Equivalent variants" },
  { id: 4, title: "AI-generate missing" },
  { id: 5, title: "Review & publish" },
];

function PostTestWizard() {
  const { related } = Route.useLoaderData() as { related: Assessment };
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [pre, setPre] = useState<Assessment>(related);
  const [modelId, setModelId] = useState(AI_MODELS.filter((m) => m.enabled)[0]?.id ?? "");
  const [generated, setGenerated] = useState(false);
  const [reviewed, setReviewed] = useState<
    Record<string, "approved" | "rejected" | "later" | null>
  >({});
  const questions = QUESTIONS.filter((q) => pre.questionIds.includes(q.id));

  const back = () => setStep((s) => Math.max(1, s - 1));
  const next = () => setStep((s) => Math.min(5, s + 1));

  const publish = () => {
    toast.success("Post-test published");
    navigate({
      to: "/app/assessments/$id",
      params: { id: "a3" },
      search: { published: 1 } as never,
    });
  };

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to="/app/assessments" className="hover:underline">
            Assessments
          </Link>
        }
        title="Create post-test"
        description="Post-tests measure the same knowledge using equivalent but not identical questions."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/assessments" })}>
              <X className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
            <Button variant="outline" size="sm">
              <Save className="mr-1.5 h-4 w-4" /> Save as draft
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Stepper step={step} />

        <div className="mt-6 max-w-4xl space-y-4">
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Choose related pre-test</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ASSESSMENTS.filter((a) => a.type === "Pre-test").map((a) => (
                  <label
                    key={a.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border bg-card p-4",
                      pre.id === a.id && "border-primary bg-primary-soft/50",
                    )}
                  >
                    <input
                      type="radio"
                      checked={pre.id === a.id}
                      onChange={() => setPre(a)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{a.title}</div>
                          <div className="text-xs text-muted-foreground">{a.training}</div>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Date: {a.createdAt}</span>
                        <span>Participants: {a.assigned}</span>
                        <span>Avg: {a.avgScore ?? "—"}%</span>
                        <span className="text-amber-700">Weakest: SQL Joins (49%)</span>
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
                  Same topics, objectives and difficulty as <strong>{pre.title}</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <BlueprintCard title="Topics" lines={["SQL Basics", "Joins", "Normalization"]} />
                  <BlueprintCard
                    title="Difficulty"
                    lines={["Easy 40%", "Medium 40%", "Hard 20%"]}
                  />
                  <BlueprintCard
                    title="Question count"
                    lines={[`${pre.questionIds.length} questions`]}
                  />
                  <BlueprintCard title="Focus" lines={["Weak areas: SQL Joins"]} />
                </div>
                <label className="flex items-start gap-2 rounded-md border bg-surface p-3 text-sm">
                  <Checkbox defaultChecked className="mt-0.5" />
                  <div>
                    <div className="font-medium">Include focus on weak areas</div>
                    <div className="text-xs text-muted-foreground">
                      Slightly weight questions from SQL Joins.
                    </div>
                  </div>
                </label>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prefer equivalent variants</CardTitle>
                <CardDescription>
                  Post-tests should measure the same knowledge using equivalent but not identical
                  questions.
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
                    {questions.map((q, i) => {
                      const has = i < 3;
                      return (
                        <TableRow key={q.id}>
                          <TableCell className="max-w-xs">
                            <span className="line-clamp-2 text-sm font-medium">{q.text}</span>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {q.topic} · {q.difficulty}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {has ? (
                              <>
                                <span className="line-clamp-2 text-sm">
                                  {q.text
                                    .replace("Which", "Identify which")
                                    .replace("SQL", "relational")}
                                </span>
                                <StatusBadge status="Approved" />
                              </>
                            ) : (
                              <StatusBadge status="Needs Review" tone="warning" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {has ? (
                              <Button size="sm" variant="outline">
                                Use variant
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost">
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
                  setGenerated(true);
                  toast("Generated 2 draft variants — review required");
                }}
              />

              {generated ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Review AI-generated variants</CardTitle>
                    <CardDescription>
                      All AI variants are marked <strong>Needs Review</strong>. Approve before
                      publish.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {questions.slice(3, 5).map((q) => (
                      <div key={q.id} className="rounded-md border bg-card">
                        <div className="grid gap-4 p-4 md:grid-cols-2">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Original
                            </div>
                            <div className="mt-1 text-sm font-medium">{q.text}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {q.topic} · {q.difficulty}
                            </div>
                          </div>
                          <div className="rounded-md border-l-2 border-primary bg-primary-soft/40 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wide text-accent-foreground">
                                Equivalent variant (AI draft)
                              </span>
                              <StatusBadge status="AI generated" tone="primary" />
                            </div>
                            <div className="mt-1 text-sm font-medium">
                              {q.text
                                .replace(/^Which/, "Identify which")
                                .replace(/SQL/g, "relational")}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Same topic · Same difficulty
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-surface px-4 py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setReviewed({ ...reviewed, [q.id]: "rejected" })}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewed({ ...reviewed, [q.id]: "later" })}
                          >
                            Mark for later
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setReviewed({ ...reviewed, [q.id]: "approved" })}
                          >
                            {reviewed[q.id] === "approved" ? (
                              <>
                                <Check className="mr-1.5 h-4 w-4" /> Approved
                              </>
                            ) : (
                              "Approve as Needs Review"
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    2 questions are missing equivalent variants. Click{" "}
                    <strong>Generate draft variants with AI</strong> above.
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
                  <Row label="Related pre-test" value={pre.title} />
                  <Row label="Blueprint" value="Reused" />
                  <Row
                    label="Questions"
                    value={`${pre.questionIds.length} (equivalent variants preferred)`}
                  />
                  <Row label="Assigned to" value="Same participants as pre-test" />
                </div>
                <div className="rounded-md border bg-surface p-3 text-sm">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Comparability checklist
                  </div>
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" /> Same blueprint
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" /> Equivalent variants selected
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" /> 2 AI variants need
                      approval
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-600" /> Participants assigned
                    </li>
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
              <Button onClick={publish}>Publish post-test</Button>
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
      {STEPS.map((s, i) => {
        const status = s.id < step ? "done" : s.id === step ? "active" : "pending";
        return (
          <li key={s.id} className="flex items-center gap-2 sm:flex-1">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                status === "done" && "border-primary bg-primary text-primary-foreground",
                status === "active" && "border-primary text-primary",
                status === "pending" && "border-border text-muted-foreground",
              )}
            >
              {status === "done" ? <Check className="h-3.5 w-3.5" /> : s.id}
            </span>
            <span
              className={cn(
                "text-xs sm:text-sm font-medium",
                status === "pending" && "text-muted-foreground",
              )}
            >
              {s.title}
            </span>
            {i < STEPS.length - 1 && (
              <span className="hidden flex-1 border-t border-dashed sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function BlueprintCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="mt-1 space-y-0.5 text-sm">
        {lines.map((l) => (
          <li key={l}>{l}</li>
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
}: {
  modelId: string;
  setModelId: (v: string) => void;
  onGenerate: () => void;
}) {
  const model = AI_MODELS.find((m) => m.id === modelId);
  const enabled = AI_MODELS.filter((m) => m.enabled);
  return (
    <Card className="border-primary/30 bg-primary-soft/30">
      <CardHeader>
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-accent-foreground" />
          <div>
            <CardTitle className="text-base">AI assistant — generate equivalent variants</CardTitle>
            <CardDescription>All generated variants will be marked Needs Review.</CardDescription>
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
                {enabled.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.displayName} — {m.location}
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
              <StatusBadge status={`${model.quality}`} tone="info" />
              <StatusBadge status={`${model.speed}`} tone="muted" />
              {model.defaultFor.length > 0 && (
                <StatusBadge status={`Recommended: ${model.defaultFor[0]}`} tone="primary" />
              )}
            </div>
          )}
        </div>
        {model && (
          <div className="text-xs text-muted-foreground">
            {model.location === "local"
              ? "Data stays on local infrastructure."
              : "Cloud model — avoid sending sensitive participant data."}
          </div>
        )}
        <Button onClick={onGenerate}>
          <Sparkles className="mr-1.5 h-4 w-4" /> Generate draft variants with AI
        </Button>
      </CardContent>
    </Card>
  );
}
