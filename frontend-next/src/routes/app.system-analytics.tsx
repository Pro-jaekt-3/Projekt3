import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { MetricCard } from "@/components/common/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TRAININGS, USERS, ASSESSMENTS, PROGRESS_OVER_TIME } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/system-analytics")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin"]),
  component: SystemAnalytics,
});

function SystemAnalytics() {
  return (
    <>
      <PageHeader title="System analytics" description="High-level system usage. Deep learning analytics live with instructors." />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total assessments" value={ASSESSMENTS.length} />
          <MetricCard label="Total attempts" value="142" />
          <MetricCard label="Completion rate" value="78%" />
          <MetricCard label="AI usage (7d)" value="68 calls" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader><CardTitle className="text-base">Activity trend</CardTitle></CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer>
                  <LineChart data={PROGRESS_OVER_TIME}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Most active instructors</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {USERS.filter((u) => u.role === "instructor").map((u, i) => (
                  <li key={u.id} className="flex items-center justify-between py-2">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">{12 + i * 4} assessments</div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Most active trainings</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Training</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Participants</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Assessments</TableHead>
                  <TableHead className="text-right">Avg score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TRAININGS.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums">{t.participants}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums">{t.assessments}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.avgScore}%</TableCell>
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
