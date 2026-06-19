import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Shield, Cloud, Wand2, Plus, ChevronDown, Save, ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/common/StatusBadge";
import { QUESTIONS, AI_MODELS, TRAININGS, TOPICS, getQuestion } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/questions/$id")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: QuestionEditor,
});

function QuestionEditor() {
  const { id } = Route.useParams();
  const existing = getQuestion(id);
  const [form, setForm] = useState({
    text: existing?.text ?? "",
    type: existing?.type ?? "single",
    topicId: existing?.topicId ?? "t-sql",
    objective: existing?.objective ?? "Write basic SELECT queries",
    difficulty: existing?.difficulty ?? "medium",
    status: existing?.status ?? "Draft",
    explanation: existing?.explanation ?? "",
    options: existing?.options ?? [
      { id: "a", text: "", correct: false },
      { id: "b", text: "", correct: false },
      { id: "c", text: "", correct: false },
      { id: "d", text: "", correct: false },
    ],
    training: existing?.training ?? "Introduction to Databases",
  });

  return (
    <>
      <PageHeader
        breadcrumbs={<Link to="/app/questions" className="hover:underline">Question bank</Link>}
        title={existing ? "Edit question" : "Create question"}
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/questions"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast("Saved as draft")}>
              <Save className="mr-1.5 h-4 w-4" /> Save as draft
            </Button>
            <Button size="sm" onClick={() => toast.success("Marked as Needs Review")}>
              Save & request review
            </Button>
          </>
        }
      />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_320px] lg:p-8">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Question</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Question text</Label>
                <Textarea rows={3} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Enter the question..." />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single choice</SelectItem>
                      <SelectItem value="multiple">Multiple choice</SelectItem>
                      <SelectItem value="true_false">True / false</SelectItem>
                      <SelectItem value="short">Short answer</SelectItem>
                      <SelectItem value="open">Open question</SelectItem>
                      <SelectItem value="code">Code / programming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(form.type === "single" || form.type === "multiple") && (
                <div className="space-y-2">
                  <Label>Answer options</Label>
                  {form.options.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        type={form.type === "single" ? "radio" : "checkbox"}
                        checked={opt.correct}
                        onChange={() => {
                          const next = form.options.map((o, j) =>
                            form.type === "single"
                              ? { ...o, correct: j === i }
                              : j === i
                              ? { ...o, correct: !o.correct }
                              : o,
                          );
                          setForm({ ...form, options: next });
                        }}
                      />
                      <Input
                        value={opt.text}
                        onChange={(e) => {
                          const next = [...form.options];
                          next[i] = { ...next[i], text: e.target.value };
                          setForm({ ...form, options: next });
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      />
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, options: [...form.options, { id: String.fromCharCode(97 + form.options.length), text: "", correct: false }] })}>
                    <Plus className="mr-1.5 h-4 w-4" /> Add option
                  </Button>
                </div>
              )}

              {form.type === "true_false" && (
                <div className="space-y-2">
                  <Label>Correct answer</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">True</Button>
                    <Button variant="outline" size="sm">False</Button>
                  </div>
                </div>
              )}

              {(form.type === "short" || form.type === "open" || form.type === "code") && (
                <div className="space-y-1.5">
                  <Label>{form.type === "code" ? "Expected output / rubric" : "Expected answer / grading note"}</Label>
                  <Textarea rows={3} placeholder="Grading guidance..." />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Explanation (shown after submission)</Label>
                <Textarea rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Equivalent variants</CardTitle>
              <CardDescription>
                Variants test the same learning objective at the same difficulty, but must not be identical.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(existing?.variants ?? 0) > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: existing!.variants }).map((_, i) => (
                    <div key={i} className="rounded-md border bg-card p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Variant {i + 1}</span>
                        <StatusBadge status="Approved" />
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm">
                        {existing!.text.replace(/^Which/, "Identify which").replace(/SQL/, "relational")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed bg-surface p-4 text-sm text-muted-foreground">
                  No variants yet. Variants are used in post-tests to measure the same knowledge without repeating identical questions.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm"><Plus className="mr-1.5 h-4 w-4" /> Add manual variant</Button>
                <Button size="sm"><Sparkles className="mr-1.5 h-4 w-4" /> Generate variant with AI</Button>
                <Button variant="ghost" size="sm">Compare variants</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar: metadata + AI assistant */}
        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Needs Review">Needs Review</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Training</Label>
                <Select value={form.training} onValueChange={(v) => setForm({ ...form, training: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRAININGS.map((t) => <SelectItem key={t.id} value={t.title}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Topic</Label>
                <Select value={form.topicId} onValueChange={(v) => setForm({ ...form, topicId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TOPICS.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Learning objective</Label>
                <Input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
              </div>
            </CardContent>
          </Card>

          <AIAssistantPanel />
        </aside>
      </div>
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
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {enabled.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {model && (
            <div className="flex flex-wrap gap-1 pt-1">
              <StatusBadge
                status={model.location === "local" ? "Local" : "Cloud"}
                tone={model.location === "local" ? "success" : "warning"}
                icon={model.location === "local" ? <Shield className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
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
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => generate("draft")}>
            <Wand2 className="mr-1.5 h-4 w-4" /> Generate question draft
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => generate("improve")}>
            <Wand2 className="mr-1.5 h-4 w-4" /> Improve wording
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => generate("options")}>
            <Wand2 className="mr-1.5 h-4 w-4" /> Generate answer options
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => generate("explain")}>
            <Wand2 className="mr-1.5 h-4 w-4" /> Generate explanation
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => generate("variant")}>
            <Wand2 className="mr-1.5 h-4 w-4" /> Generate equivalent variant
          </Button>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
              Advanced settings <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Temperature (creativity)</Label>
              <Input type="number" step="0.1" defaultValue="0.4" className="h-8" />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {busy && <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground">Thinking…</div>}

        {suggestion && (
          <div className="rounded-md border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">AI suggestion</div>
            <p className="mt-1 text-sm">{suggestion}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={() => { toast("Inserted into draft"); setSuggestion(null); }}>
                <Check className="mr-1 h-3.5 w-3.5" /> Insert
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toast("Saved as Needs Review")}>Save as Needs Review</Button>
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
