import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Layers } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";

import { ensureRole } from "@/lib/route-guards";
import { qk } from "@/lib/query-keys";
import { equivalenceGroupsService, equivalenceGroupsKeys } from "@/services/equivalenceGroups";
import { questionsService } from "@/services/questions";
import { trainingsService } from "@/services/trainings";
import type { EquivalenceGroup } from "@/types";

export const Route = createFileRoute("/app/questions/equivalent-groups")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: EquivalentGroupsPage,
});

function EquivalentGroupsPage() {
  const queryClient = useQueryClient();

  const groupsQuery = useQuery({
    queryKey: equivalenceGroupsKeys.list(),
    queryFn: equivalenceGroupsService.list,
  });
  const questionsQuery = useQuery({
    queryKey: qk.questions.list(),
    queryFn: questionsService.list,
  });
  const trainingsQuery = useQuery({
    queryKey: qk.trainings.list(),
    queryFn: trainingsService.list,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trainingId, setTrainingId] = useState("");

  const [editTarget, setEditTarget] = useState<EquivalenceGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<EquivalenceGroup | null>(null);

  // Per-group pending "question to add" selection, keyed by group id.
  const [pendingQuestion, setPendingQuestion] = useState<Record<number, string>>({});

  const createMutation = useMutation({
    mutationFn: () =>
      equivalenceGroupsService.create({
        title: name.trim() || null,
        description: description.trim() || null,
        trainingId: Number(trainingId),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equivalenceGroupsKeys.all });
      toast.success("Equivalence group created");
      setCreateOpen(false);
      setName("");
      setDescription("");
      setTrainingId("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create group"),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      equivalenceGroupsService.update(editTarget!.id, {
        title: editName.trim() || null,
        description: editDescription.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equivalenceGroupsKeys.all });
      toast.success("Group updated");
      setEditTarget(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update group"),
  });

  const deleteMutation = useMutation({
    mutationFn: (groupId: number) => equivalenceGroupsService.remove(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equivalenceGroupsKeys.all });
      queryClient.invalidateQueries({ queryKey: qk.questions.all });
      toast.success("Group deleted");
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete group"),
  });

  const addQuestionMutation = useMutation({
    mutationFn: ({ groupId, questionId }: { groupId: number; questionId: number }) =>
      equivalenceGroupsService.addQuestion(groupId, questionId),
    onSuccess: (_question, variables) => {
      queryClient.invalidateQueries({ queryKey: equivalenceGroupsKeys.all });
      queryClient.invalidateQueries({ queryKey: qk.questions.all });
      setPendingQuestion((p) => ({ ...p, [variables.groupId]: "" }));
      toast.success("Question added to group");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add question"),
  });

  const removeQuestionMutation = useMutation({
    mutationFn: ({ groupId, questionId }: { groupId: number; questionId: number }) =>
      equivalenceGroupsService.removeQuestion(groupId, questionId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: equivalenceGroupsKeys.all });
      queryClient.invalidateQueries({ queryKey: qk.questions.all });
      setPendingQuestion((p) => ({ ...p, [variables.groupId]: "" }));
      toast.success("Question removed from group");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove question"),
  });

  const openEdit = (group: EquivalenceGroup) => {
    setEditTarget(group);
    setEditName(group.title ?? "");
    setEditDescription(group.description ?? "");
  };

  const groups = groupsQuery.data ?? [];
  // A question can belong to at most one group — only offer questions not
  // already assigned anywhere as "add to this group" candidates.
  const unassignedQuestions = (questionsQuery.data ?? []).filter(
    (q) => q.equivalenceGroupId === null,
  );

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Link to="/app/questions" className="hover:underline">
            Question bank
          </Link>
        }
        title="Equivalence groups"
        description="Group questions that test the same learning objective at the same difficulty, so post-tests can swap in a fresh variant instead of repeating an identical question."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Create group
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {groupsQuery.isLoading || questionsQuery.isLoading ? (
          <LoadingState label="Loading equivalence groups…" />
        ) : groupsQuery.isError || questionsQuery.isError ? (
          <ErrorState
            message={
              groupsQuery.isError
                ? groupsQuery.error instanceof Error
                  ? groupsQuery.error.message
                  : "Failed to load equivalence groups"
                : questionsQuery.error instanceof Error
                  ? questionsQuery.error.message
                  : "Failed to load questions"
            }
            onRetry={() => {
              groupsQuery.refetch();
              questionsQuery.refetch();
            }}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title="No equivalence groups yet"
            description="Create a group and add questions that are interchangeable variants of each other."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Create group
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const members = group.questions ?? [];
              return (
                <Card key={group.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="min-w-0">
                      <CardTitle className="text-sm">{group.title ?? "(untitled)"}</CardTitle>
                      {group.description && (
                        <CardDescription className="mt-1">{group.description}</CardDescription>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {members.length} question{members.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(group)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(group)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {members.length === 0 ? (
                      <div className="rounded-md border border-dashed bg-surface p-3 text-xs text-muted-foreground">
                        No questions in this group yet.
                      </div>
                    ) : (
                      <ul className="divide-y rounded-md border">
                        {members.map((q) => (
                          <li
                            key={q.id}
                            className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                          >
                            <Link
                              to="/app/questions/$id"
                              params={{ id: String(q.id) }}
                              className="min-w-0 truncate font-medium hover:underline"
                            >
                              {q.title}
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={removeQuestionMutation.isPending}
                              onClick={() =>
                                removeQuestionMutation.mutate({
                                  groupId: group.id,
                                  questionId: q.id,
                                })
                              }
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center gap-2">
                      <Select
                        value={pendingQuestion[group.id] ?? ""}
                        onValueChange={(v) => setPendingQuestion((p) => ({ ...p, [group.id]: v }))}
                      >
                        <SelectTrigger className="max-w-xs">
                          <SelectValue placeholder="Add a question…" />
                        </SelectTrigger>
                        <SelectContent>
                          {unassignedQuestions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              No unassigned questions available
                            </div>
                          ) : (
                            unassignedQuestions.map((q) => (
                              <SelectItem key={q.id} value={String(q.id)}>
                                {q.title}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!pendingQuestion[group.id] || addQuestionMutation.isPending}
                        onClick={() =>
                          addQuestionMutation.mutate({
                            groupId: group.id,
                            questionId: Number(pendingQuestion[group.id]),
                          })
                        }
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create equivalence group</DialogTitle>
            <DialogDescription>
              Group questions that are interchangeable variants of each other.
            </DialogDescription>
          </DialogHeader>
          <form
            id="create-group-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!trainingId) {
                toast.error("Training is required");
                return;
              }
              createMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="group-training">Training</Label>
              <Select value={trainingId} onValueChange={setTrainingId}>
                <SelectTrigger id="group-training">
                  <SelectValue placeholder="Select a training…" />
                </SelectTrigger>
                <SelectContent>
                  {(trainingsQuery.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Title <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SQL Joins — variant set 1"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-desc">Description</Label>
              <Textarea
                id="group-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="create-group-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit equivalence group</DialogTitle>
            <DialogDescription>Update the group title and description.</DialogDescription>
          </DialogHeader>
          <form
            id="edit-group-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              editMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-group-name">Title <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="edit-group-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-group-desc">Description</Label>
              <Textarea
                id="edit-group-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={editMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="edit-group-form" disabled={editMutation.isPending}>
              {editMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this group?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes "{deleteTarget?.title ?? "(untitled)"}".{" "}
              {(deleteTarget?.questions?.length ?? 0) > 0
                ? `Its ${deleteTarget?.questions?.length} question(s) will be detached, not deleted.`
                : "It has no questions attached."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
