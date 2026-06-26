import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { FilterBar } from "@/components/analytics/FilterBar";
import { LeaderboardTable } from "@/components/analytics/LeaderboardTable";
import { qk } from "@/lib/query-keys";
import { analyticsService } from "@/services/analytics";
import { ensureRole } from "@/lib/route-guards";
import { analyticsSearchSchema, searchToFilters } from "@/lib/analytics-filters";
import { useRole } from "@/lib/role-context";

export const Route = createFileRoute("/app/leaderboard")({
  // Scope filters (training) live in the URL search. The reveal flag does NOT —
  // it is local component state so no PII / reveal intent ever lands in a
  // shareable URL.
  validateSearch: analyticsSearchSchema,
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: Leaderboard,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

function Leaderboard() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filters = searchToFilters(search);
  const { role } = useRole();

  // Reveal is gated client-side (control shown only to instructor/admin) AND
  // enforced server-side. This route is already instructor/admin-only, but the
  // explicit check keeps the control honest if the page is ever reached otherwise.
  const canReveal = role === "admin" || role === "instructor";
  const [reveal, setReveal] = useState(false);
  const revealRequested = canReveal && reveal;

  // Leaderboard scope honors only trainingId on the backend (best-attempt-per-user
  // is whole-test; topic/objective/difficulty don't subdivide it).
  const leaderboard = useQuery({
    queryKey: qk.analytics.list(["leaderboard", filters.trainingId ?? null, revealRequested]),
    queryFn: () =>
      analyticsService.leaderboard({ trainingId: filters.trainingId, reveal: revealRequested }),
  });

  // Render identity strictly from what the backend returned — never assume the
  // reveal succeeded (insufficient role server-side would keep it anonymized).
  const data = leaderboard.data;
  const revealed = data?.revealed ?? false;
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" /> Leaderboard
          </span>
        }
        description="Best submitted score per participant, ranked. Anonymized by default. Advisory — review before acting."
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <FilterBar value={search} onChange={(next) => navigate({ search: next })} />
        <p className="-mt-3 text-xs text-muted-foreground">
          Ranked by each participant&apos;s best submitted attempt within the selected training;
          topic, objective and difficulty don&apos;t subdivide a whole-test ranking.
        </p>

        {leaderboard.isLoading ? (
          <LoadingState label="Loading leaderboard…" />
        ) : leaderboard.isError ? (
          <ErrorState message={errText(leaderboard.error)} onRetry={() => leaderboard.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-5 w-5" />}
            title="No ranked participants yet"
            description={
              filters.trainingId
                ? "No participant has a submitted attempt for this training yet."
                : "The leaderboard ranks participants once they submit attempts."
            }
          />
        ) : (
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">
                {revealed ? "Ranking (names visible)" : "Ranking"}
              </CardTitle>
              <div className="flex items-center gap-3">
                <Badge variant={revealed ? "default" : "secondary"} className="gap-1">
                  {revealed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {revealed ? "Names visible" : "Anonymized"}
                </Badge>
                {canReveal && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id="reveal-names"
                      checked={reveal}
                      onCheckedChange={setReveal}
                      aria-label="Reveal participant names"
                    />
                    <Label htmlFor="reveal-names" className="cursor-pointer text-sm font-normal">
                      Reveal names
                    </Label>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <LeaderboardTable items={items} revealed={revealed} search={search} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
