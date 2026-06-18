import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sparkles, Lock, Clock, CalendarDays, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useRole } from "@/lib/role-context";
import { MY_ASSESSMENTS } from "@/lib/mock-data";

export const Route = createFileRoute("/assessment/$id/access")({
  loader: ({ params }) => {
    const a = MY_ASSESSMENTS.find((m) => m.id === params.id);
    if (!a) throw notFound();
    return { assessment: a };
  },
  component: AccessPage,
});

function AccessPage() {
  const { assessment } = Route.useLoaderData();
  const { isAuthenticated, role } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/login", search: { redirect: `/assessment/${assessment.id}/access` } });
    }
  }, [isAuthenticated, navigate, assessment.id]);

  if (!isAuthenticated) return null;

  // Simulated assignment check: tim.k (p8) is not assigned; in this demo, only "participant" role sees assigned screen.
  const isAssigned = role === "participant";
  const isClosed = false;
  const notOpenYet = false;

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

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {!isAssigned ? (
          <Card>
            <CardContent className="space-y-3 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Lock className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-semibold">Access denied</h1>
              <p className="text-sm text-muted-foreground">
                This assessment is not assigned to your account.
              </p>
              <p className="text-xs text-muted-foreground">
                If you believe this is an error, contact your instructor.
              </p>
              <Button asChild variant="outline" className="mt-2">
                <Link to="/app/dashboard">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : isClosed ? (
          <Closed />
        ) : notOpenYet ? (
          <NotOpenYet />
        ) : (
          <Card>
            <CardContent className="space-y-5 p-6 sm:p-8">
              <div>
                <div className="text-xs text-muted-foreground">{assessment.training}</div>
                <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{assessment.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={assessment.type} tone="info" />
                  <span>·</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {assessment.timeLimit} min</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Due {assessment.due}</span>
                </div>
              </div>

              <div className="rounded-md border bg-surface p-4 text-sm">
                <div className="font-medium">Instructions</div>
                <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                  <li>You have {assessment.timeLimit} minutes once you start.</li>
                  <li>You can move forward and backward between questions.</li>
                  <li>Answers save automatically.</li>
                  <li>You can mark questions for review and return to them.</li>
                </ul>
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={() => navigate({ to: "/assessment/$id/solve", params: { id: assessment.id } })}
              >
                Start assessment <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                The timer starts as soon as you click Start.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function Closed() {
  return (
    <Card>
      <CardContent className="space-y-3 p-8 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-amber-600" />
        <h1 className="text-xl font-semibold">This assessment is no longer open.</h1>
        <p className="text-sm text-muted-foreground">Contact your instructor if you believe this is an error.</p>
      </CardContent>
    </Card>
  );
}

function NotOpenYet() {
  return (
    <Card>
      <CardContent className="space-y-3 p-8 text-center">
        <CalendarDays className="mx-auto h-6 w-6 text-sky-600" />
        <h1 className="text-xl font-semibold">This assessment is scheduled to open soon.</h1>
        <p className="text-sm text-muted-foreground">Opens on Nov 5, 2026 at 09:00.</p>
      </CardContent>
    </Card>
  );
}
