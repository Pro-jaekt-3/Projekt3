import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { MetricCard } from "@/components/common/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { FilterBar } from "@/components/analytics/FilterBar";
import { ParticipantImprovementTable } from "@/components/analytics/ParticipantImprovementTable";
import { qk } from "@/lib/query-keys";
import { analyticsService } from "@/services/analytics";
import { ensureRole } from "@/lib/route-guards";
import { analyticsSearchSchema, searchToFilters } from "@/lib/analytics-filters";

export const Route = createFileRoute("/app/participants/")({
  validateSearch: analyticsSearchSchema,
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: ParticipantImprovements,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;

function ParticipantImprovements() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filters = searchToFilters(search);

  // Paired improvement honors only trainingId on the backend (whole-test pairing
  // can't be subdivided by topic/objective/difficulty). Same contract as the
  // dashboard pre/post card.
  const improvements = useQuery({
    queryKey: qk.analytics.list(["participant-improvements", filters.trainingId ?? null]),
    queryFn: () => analyticsService.participantImprovements({ trainingId: filters.trainingId }),
  });

  return (
    <>
      <PageHeader
        title="Participant progress"
        description="Participants who submitted both a pre- and a post-test, ranked by paired improvement. Advisory — review before acting."
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <FilterBar value={search} onChange={(next) => navigate({ search: next })} />
        <p className="-mt-3 text-xs text-muted-foreground">
          Paired improvement is grouped by training; topic, objective and difficulty don&apos;t
          subdivide a whole-test pairing (they carry through to a participant&apos;s profile).
        </p>

        {improvements.isLoading ? (
          <LoadingState label="Loading participant progress…" />
        ) : improvements.isError ? (
          <ErrorState
            message={errText(improvements.error)}
            onRetry={() => improvements.refetch()}
          />
        ) : (
          (() => {
            const data = improvements.data;
            const participants = data?.participants ?? [];
            const pairedUserCount = data?.pairedUserCount ?? 0;

            if (pairedUserCount === 0 || participants.length === 0) {
              return (
                <EmptyState
                  icon={<Users className="h-5 w-5" />}
                  title="No paired participants yet"
                  description={
                    filters.trainingId
                      ? "No participant has submitted both a pre- and a post-test for this training yet."
                      : "Paired improvement appears once participants submit both a pre- and a post-test."
                  }
                />
              );
            }

            const avgImprovement =
              Math.round(
                (participants.reduce((sum, p) => sum + p.improvement, 0) / participants.length) *
                  100,
              ) / 100;
            const mostImproved = participants[0]; // backend sorts by improvement desc

            return (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <MetricCard
                    label="Both-test participants"
                    value={pairedUserCount}
                    hint="Submitted a pre- and a post-test"
                  />
                  <MetricCard
                    label="Average improvement"
                    value={signed(avgImprovement)}
                    trend={{ value: "paired", positive: avgImprovement >= 0 }}
                  />
                  <MetricCard
                    label="Most improved"
                    value={signed(mostImproved.improvement)}
                    hint={
                      mostImproved.user.name?.trim() ||
                      mostImproved.user.email?.trim() ||
                      `Participant #${mostImproved.user.id}`
                    }
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Paired improvement</CardTitle>
                  </CardHeader>
                  <CardContent className="px-0">
                    <ParticipantImprovementTable participants={participants} search={search} />
                  </CardContent>
                </Card>
              </>
            );
          })()
        )}
      </div>
    </>
  );
}
