import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Filter, Search, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRole } from "@/lib/role-context";
import { qk } from "@/lib/query-keys";
import { assessmentsService } from "@/services/assessments";
import type { Assessment, AssessmentStatus, AssessmentType } from "@/types";
import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/assessments/")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: AssessmentsList,
});

const TABS: (AssessmentStatus | "All")[] = [
  "All",
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
];

const ASSESSMENT_STATUS_LABEL: Record<AssessmentStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

const ASSESSMENT_TYPE_LABEL: Record<AssessmentType, string> = {
  PRE_TEST: "Pre-test",
  POST_TEST: "Post-test",
  QUIZ: "Quiz",
};

function AssessmentsList() {
  const { role } = useRole();
  const isAdmin = role === "admin";
  const [tab, setTab] = useState<string>("All");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [trainingId, setTrainingId] = useState("all");
  const [type, setType] = useState<AssessmentType | "all">("all");

  const assessmentsQuery = useQuery({
    queryKey: qk.assessments.list(),
    queryFn: assessmentsService.list,
  });

  const trainingOptions = Array.from(
    new Map(
      (assessmentsQuery.data ?? [])
        .filter((assessment) => assessment.training)
        .map((assessment) => [assessment.training!.id, assessment.training!]),
    ).values(),
  ).sort((left, right) => left.title.localeCompare(right.title));

  const hasExtraFilters = trainingId !== "all" || type !== "all";
  const filtered = (assessmentsQuery.data ?? []).filter((a) => {
    if (tab !== "All" && a.status !== tab) return false;
    if (q && !a.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (trainingId !== "all" && String(a.trainingId) !== trainingId) return false;
    if (type !== "all" && a.type !== type) return false;
    return true;
  });

  const clearFilters = () => {
    setTrainingId("all");
    setType("all");
  };

  const controls = (
    <>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap gap-1 sm:w-auto sm:inline-flex">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t === "All" ? "All" : ASSESSMENT_STATUS_LABEL[t]}
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
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <Filter className="mr-1.5 h-4 w-4" />
          {hasExtraFilters ? "Filters active" : "Filters"}
        </Button>
      </div>

      {filtersOpen && (
        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <FilterField label="Training">
              <Select value={trainingId} onValueChange={setTrainingId}>
                <SelectTrigger>
                  <SelectValue placeholder="All trainings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All trainings</SelectItem>
                  {trainingOptions.map((training) => (
                    <SelectItem key={training.id} value={String(training.id)}>
                      {training.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Type">
              <Select value={type} onValueChange={(value) => setType(value as AssessmentType | "all")}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(ASSESSMENT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            {hasExtraFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </Card>
      )}
    </>
  );

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
      {assessmentsQuery.isLoading ? (
        <LoadingState label="Loading assessments…" />
      ) : assessmentsQuery.isError ? (
        <ErrorState
          message={
            assessmentsQuery.error instanceof Error
              ? assessmentsQuery.error.message
              : "Failed to load assessments"
          }
          onRetry={() => assessmentsQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <div className="space-y-4 p-4 sm:p-6 lg:p-8">
          {controls}

          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title={q || hasExtraFilters || tab !== "All" ? "No matching assessments" : "No assessments yet"}
            description={
              q || hasExtraFilters || tab !== "All"
                ? "Try adjusting your search or filters to widen the results."
                : "Create your first assessment to start collecting participant results."
            }
            action={
              !isAdmin && (
                <Button asChild size="sm">
                  <Link to="/app/assessments/new">
                    <Plus className="mr-1.5 h-4 w-4" /> Create assessment
                  </Link>
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-4 p-4 sm:p-6 lg:p-8">
          {controls}

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
                  {filtered.map((assessment) => (
                    <AssessmentRow
                      key={assessment.id}
                      assessment={assessment}
                      isAdmin={isAdmin}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[12rem]">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function AssessmentRow({
  assessment,
  isAdmin,
}: {
  assessment: Assessment;
  isAdmin: boolean;
}) {
  return (
    <TableRow>
      <TableCell>
        <Link
          to="/app/assessments/$id"
          params={{ id: String(assessment.id) }}
          className="font-medium hover:underline"
        >
          {assessment.title}
        </Link>
        {isAdmin && <div className="text-xs text-muted-foreground">—</div>}
      </TableCell>
      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
        {assessment.training?.title ?? "—"}
      </TableCell>
      <TableCell className="hidden sm:table-cell text-xs">
        {ASSESSMENT_TYPE_LABEL[assessment.type] ?? assessment.type}
      </TableCell>
      <TableCell>
        <StatusBadge
          status={ASSESSMENT_STATUS_LABEL[assessment.status] ?? assessment.status}
        />
      </TableCell>
      <TableCell className="hidden lg:table-cell text-right tabular-nums">—</TableCell>
      <TableCell className="hidden lg:table-cell text-right tabular-nums">—</TableCell>
      <TableCell className="text-right">
        <Button asChild size="sm" variant="outline">
          <Link to="/app/assessments/$id" params={{ id: String(assessment.id) }}>
            Open
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
