import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ParticipantImprovementRow } from "@/services/analytics";
import type { AnalyticsSearch } from "@/lib/analytics-filters";

// Paired-improvement table: ONE row per participant who submitted BOTH a pre- and
// a post-test (the backend already filters to paired users and sorts by
// improvement desc). Each row drills down to that participant's profile, carrying
// the current filter context through the URL search so "back" stays in context.

const pct = (value: number) => `${value}%`;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;

const displayName = (user: ParticipantImprovementRow["user"]) =>
  user.name?.trim() || user.email?.trim() || `Participant #${user.id}`;

export function ParticipantImprovementTable({
  participants,
  search,
}: {
  participants: ParticipantImprovementRow[];
  search: AnalyticsSearch;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Participant</TableHead>
            <TableHead className="text-right">Pre</TableHead>
            <TableHead className="text-right">Post</TableHead>
            <TableHead className="text-right">Improvement</TableHead>
            <TableHead className="w-px" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {participants.map((p) => (
            <TableRow key={p.user.id} className="group">
              <TableCell className="font-medium">
                <Link
                  to="/app/participants/$userId"
                  params={{ userId: String(p.user.id) }}
                  search={search}
                  className="hover:underline"
                >
                  {displayName(p.user)}
                </Link>
                {p.user.name && p.user.email && (
                  <div className="text-xs font-normal text-muted-foreground">{p.user.email}</div>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {pct(p.prePct)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{pct(p.postPct)}</TableCell>
              <TableCell
                className={
                  p.improvement >= 0
                    ? "text-right font-semibold tabular-nums text-emerald-600"
                    : "text-right font-semibold tabular-nums text-rose-600"
                }
              >
                {signed(p.improvement)}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  to="/app/participants/$userId"
                  params={{ userId: String(p.user.id) }}
                  search={search}
                  className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Open ${displayName(p.user)} profile`}
                >
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
