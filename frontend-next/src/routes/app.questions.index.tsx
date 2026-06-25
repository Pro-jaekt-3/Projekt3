import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Sparkles, Filter, Search, Layers } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QUESTIONS, type QuestionStatus } from "@/lib/mock-data";

import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/questions/")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: QuestionBank,
});

const TABS: (QuestionStatus | "All")[] = ["All", "Draft", "Needs Review", "Approved", "Archived"];

function QuestionBank() {
  const [tab, setTab] = useState<string>("All");
  const [q, setQ] = useState("");
  const filtered = QUESTIONS.filter((it) => {
    if (tab !== "All" && it.status !== tab) return false;
    if (q && !it.text.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Question bank"
        description="Cross-training question management. Review AI drafts or create new questions."
        actions={
          <>
            <Button variant="outline" size="sm">
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
              <TabsTrigger key={t} value={t}>
                {t}
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
          <Button variant="outline" size="sm">
            <Filter className="mr-1.5 h-4 w-4" /> Filters
          </Button>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead className="hidden md:table-cell">Training</TableHead>
                  <TableHead className="hidden lg:table-cell">Topic</TableHead>
                  <TableHead className="hidden sm:table-cell">Difficulty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Variants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="max-w-md">
                      <Link
                        to="/app/questions/$id"
                        params={{ id: it.id }}
                        className="line-clamp-2 font-medium hover:underline"
                      >
                        {it.text}
                      </Link>
                      {it.source === "ai" && (
                        <span className="ml-2 inline-block">
                          <StatusBadge
                            status="AI generated"
                            tone="primary"
                            icon={<Sparkles className="h-3 w-3" />}
                          />
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {it.training}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {it.topic}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs capitalize">
                      {it.difficulty}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={it.status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {it.variants}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </>
  );
}
