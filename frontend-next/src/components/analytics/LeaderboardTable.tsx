import { Link } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LeaderboardEntry } from "@/services/analytics";
import type { AnalyticsSearch } from "@/lib/analytics-filters";
import { cn } from "@/lib/utils";

// Leaderboard table. PRIVACY: identity is shown ONLY when the BACKEND reports the
// response as revealed (`revealed` prop reflects `data.revealed`, never the local
// toggle) AND the row actually carries a name. Anonymized rows show the backend's
// "Participant #n" label and are intentionally NOT linked to a real profile, so the
// anonymized view can't be click-through de-anonymized.

const rankClass = (rank: number) =>
  rank === 1
    ? "text-amber-500"
    : rank === 2
      ? "text-zinc-400"
      : rank === 3
        ? "text-orange-700"
        : "text-muted-foreground";

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

export function LeaderboardTable({
  items,
  revealed,
  search,
}: {
  items: LeaderboardEntry[];
  revealed: boolean;
  search: AnalyticsSearch;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-right">#</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead className="hidden sm:table-cell text-right">Score</TableHead>
            <TableHead className="text-right">Result</TableHead>
            <TableHead className="hidden md:table-cell text-right">Best on</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const canLink = revealed && !!item.name;
            const primary = revealed ? item.name?.trim() || item.label : item.label;

            return (
              <TableRow key={item.userId}>
                <TableCell
                  className={cn("text-right font-semibold tabular-nums", rankClass(item.rank))}
                >
                  {item.rank}
                </TableCell>
                <TableCell className="font-medium">
                  {canLink ? (
                    <Link
                      to="/app/participants/$userId"
                      params={{ userId: String(item.userId) }}
                      search={search}
                      className="hover:underline"
                    >
                      {primary}
                    </Link>
                  ) : (
                    primary
                  )}
                  {revealed && item.email && (
                    <div className="text-xs font-normal text-muted-foreground">{item.email}</div>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                  {item.score}/{item.maxScore}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {item.scorePercentage}%
                </TableCell>
                <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                  {formatDate(item.submittedAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
