import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, Lock, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { useRole } from "@/lib/role-context";
import { getAttemptId, rememberAttemptId } from "@/lib/attempt-storage";
import { qk } from "@/lib/query-keys";
import { assessmentsService } from "@/services/assessments";
import { assessmentAttemptsService } from "@/services/assessmentAttempts";

export const Route = createFileRoute("/assessment/$id/access")({
  component: AccessPage,
});

function AccessPage() {
  const { id } = Route.useParams();
  const { isAuthenticated } = useRole();
  const navigate = useNavigate();
  const rememberedAttemptId = getAttemptId(id);
  const assessmentId = Number(id);
  const hasValidAssessmentId = Number.isInteger(assessmentId) && assessmentId > 0;

  const assessmentQuery = useQuery({
    queryKey: qk.assessments.detail(id),
    queryFn: () => assessmentsService.get(id),
    enabled: isAuthenticated && hasValidAssessmentId,
    retry: false,
  });

  const attemptQuery = useQuery({
    queryKey: qk.assessmentAttempts.detail(rememberedAttemptId ?? `missing-${id}`),
    queryFn: () => assessmentAttemptsService.get(rememberedAttemptId!),
    enabled: isAuthenticated && rememberedAttemptId !== null,
    retry: false,
  });

  const startMutation = useMutation({
    mutationFn: () => assessmentAttemptsService.start(assessmentId),
    onSuccess: (attempt) => {
      rememberAttemptId(id, attempt.id);
      navigate({
        to: "/assessment/$id/solve",
        params: { id: String(id) },
      });
    },
    onError: (error) => {
      const message = errText(error);
      if (/not available/i.test(message)) {
        toast.error("This assessment is not available.");
      } else {
        toast.error(message);
      }
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/login", search: { redirect: `/assessment/${id}/access` } });
    }
  }, [id, isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  if (!hasValidAssessmentId) {
    return (
      <AccessShell>
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold">Invalid assessment link</h1>
            <p className="text-sm text-muted-foreground">
              This assessment link is outdated or malformed. Open the assessment from your current list instead.
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link to="/app/my-assessments">Back to My assessments</Link>
            </Button>
          </CardContent>
        </Card>
      </AccessShell>
    );
  }

  if (assessmentQuery.isLoading) {
    return <LoadingState label="Loading assessment access…" />;
  }

  const assessmentError = assessmentQuery.error instanceof Error ? assessmentQuery.error.message : null;
  const isDenied = assessmentQuery.isError && assessmentError ? /not available|forbidden/i.test(assessmentError) : false;

  if (isDenied) {
    return (
      <AccessShell>
        <AccessDenied />
      </AccessShell>
    );
  }

  if (assessmentQuery.isError || !assessmentQuery.data) {
    return (
      <AccessShell>
        <ErrorState
          message={assessmentError ?? "Failed to load this assessment"}
          onRetry={() => assessmentQuery.refetch()}
        />
      </AccessShell>
    );
  }

  const assessment = assessmentQuery.data;
  const attempt = attemptQuery.data ?? null;
  const canContinue = attempt?.status === "IN_PROGRESS";
  const isSubmitted = attempt?.status === "SUBMITTED" || attempt?.status === "GRADED";

  const openAction = () => {
    if (canContinue) {
      navigate({
        to: "/assessment/$id/solve",
        params: { id: String(id) },
      });
      return;
    }
    if (isSubmitted) {
      navigate({
        to: "/assessment/$id/result",
        params: { id: String(id) },
      });
      return;
    }
    startMutation.mutate();
  };

  return (
    <AccessShell>
      <Card>
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div>
            <div className="text-xs text-muted-foreground">
              {assessment.training?.title ?? "Available assessment"}
            </div>
            <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{assessment.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={assessmentTypeLabel(assessment.type)} tone="info" />
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />{" "}
                {assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} min` : "No limit"}
              </span>
              <span>·</span>
              <span>{assessment.status === "PUBLISHED" ? "Published" : "Unavailable"}</span>
            </div>
          </div>

          <div className="rounded-md border bg-surface p-4 text-sm">
            <div className="font-medium">Instructions</div>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>
                You have {assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} minutes` : "the full session"}
                {" "}once you start.
              </li>
              <li>You can move forward and backward between questions.</li>
              <li>Your answers stay only in this session until you submit.</li>
              <li>Submission is one-time. After submit, the attempt becomes read-only.</li>
            </ul>
          </div>

          {attemptQuery.isError && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              We could not reopen your remembered attempt, so you can start a fresh one if the assessment is still available.
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={openAction}
            disabled={startMutation.isPending || attemptQuery.isLoading}
          >
            {canContinue
              ? "Continue assessment"
              : isSubmitted
                ? "View result"
                : startMutation.isPending
                  ? "Starting assessment…"
                  : attemptQuery.isLoading
                    ? "Checking attempt…"
                  : "Start assessment"}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {canContinue
              ? "Your latest in-progress attempt will reopen."
              : isSubmitted
                ? "Your latest submitted attempt is already complete."
                : "The timer starts as soon as you begin."}
          </p>
        </CardContent>
      </Card>
    </AccessShell>
  );
}

function AccessShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">PROJEKT3</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}

function AccessDenied() {
  return (
    <Card>
      <CardContent className="space-y-3 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          This assessment is not currently available to your account.
        </p>
        <p className="text-xs text-muted-foreground">
          It may be unpublished, closed, or no longer assigned to you.
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link to="/app/my-assessments">Back to My assessments</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function assessmentTypeLabel(type: "PRE_TEST" | "POST_TEST" | "QUIZ") {
  if (type === "PRE_TEST") return "Pre-test";
  if (type === "POST_TEST") return "Post-test";
  return "Quiz";
}

function errText(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}
