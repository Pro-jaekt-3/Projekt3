import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowRight, Users, ClipboardList, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useRole } from "@/lib/role-context";
import { qk } from "@/lib/query-keys";
import { trainingsService } from "@/services/trainings";
import { questionsService } from "@/services/questions";
import { assessmentsService } from "@/services/assessments";
import { usersService } from "@/services/users";
import { trainingToView } from "@/lib/training-view";
import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/trainings/")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: TrainingsList,
});

function TrainingsList() {
  const { role } = useRole();
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();

  const trainingsQuery = useQuery({
    queryKey: qk.trainings.list(),
    queryFn: trainingsService.list,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");

  // ADMIN creates trainings too (role matrix: admin = provisioning) and may
  // grant INSTRUCTOR ownership right away. GET /users is ADMIN-only.
  const usersQuery = useQuery({
    queryKey: qk.users.list(),
    queryFn: usersService.list,
    enabled: isAdmin,
  });
  const instructorCandidates = (usersQuery.data ?? []).filter((u) => u.role === "INSTRUCTOR");

  const createMutation = useMutation({
    mutationFn: () =>
      trainingsService.create({
        title: title.trim(),
        description: description.trim() || null,
        ...(isAdmin && ownerUserId ? { ownerUserId: Number(ownerUserId) } : {}),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: qk.trainings.all });
      queryClient.invalidateQueries({ queryKey: qk.userTrainings.all });
      toast.success(`Training “${created.title}” created`);
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setOwnerUserId("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create training"),
  });

  const questionsQuery = useQuery({
    queryKey: qk.questions.list(),
    queryFn: questionsService.list,
  });

  const approvedByTraining = new Map<number, number>();
  for (const q of questionsQuery.data ?? []) {
    if (q.status === "APPROVED" && q.topic?.trainingId !== undefined) {
      const tid = q.topic.trainingId as number;
      approvedByTraining.set(tid, (approvedByTraining.get(tid) ?? 0) + 1);
    }
  }

  const assessmentsQuery = useQuery({
    queryKey: qk.assessments.list(),
    queryFn: assessmentsService.list,
  });

  const assessmentsByTraining = new Map<number, number>();
  for (const a of assessmentsQuery.data ?? []) {
    const tid = Number(a.trainingId);
    assessmentsByTraining.set(tid, (assessmentsByTraining.get(tid) ?? 0) + 1);
  }

  const trainings = trainingsQuery.data?.map(trainingToView) ?? [];

  return (
    <>
      <PageHeader
        title={isAdmin ? "All trainings" : "My trainings"}
        description={
          isAdmin
            ? "All trainings across the system. Create trainings and grant instructor ownership."
            : "Open a training to enter its workspace: participants, curriculum, question bank, assessments and results."
        }
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Create training
          </Button>
        }
      />

      {trainingsQuery.isLoading ? (
        <LoadingState label="Loading trainings…" />
      ) : trainingsQuery.isError ? (
        <ErrorState
          message={
            trainingsQuery.error instanceof Error
              ? trainingsQuery.error.message
              : "Failed to load trainings"
          }
          onRetry={() => trainingsQuery.refetch()}
        />
      ) : trainings.length === 0 ? (
        <div className="p-4 sm:p-6 lg:p-8">
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="No trainings yet"
            description="Create your first training to start building curriculum and assessments."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Create training
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2 lg:p-8 xl:grid-cols-3">
          {trainings.map((t) => (
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
                  <Stat
                    icon={<Users className="h-3.5 w-3.5" />}
                    label="Participants"
                    value={t.participants}
                  />
                  <Stat
                    icon={<ClipboardList className="h-3.5 w-3.5" />}
                    label="Assessments"
                    value={assessmentsByTraining.get(Number(t.id)) ?? 0}
                  />
                  <Stat
                    icon={<BookOpen className="h-3.5 w-3.5" />}
                    label="Approved Q"
                    value={approvedByTraining.get(Number(t.id)) ?? 0}
                  />
                </dl>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Curriculum coverage</span>
                    <span className="font-medium tabular-nums">{t.curriculumCoverage}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${t.curriculumCoverage}%` }}
                    />
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
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create training</DialogTitle>
            <DialogDescription>
              Add a new training. You can build curriculum and assessments after.
            </DialogDescription>
          </DialogHeader>
          <form
            id="create-training-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) {
                toast.error("Title is required");
                return;
              }
              createMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="t-title">Title</Label>
              <Input
                id="t-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Databases 101"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-desc">Description</Label>
              <Textarea
                id="t-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional summary"
              />
            </div>
            {isAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="t-owner">Instructor owner</Label>
                <Select value={ownerUserId} onValueChange={setOwnerUserId}>
                  <SelectTrigger id="t-owner">
                    <SelectValue placeholder="Assign later (no owner yet)" />
                  </SelectTrigger>
                  <SelectContent>
                    {instructorCandidates.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name ?? u.email} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Optional — you can grant ownership later from the training's Members tab.
                </p>
              </div>
            )}
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="create-training-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create training"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-surface p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
