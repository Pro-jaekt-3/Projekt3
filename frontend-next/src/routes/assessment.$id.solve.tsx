import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Send,
  Check,
} from "lucide-react";
import { toast } from "sonner";
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
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { getAttemptId, rememberAttemptId } from "@/lib/attempt-storage";
import { qk } from "@/lib/query-keys";
import { sanitizeQuestionForSolving, type SolvingQuestion } from "@/lib/sanitize";
import { cn, errText } from "@/lib/utils";
import {
  assessmentAttemptsService,
  type SubmitAssessmentAttemptAnswerInput,
} from "@/services/assessmentAttempts";
import type { AssessmentAttempt } from "@/types";

export const Route = createFileRoute("/assessment/$id/solve")({
  component: SolvePage,
});

type AnswerValue = string | number | number[] | null;

type SolvingItem = {
  id: number;
  questionId: number;
  orderIndex: number;
  points: number;
  question: SolvingQuestion;
};

function SolvePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const rememberedAttemptId = getAttemptId(id);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [navOpen, setNavOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const autoSubmittedRef = useRef(false);

  const attemptQuery = useQuery({
    queryKey: qk.assessmentAttempts.detail(rememberedAttemptId ?? `missing-${id}`),
    queryFn: () => assessmentAttemptsService.get(rememberedAttemptId!),
    enabled: rememberedAttemptId !== null,
    retry: false,
  });

  useEffect(() => {
    const attempt = attemptQuery.data;
    if (!attempt?.answers || attempt.answers.length === 0) return;
    setAnswers(buildInitialAnswers(attempt));
  }, [attemptQuery.data?.id]);

  const submitMutation = useMutation({
    mutationFn: (attemptId: number) =>
      assessmentAttemptsService.submit(attemptId, {
        answers: buildSubmitAnswers(solvingItems(attemptQuery.data), answers),
      }),
    onSuccess: (attempt) => {
      rememberAttemptId(id, attempt.id);
      setSubmitError(null);
      toast.success("Assessment submitted");
      navigate({
        to: "/assessment/$id/result",
        params: { id: String(id) },
      });
    },
    onError: (error) => {
      const message = errText(error);
      setSubmitError(message);
      if (/already been submitted/i.test(message)) {
        toast.error("This attempt was already submitted.");
        navigate({
          to: "/assessment/$id/result",
          params: { id: String(id) },
        });
        return;
      }
      toast.error(message);
    },
  });

  useEffect(() => {
    const attemptData = attemptQuery.data;
    const timeLimitMinutes = attemptData?.assessment?.timeLimitMinutes;
    const baseSeconds = timeLimitMinutes ? timeLimitMinutes * 60 : 0;

    if (baseSeconds <= 0 || !attemptData || attemptData.status !== "IN_PROGRESS") {
      return;
    }

    const startedAtMs = new Date(attemptData.startedAt).getTime();

    const interval = setInterval(() => {
      setNow(Date.now());

      const elapsed = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
      const remaining = Math.max(0, baseSeconds - elapsed);

      if (remaining <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        toast.error("Čas je potekel — test je bil samodejno oddan.");
        submitMutation.mutate(attemptData.id);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    attemptQuery.data?.id,
    attemptQuery.data?.status,
    attemptQuery.data?.startedAt,
    attemptQuery.data?.assessment?.timeLimitMinutes,
  ]);

  if (rememberedAttemptId === null) {
    return (
      <SolveShell>
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <h1 className="text-xl font-semibold">No active attempt found</h1>
            <p className="text-sm text-muted-foreground">
              Open the assessment access page first so we can start or resume your attempt safely.
            </p>
            <Button asChild variant="outline">
              <Link to="/assessment/$id/access" params={{ id: String(id) }}>
                Back to access
              </Link>
            </Button>
          </CardContent>
        </Card>
      </SolveShell>
    );
  }

  if (attemptQuery.isLoading) {
    return <LoadingState label="Loading your attempt…" />;
  }

  if (attemptQuery.isError || !attemptQuery.data) {
    const message = errText(attemptQuery.error);
    const accessDenied = /forbidden|not available/i.test(message);
    return (
      <SolveShell>
        {accessDenied ? (
          <Card>
            <CardContent className="space-y-3 p-8 text-center">
              <h1 className="text-xl font-semibold">Access denied</h1>
              <p className="text-sm text-muted-foreground">
                This attempt is no longer available to open.
              </p>
              <Button asChild variant="outline">
                <Link to="/assessment/$id/access" params={{ id: String(id) }}>
                  Return to access
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ErrorState message={message} onRetry={() => attemptQuery.refetch()} />
        )}
      </SolveShell>
    );
  }

  const attempt = attemptQuery.data;
  if (attempt.status !== "IN_PROGRESS") {
    return (
      <SolveShell>
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            <StatusBadge status="Completed" />
            <h1 className="text-xl font-semibold">This attempt is already submitted</h1>
            <p className="text-sm text-muted-foreground">
              Submitted attempts are read-only. Open your result view instead of editing answers.
            </p>
            <Button
              onClick={() =>
                navigate({
                  to: "/assessment/$id/result",
                  params: { id: String(id) },
                })
              }
            >
              View result
            </Button>
          </CardContent>
        </Card>
      </SolveShell>
    );
  }

  const items = solvingItems(attempt);
  if (items.length === 0) {
    return (
      <SolveShell>
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <h1 className="text-xl font-semibold">No questions available</h1>
            <p className="text-sm text-muted-foreground">
              This attempt does not currently have any question content to solve.
            </p>
            <Button asChild variant="outline">
              <Link to="/assessment/$id/access" params={{ id: String(id) }}>
                Return to access
              </Link>
            </Button>
          </CardContent>
        </Card>
      </SolveShell>
    );
  }
  const questionCount = items.length;
  const current = items[idx];
  const assessment = attempt.assessment;
  const secondsElapsed = Math.max(
    0,
    Math.floor((now - new Date(attempt.startedAt).getTime()) / 1000),
  );
  const baseSeconds = assessment?.timeLimitMinutes ? assessment.timeLimitMinutes * 60 : 0;
  const seconds =
    baseSeconds > 0 ? Math.max(0, baseSeconds - secondsElapsed) : 0;
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  const answered = (i: number) => {
    const item = items[i];
    const value = answers[item.questionId];
    if (item.question.type === "MULTIPLE_CHOICE") {
      return typeof value === "number";
    }
    return typeof value === "string" && value.trim().length > 0;
  };
  const unansweredCount = items.filter((_, index) => !answered(index)).length;
  const progress = questionCount > 0 ? ((idx + 1) / questionCount) * 100 : 0;

  const setAnswer = (value: AnswerValue) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [current.questionId]: value,
    }));
  };

  const toggleMark = () => {
    setMarked((currentMarked) => {
      const next = new Set(currentMarked);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const submit = () => {
    if (submitMutation.isPending) return;
    setSubmitError(null);
    submitMutation.mutate(attempt.id);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface">
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-muted-foreground">
              {assessment?.training?.title ?? "Assessment"}
            </div>
            <div className="truncate text-sm font-semibold">{assessment?.title ?? "Assessment"}</div>
          </div>
          {baseSeconds > 0 && (
            <div className="flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-sm tabular-nums">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className={cn("font-semibold", seconds < 60 && "text-rose-600")}>
                {mm}:{ss}
              </span>
            </div>
          )}
        </div>
        <div className="h-1 w-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-6 px-3 py-4 sm:px-6 sm:py-6 lg:gap-8">
        <main className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Question {idx + 1} of {questionCount}
            </span>
            <button
              onClick={toggleMark}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1",
                marked.has(idx) ? "border-amber-400 bg-amber-50 text-amber-800" : "hover:bg-muted",
              )}
              disabled={submitMutation.isPending}
            >
              <Flag className="h-3.5 w-3.5" />{" "}
              {marked.has(idx) ? "Marked for review" : "Mark for review"}
            </button>
          </div>

          <Card>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <h2 className="text-base font-semibold sm:text-lg">{current.question.title}</h2>
              {current.question.description && (
                <p className="text-sm text-muted-foreground">{current.question.description}</p>
              )}

              {current.question.type === "MULTIPLE_CHOICE" && current.question.answerOptions && (
                <div className="space-y-2">
                  {current.question.answerOptions.map((option) => {
                    const selected = answers[current.questionId] === option.id;
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          "flex min-h-[52px] cursor-pointer items-start gap-3 rounded-md border bg-card p-4 transition-colors",
                          selected ? "border-primary bg-primary-soft/60" : "hover:bg-muted/50",
                        )}
                      >
                        <input
                          type="radio"
                          checked={selected}
                          onChange={() => setAnswer(option.id)}
                          className="mt-1"
                          disabled={submitMutation.isPending}
                        />
                        <span className="flex-1 text-sm">{option.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {(current.question.type === "OPEN" || current.question.type === "CODE") && (
                <textarea
                  className={cn(
                    "min-h-32 w-full rounded-md border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary",
                    current.question.type === "CODE" && "font-mono",
                  )}
                  placeholder={
                    current.question.type === "CODE" ? "Write your code answer…" : "Type your answer…"
                  }
                  value={(answers[current.questionId] as string) ?? ""}
                  onChange={(event) => setAnswer(event.target.value)}
                  disabled={submitMutation.isPending}
                />
              )}

              {submitError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {submitError}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="sticky bottom-0 mt-4 -mx-3 border-t bg-background px-3 py-3 sm:-mx-6 sm:px-6">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setIdx((currentIdx) => Math.max(0, currentIdx - 1))}
                disabled={idx === 0 || submitMutation.isPending}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Previous</span>
              </Button>
              <Button
                variant="outline"
                className="lg:hidden"
                onClick={() => setNavOpen(true)}
                disabled={submitMutation.isPending}
              >
                <ListChecks className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Navigator</span>
              </Button>
              <div className="flex-1" />
              {idx === questionCount - 1 ? (
                <Button onClick={() => setConfirmOpen(true)} disabled={submitMutation.isPending}>
                  <Send className="mr-1.5 h-4 w-4" />
                  {submitMutation.isPending ? "Submitting…" : "Submit"}
                </Button>
              ) : (
                <Button
                  onClick={() => setIdx((currentIdx) => Math.min(questionCount - 1, currentIdx + 1))}
                  disabled={submitMutation.isPending}
                >
                  <span className="mr-1 hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </main>

        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20 rounded-md border bg-card p-3">
            <Navigator
              questions={items}
              idx={idx}
              setIdx={setIdx}
              answers={answers}
              marked={marked}
            />
            <Button className="mt-3 w-full" onClick={() => setConfirmOpen(true)} disabled={submitMutation.isPending}>
              <Send className="mr-1.5 h-4 w-4" /> Submit
            </Button>
          </div>
        </aside>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="bottom" className="h-[70vh]">
          <SheetHeader>
            <SheetTitle>Question navigator</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <Navigator
              questions={items}
              idx={idx}
              setIdx={(nextIdx) => {
                setIdx(nextIdx);
                setNavOpen(false);
              }}
              answers={answers}
              marked={marked}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Stat label="Answered" value={questionCount - unansweredCount} />
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
            <AlertDialogCancel disabled={submitMutation.isPending}>Continue solving</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                submit();
              }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting…" : "Submit assessment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SolveShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-surface p-4 sm:p-6">{children}</div>;
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
  questions: SolvingItem[];
  idx: number;
  setIdx: (index: number) => void;
  answers: Record<number, AnswerValue>;
  marked: Set<number>;
}) {
  return (
    <>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Questions
      </div>
      <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
        {questions.map((item, index) => {
          const current = index === idx;
          const answered =
            typeof answers[item.questionId] === "number" ||
            (typeof answers[item.questionId] === "string" &&
              String(answers[item.questionId]).trim().length > 0);
          const isMarked = marked.has(index);
          return (
            <button
              key={item.questionId}
              onClick={() => setIdx(index)}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-colors",
                current && "border-primary bg-primary text-primary-foreground",
                !current && answered && "border-emerald-200 bg-emerald-50 text-emerald-800",
                !current && !answered && "border-border bg-card hover:bg-muted",
              )}
            >
              {index + 1}
              {isMarked && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function solvingItems(attempt: AssessmentAttempt | undefined): SolvingItem[] {
  const rawItems = attempt?.assessment?.questions ?? [];
  return rawItems
    .map((item) => {
      if (!item.question) return null;
      return {
        id: item.id,
        questionId: item.questionId,
        orderIndex: item.orderIndex,
        points: item.points,
        question: sanitizeQuestionForSolving(item.question),
      };
    })
    .filter((item): item is SolvingItem => Boolean(item))
    .sort((left, right) => left.orderIndex - right.orderIndex);
}

function buildInitialAnswers(attempt: AssessmentAttempt) {
  const initial: Record<number, AnswerValue> = {};
  for (const answer of attempt.answers ?? []) {
    if (typeof answer.selectedOptionId === "number") {
      initial[answer.questionId] = answer.selectedOptionId;
      continue;
    }
    initial[answer.questionId] = answer.textAnswer ?? answer.answerText ?? "";
  }
  return initial;
}

function buildSubmitAnswers(
  items: SolvingItem[],
  answers: Record<number, AnswerValue>,
): SubmitAssessmentAttemptAnswerInput[] {
  const payload: SubmitAssessmentAttemptAnswerInput[] = [];

  for (const item of items) {
    const value = answers[item.questionId];

    if (item.question.type === "MULTIPLE_CHOICE") {
      if (typeof value === "number") {
        payload.push({
          questionId: item.questionId,
          selectedOptionId: value,
        });
      }
      continue;
    }

    payload.push({
      questionId: item.questionId,
      textAnswer: typeof value === "string" ? value : "",
    });
  }

  return payload;
}
