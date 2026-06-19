import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ArrowRight, Users, ClipboardList, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TRAININGS } from "@/lib/mock-data";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useRole } from "@/lib/role-context";

import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/trainings/")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: TrainingsList,
});

function TrainingsList() {
  const { role } = useRole();
  const isAdmin = role === "admin";

  return (
    <>
      <PageHeader
        title={isAdmin ? "All trainings" : "My trainings"}
        description={
          isAdmin
            ? "All trainings across the system. Read-only oversight."
            : "Open a training to enter its workspace: participants, curriculum, question bank, assessments and results."
        }
        actions={
          !isAdmin && (
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" /> Create training
            </Button>
          )
        }
      />
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2 lg:p-8 xl:grid-cols-3">
        {TRAININGS.map((t) => (
          <Card key={t.id} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-4 p-5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold leading-snug">{t.title}</h3>
                  <StatusBadge status={t.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                {isAdmin && (
                  <p className="mt-1 text-xs text-muted-foreground">Instructor: {t.instructor}</p>
                )}
              </div>

              <dl className="grid grid-cols-3 gap-3 text-xs">
                <Stat icon={<Users className="h-3.5 w-3.5" />} label="Participants" value={t.participants} />
                <Stat icon={<ClipboardList className="h-3.5 w-3.5" />} label="Assessments" value={t.assessments} />
                <Stat icon={<BookOpen className="h-3.5 w-3.5" />} label="Approved Q" value={t.approvedQuestions} />
              </dl>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Curriculum coverage</span>
                  <span className="font-medium tabular-nums">{t.curriculumCoverage}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${t.curriculumCoverage}%` }} />
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Updated {t.lastActivity}</span>
                <Button asChild size="sm" variant={isAdmin ? "outline" : "default"}>
                  <Link to="/app/trainings/$id" params={{ id: t.id }}>
                    {isAdmin ? "View overview" : "Open workspace"}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-surface p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span>{label}</span></div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
