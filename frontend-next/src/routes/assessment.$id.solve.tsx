import { createFileRoute, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Save,
  Flag,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Send,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { QUESTIONS, MY_ASSESSMENTS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assessment/$id/solve")({
  loader: ({ params }) => {
    const a = MY_ASSESSMENTS.find((m) => m.id === params.id);
    if (!a) throw notFound();
    return { assessment: a };
  },
  component: SolvePage,
});

function SolvePage() {
  const { assessment } = Route.useLoaderData();
  const navigate = useNavigate();
  const questions = useMemo(() => QUESTIONS.slice(0, 5), []);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [seconds, setSeconds] = useState(assessment.timeLimit * 60);

  // Timer
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // Autosave indicator
  useEffect(() => {
    const t = setTimeout(() => setSavedAt(new Date()), 300);
    return () => clearTimeout(t);
  }, [answers, marked]);

  const q = questions[idx];
  const answered = (i: number) => questions[i].id in answers;
  const unansweredCount = questions.filter((_, i) => !answered(i)).length;

  const setAnswer = (val: string | string[] | boolean) => {
    setAnswers({ ...answers, [q.id]: val });
  };
  const toggleMark = () => {
    const next = new Set(marked);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setMarked(next);
  };

  const submit = () => {
    navigate({ to: "/assessment/$id/result", params: { id: assessment.id } });
  };

  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  const progress = ((idx + 1) / questions.length) * 100;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-muted-foreground">{assessment.training}</div>
            <div className="truncate text-sm font-semibold">{assessment.title}</div>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-sm tabular-nums">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className={cn("font-semibold", seconds < 60 && "text-rose-600")}>
              {mm}:{ss}
            </span>
          </div>
          <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Save className="h-3.5 w-3.5 text-emerald-600" />
            {savedAt ? "Saved" : "Saving…"}
          </div>
        </div>
        <div className="h-1 w-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-6 px-3 py-4 sm:px-6 sm:py-6 lg:gap-8">
        {/* Main */}
        <main className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Question {idx + 1} of {questions.length}
            </span>
            <button
              onClick={toggleMark}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1",
                marked.has(idx) ? "border-amber-400 bg-amber-50 text-amber-800" : "hover:bg-muted",
              )}
            >
              <Flag className="h-3.5 w-3.5" />{" "}
              {marked.has(idx) ? "Marked for review" : "Mark for review"}
            </button>
          </div>

          <Card>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <h2 className="text-base font-semibold sm:text-lg">{q.text}</h2>

              {(q.type === "single" || q.type === "multiple") && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const cur = answers[q.id];
                    const checked =
                      q.type === "single"
                        ? cur === opt.id
                        : Array.isArray(cur) && cur.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border bg-card p-4 transition-colors min-h-[52px]",
                          checked ? "border-primary bg-primary-soft/60" : "hover:bg-muted/50",
                        )}
                      >
                        <input
                          type={q.type === "single" ? "radio" : "checkbox"}
                          checked={checked}
                          onChange={() => {
                            if (q.type === "single") setAnswer(opt.id);
                            else {
                              const arr = Array.isArray(cur) ? [...cur] : [];
                              if (arr.includes(opt.id)) setAnswer(arr.filter((x) => x !== opt.id));
                              else setAnswer([...arr, opt.id]);
                            }
                          }}
                          className="mt-1"
                        />
                        <span className="flex-1 text-sm">{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {q.type === "true_false" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {["True", "False"].map((label, i) => {
                    const val = i === 0;
                    const checked = answers[q.id] === val;
                    return (
                      <button
                        key={label}
                        onClick={() => setAnswer(val)}
                        className={cn(
                          "rounded-md border bg-card px-4 py-4 text-sm font-medium",
                          checked ? "border-primary bg-primary-soft/60" : "hover:bg-muted/50",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {(q.type === "short" || q.type === "open" || q.type === "code") && (
                <textarea
                  className="min-h-32 w-full rounded-md border bg-card p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Type your answer…"
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              )}
            </CardContent>
          </Card>

          {/* Sticky bottom nav (touch-friendly) */}
          <div className="sticky bottom-0 mt-4 -mx-3 border-t bg-background px-3 py-3 sm:-mx-6 sm:px-6">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Previous</span>
              </Button>
              <Button variant="outline" className="lg:hidden" onClick={() => setNavOpen(true)}>
                <ListChecks className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Navigator</span>
              </Button>
              <div className="flex-1" />
              {idx === questions.length - 1 ? (
                <Button onClick={() => setConfirmOpen(true)}>
                  <Send className="mr-1.5 h-4 w-4" /> Submit
                </Button>
              ) : (
                <Button onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}>
                  <span className="hidden sm:inline mr-1">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </main>

        {/* Desktop navigator */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 rounded-md border bg-card p-3">
            <Navigator
              questions={questions}
              idx={idx}
              setIdx={setIdx}
              answers={answers}
              marked={marked}
            />
            <Button className="mt-3 w-full" onClick={() => setConfirmOpen(true)}>
              <Send className="mr-1.5 h-4 w-4" /> Submit
            </Button>
          </div>
        </aside>
      </div>

      {/* Mobile navigator drawer */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="bottom" className="h-[70vh]">
          <SheetHeader>
            <SheetTitle>Question navigator</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Navigator
              questions={questions}
              idx={idx}
              setIdx={(i) => {
                setIdx(i);
                setNavOpen(false);
              }}
              answers={answers}
              marked={marked}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Submit confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Stat label="Answered" value={questions.length - unansweredCount} />
                <Stat
                  label="Unanswered"
                  value={unansweredCount}
                  tone={unansweredCount > 0 ? "warning" : "muted"}
                />
                <Stat label="Marked" value={marked.size} />
              </div>
              {unansweredCount > 0 && (
                <p className="mt-3 text-sm text-amber-700">
                  You have {unansweredCount} unanswered question{unansweredCount !== 1 ? "s" : ""}.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue solving</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>Submit assessment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "warning" | "muted";
}) {
  return (
    <div className="rounded-md border bg-card p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums",
          tone === "warning" && "text-amber-700",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Navigator({
  questions,
  idx,
  setIdx,
  answers,
  marked,
}: {
  questions: typeof QUESTIONS;
  idx: number;
  setIdx: (i: number) => void;
  answers: Record<string, any>;
  marked: Set<number>;
}) {
  return (
    <>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Questions
      </div>
      <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
        {questions.map((q, i) => {
          const isCurrent = i === idx;
          const isAnswered = q.id in answers;
          const isMarked = marked.has(i);
          return (
            <button
              key={q.id}
              onClick={() => setIdx(i)}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-colors",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                !isCurrent && isAnswered && "border-emerald-200 bg-emerald-50 text-emerald-800",
                !isCurrent && !isAnswered && "border-border bg-card hover:bg-muted",
              )}
            >
              {i + 1}
              {isMarked && (
                <span className="absolute -right-1 -top-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-amber-500 text-[8px] text-white">
                  <Flag className="h-2 w-2" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-100 ring-1 ring-emerald-200" />{" "}
          Answered
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-card ring-1 ring-border" />{" "}
          Unanswered
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded bg-amber-500" /> Marked for review
        </div>
      </div>
    </>
  );
}
