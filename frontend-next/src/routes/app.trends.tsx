import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { LineChart as LineChartIcon } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { MetricCard } from "@/components/common/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { FilterBar } from "@/components/analytics/FilterBar";
import { TrendLineChart, type TrendDatum } from "@/components/analytics/TrendLineChart";
import { qk } from "@/lib/query-keys";
import { analyticsService } from "@/services/analytics";
import type { Trends, TrendGranularity } from "@/services/analytics";
import { ensureRole } from "@/lib/route-guards";
import { analyticsSearchSchema, searchToFilters } from "@/lib/analytics-filters";

// Granularity is a display-bucketing choice the backend accepts; it rides in the
// URL (extending the shared schema) so the whole trends view round-trips. It is
// NOT PII, so URL state is fine.
const GRANULARITIES = ["day", "week", "month"] as const;
const trendsSearchSchema = analyticsSearchSchema.extend({
  granularity: z.enum(GRANULARITIES).catch("day").default("day"),
});

export const Route = createFileRoute("/app/trends")({
  validateSearch: trendsSearchSchema,
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: TrendsPage,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

const GRANULARITY_LABEL: Record<TrendGranularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

function TrendsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filters = searchToFilters(search);
  const granularity = search.granularity;

  // Trends honors only trainingId (+ assessment/participant, not exposed here) on
  // the backend; topic/objective/difficulty don't subdivide whole-attempt trends.
  const trends = useQuery({
    queryKey: qk.analytics.list(["trends", filters.trainingId ?? null, granularity]),
    queryFn: () => analyticsService.trends({ trainingId: filters.trainingId, granularity }),
  });

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <LineChartIcon className="h-5 w-5 text-primary" /> Trends over time
          </span>
        }
        description="Average achievement by submission date, plus pre/post averages per period. Computed from submitted attempts only — advisory; review before acting."
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <FilterBar
              value={search}
              onChange={(next) => navigate({ search: (prev) => ({ ...prev, ...next }) })}
            />
          </div>
          <div className="flex flex-col gap-1 lg:w-44">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Granularity
            </span>
            <Select
              value={granularity}
              onValueChange={(value) =>
                navigate({
                  search: (prev) => ({ ...prev, granularity: value as TrendGranularity }),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRANULARITIES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GRANULARITY_LABEL[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          Buckets are by submission date (UTC); topic, objective and difficulty don&apos;t subdivide
          a whole-attempt trend.
        </p>

        {trends.isLoading ? (
          <LoadingState label="Loading trends…" />
        ) : trends.isError ? (
          <ErrorState message={errText(trends.error)} onRetry={() => trends.refetch()} />
        ) : (
          <TrendsBody data={trends.data} granularity={granularity} />
        )}
      </div>
    </>
  );
}

function TrendsBody({
  data,
  granularity,
}: {
  data: Trends | undefined;
  granularity: TrendGranularity;
}) {
  const achievement = data?.achievementOverTime ?? [];
  const prePost = data?.prePostOverTime ?? [];

  const everythingEmpty = achievement.length === 0 && prePost.length === 0;
  if (everythingEmpty) {
    return (
      <EmptyState
        icon={<LineChartIcon className="h-5 w-5" />}
        title="No trends yet"
        description="No submitted attempts match this scope. Trends appear once participants submit assessments."
      />
    );
  }

  const totalAttempts = achievement.reduce((sum, p) => sum + p.attemptCount, 0);
  const latest = achievement.length ? achievement[achievement.length - 1] : null;

  // Pivot the backend's long [{ date, type, ... }] into one row per date with a
  // PRE_TEST / POST_TEST column (presentation only — no values are invented;
  // missing types stay undefined and render as honest gaps).
  const prePostByDate = new Map<string, TrendDatum>();
  for (const point of prePost) {
    const row = prePostByDate.get(point.date) ?? { date: point.date };
    row[point.type] = point.averagePercentage;
    prePostByDate.set(point.date, row);
  }
  const prePostRows = [...prePostByDate.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard
          label="Periods"
          value={achievement.length}
          hint={`${GRANULARITY_LABEL[granularity]} buckets with data`}
        />
        <MetricCard
          label="Submitted attempts"
          value={totalAttempts}
          hint="Across the selected scope"
        />
        <MetricCard
          label="Latest average"
          value={latest ? `${latest.averagePercentage}%` : "—"}
          hint={latest ? `${latest.date} · ${latest.attemptCount} attempts` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Average achievement over time</CardTitle>
        </CardHeader>
        <CardContent>
          {achievement.length ? (
            <>
              <TrendLineChart
                data={achievement as unknown as TrendDatum[]}
                series={[
                  { dataKey: "averagePercentage", name: "Average score", color: "var(--chart-1)" },
                ]}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Mean score across all submitted attempts in each {granularity} bucket
                {` (${totalAttempts} attempts total)`}.
              </p>
            </>
          ) : (
            <SectionEmpty label="No submitted attempts in this scope." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pre / post averages over time</CardTitle>
        </CardHeader>
        <CardContent>
          {prePostRows.length ? (
            <>
              <TrendLineChart
                data={prePostRows}
                series={[
                  { dataKey: "PRE_TEST", name: "Pre-test", color: "var(--chart-4)" },
                  { dataKey: "POST_TEST", name: "Post-test", color: "var(--chart-1)" },
                ]}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Cohort average per type per {granularity} bucket — each line averages that
                period&apos;s pre- or post-tests independently (not paired per participant).
              </p>
            </>
          ) : (
            <SectionEmpty label="No submitted pre/post attempts in this scope." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
