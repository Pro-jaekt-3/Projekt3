import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Filter, Search, Layers } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { qk } from "@/lib/query-keys";
import { questionsService } from "@/services/questions";
import type { QuestionStatus } from "@/types";

import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/questions/")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: QuestionBank,
});

const DIFFICULTY_LABEL: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };

type Tone = "muted" | "warning" | "success" | "danger" | "neutral";

const STATUS_META: Record<QuestionStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "muted" },
  NEEDS_REVIEW: { label: "Needs Review", tone: "warning" },
  REVIEW: { label: "In Review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

const TABS: { value: "All" | QuestionStatus; label: string }[] = [
  { value: "All", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "REVIEW", label: "In Review" },
  { value: "REJECTED", label: "Rejected" },
  { value: "APPROVED", label: "Approved" },
  { value: "ARCHIVED", label: "Archived" },
];

function QuestionBank() {
  const [tab, setTab] = useState<string>("All");
  const [q, setQ] = useState("");

  const questionsQuery = useQuery({
    queryKey: qk.questions.list(),
    queryFn: questionsService.list,
  });

  const all = questionsQuery.data ?? [];
  // GET /questions returns every status for every training — filter client-side.
  const filtered = all.filter((it) => {
    if (tab !== "All" && it.status !== tab) return false;
    if (q && !it.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Question bank"
        description="Cross-training question management. Review AI drafts or create new questions."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Available once the AI review queue is wired"
            >
              Review AI drafts
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/questions/equivalent-groups">
                <Layers className="mr-1.5 h-4 w-4" /> Equivalent groups
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/app/questions/$id" params={{ id: "new" }}>
                <Plus className="mr-1.5 h-4 w-4" /> Create question
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex w-full flex-wrap sm:w-auto sm:inline-flex">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search question text"
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Use the status tabs and search above to filter"
          >
            <Filter className="mr-1.5 h-4 w-4" /> Filters
          </Button>
        </div>

        {questionsQuery.isLoading ? (
          <LoadingState label="Loading questions…" />
        ) : questionsQuery.isError ? (
          <ErrorState
            message={
              questionsQuery.error instanceof Error
                ? questionsQuery.error.message
                : "Failed to load questions"
            }
            onRetry={() => questionsQuery.refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title={all.length === 0 ? "No questions yet" : "No questions match your filters"}
            description={
              all.length === 0
                ? "Create your first question to start building the bank."
                : "Try a different tab or search term."
            }
            action={
              all.length === 0 && (
                <Button asChild size="sm">
                  <Link to="/app/questions/$id" params={{ id: "new" }}>
                    <Plus className="mr-1.5 h-4 w-4" /> Create question
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead className="hidden md:table-cell">Topic</TableHead>
                    <TableHead className="hidden sm:table-cell">Difficulty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((it) => {
                    const statusMeta = STATUS_META[it.status];
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="max-w-md">
                          <Link
                            to="/app/questions/$id"
                            params={{ id: String(it.id) }}
                            className="line-clamp-2 font-medium hover:underline"
                          >
                            {it.title}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {it.topic?.name ?? "—"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">
                          {DIFFICULTY_LABEL[it.difficulty] ?? it.difficulty}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={statusMeta.label} tone={statusMeta.tone} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
