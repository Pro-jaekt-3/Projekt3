import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Check, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { qk } from "@/lib/query-keys";
import {
  aiService,
  type AiAction,
  type AiReviewStatus,
  type ListInteractionsParams,
} from "@/services/ai";
import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/ai-review")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: AIReviewQueue,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");
const PAGE_SIZE = 50;

const ALL = "ALL";

const ACTION_LABELS: Record<AiAction, string> = {
  GENERATE_QUESTION: "Generate question",
  EDIT_QUESTION: "Edit question",
  GENERATE_EQUIVALENT_QUESTION: "Generate equivalent",
  CHECK_EQUIVALENCE: "Check equivalence",
  CHECK_QUESTION_QUALITY: "Check quality",
  REVIEW_TEST: "Review test",
  GENERATE_SYNTHETIC_DATA: "Synthetic data",
};
const ACTIONS = Object.keys(ACTION_LABELS) as AiAction[];

const REVIEW_STATUSES: AiReviewStatus[] = ["PENDING", "ACCEPTED", "REJECTED"];

const statusTone = (s: AiReviewStatus) =>
  s === "ACCEPTED" ? "success" : s === "REJECTED" ? "danger" : "warning";

function AIReviewQueue() {
  const queryClient = useQueryClient();

  const [reviewStatus, setReviewStatus] = useState<AiReviewStatus | typeof ALL>("PENDING");
  const [action, setAction] = useState<AiAction | typeof ALL>(ALL);
  const [requestedByInput, setRequestedByInput] = useState("");
  const [requestedById, setRequestedById] = useState<number | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  const params: ListInteractionsParams = {
    limit: PAGE_SIZE,
    offset,
    ...(reviewStatus !== ALL ? { reviewStatus } : {}),
    ...(action !== ALL ? { action } : {}),
    ...(requestedById ? { requestedById } : {}),
  };

  const query = useQuery({
    queryKey: qk.aiInteractions.list(params),
    queryFn: () => aiService.listInteractions(params),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACCEPTED" | "REJECTED" }) =>
      aiService.reviewInteraction(id, status),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: qk.aiInteractions.all });
      toast.success(result.message ?? "Review saved");
    },
    // 409 if it was already reviewed by someone else; surface backend message.
    onError: (e) => toast.error(errText(e)),
  });

  // A filter change must reset paging back to the first page.
  const resetPaging = () => setOffset(0);

  const applyRequestedBy = () => {
    const trimmed = requestedByInput.trim();
    if (trimmed === "") {
      setRequestedById(undefined);
    } else {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n <= 0) {
        toast.error("Requested-by must be a positive user id");
        return;
      }
      setRequestedById(n);
    }
    resetPaging();
  };

  const data = query.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = offset + items.length;
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <>
      <PageHeader
        title="AI review queue"
        description="Every AI suggestion is logged here as PENDING. Accept or reject only sets its review status — no AI content is ever applied automatically."
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select
              value={reviewStatus}
              onValueChange={(v) => {
                setReviewStatus(v as AiReviewStatus | typeof ALL);
                resetPaging();
              }}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {REVIEW_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Action</Label>
            <Select
              value={action}
              onValueChange={(v) => {
                setAction(v as AiAction | typeof ALL);
                resetPaging();
              }}
            >
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All actions</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Requested by (user id)</Label>
            <div className="flex gap-2">
              <Input
                value={requestedByInput}
                onChange={(e) => setRequestedByInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyRequestedBy()}
                placeholder="e.g. 3"
                className="h-9 w-[120px]"
                inputMode="numeric"
              />
              <Button variant="outline" size="sm" onClick={applyRequestedBy}>
                Apply
              </Button>
            </div>
          </div>
        </div>

        {query.isLoading ? (
          <LoadingState label="Loading review queue…" />
        ) : query.isError ? (
          <ErrorState message={errText(query.error)} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No AI interactions"
            description="Nothing matches these filters yet. AI suggestions appear here as they are generated."
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead className="hidden md:table-cell">Model</TableHead>
                    <TableHead className="hidden lg:table-cell">Requested by</TableHead>
                    <TableHead className="hidden sm:table-cell">Questions</TableHead>
                    <TableHead className="hidden sm:table-cell">Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const pending = it.reviewStatus === "PENDING";
                    const busy = reviewMutation.isPending && reviewMutation.variables?.id === it.id;
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{ACTION_LABELS[it.action]}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {it.aiModel ? `${it.aiModel.provider} · ${it.aiModel.modelName}` : "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {it.requestedBy.email}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground tabular-nums">
                          {it.sourceQuestionId ? `src #${it.sourceQuestionId}` : "—"}
                          {it.generatedQuestionId ? ` · gen #${it.generatedQuestionId}` : ""}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground tabular-nums">
                          {new Date(it.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={
                              it.reviewStatus.charAt(0) + it.reviewStatus.slice(1).toLowerCase()
                            }
                            tone={statusTone(it.reviewStatus)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {pending ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={busy}
                                onClick={() =>
                                  reviewMutation.mutate({ id: it.id, status: "ACCEPTED" })
                                }
                              >
                                <Check className="mr-1 h-3 w-3" /> Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-destructive hover:text-destructive"
                                disabled={busy}
                                onClick={() =>
                                  reviewMutation.mutate({ id: it.id, status: "REJECTED" })
                                }
                              >
                                <X className="mr-1 h-3 w-3" /> Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {it.reviewedAt
                                ? `Reviewed ${new Date(it.reviewedAt).toLocaleDateString()}`
                                : "Reviewed"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {showingFrom}–{showingTo} of {total}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canPrev}
                  onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canNext}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
