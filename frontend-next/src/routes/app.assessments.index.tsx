import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Filter, Search } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { ASSESSMENTS, type AssessmentStatus } from "@/lib/mock-data";
import { useRole } from "@/lib/role-context";

import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/assessments/")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: AssessmentsList,
});

const TABS: (AssessmentStatus | "All")[] = [
  "All",
  "Draft",
  "Published",
  "Open",
  "Closed",
  "Results Ready",
];

function AssessmentsList() {
  const { role } = useRole();
  const isAdmin = role === "admin";
  const [tab, setTab] = useState<string>("All");
  const [q, setQ] = useState("");

  const filtered = ASSESSMENTS.filter((a) => {
    if (tab !== "All" && a.status !== tab) return false;
    if (q && !a.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title={isAdmin ? "All assessments" : "Assessments"}
        description={
          isAdmin
            ? "Read-only monitoring across all instructors and trainings."
            : "All your assessments across trainings."
        }
        actions={
          !isAdmin && (
            <Button asChild size="sm">
              <Link to="/app/assessments/new">
                <Plus className="mr-1.5 h-4 w-4" /> Create assessment
              </Link>
            </Button>
          )
        }
      />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex w-full flex-wrap gap-1 sm:w-auto sm:inline-flex">
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
              placeholder="Search by assessment title"
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" className="shrink-0">
            <Filter className="mr-1.5 h-4 w-4" /> Filters
          </Button>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead className="hidden md:table-cell">Training</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Submitted</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Avg</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        to="/app/assessments/$id"
                        params={{ id: a.id }}
                        className="font-medium hover:underline"
                      >
                        {a.title}
                      </Link>
                      {isAdmin && (
                        <div className="text-xs text-muted-foreground">{a.instructor}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {a.training}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs">{a.type}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right tabular-nums">
                      {a.submitted} / {a.assigned}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right tabular-nums">
                      {a.avgScore ? `${a.avgScore}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/app/assessments/$id" params={{ id: a.id }}>
                          Open
                        </Link>
                      </Button>
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
