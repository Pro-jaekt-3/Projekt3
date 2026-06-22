import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MY_ASSESSMENTS, PROGRESS_OVER_TIME } from "@/lib/mock-data";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/app/my-results")({
  component: MyResults,
});

function MyResults() {
  const completed = MY_ASSESSMENTS.filter((a) => a.status === "Completed");
  return (
    <>
      <PageHeader title="My results" description="Your progress across assessments." />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Completed" value={completed.length} />
          <MetricCard label="Latest score" value={`${completed[0]?.score ?? 0}%`} />
          <MetricCard
            label="Improvement"
            value="+18%"
            trend={{ value: "vs pre-test", positive: true }}
          />
          <MetricCard label="Weakest topic" value="Joins" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress over time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer>
                <LineChart data={PROGRESS_OVER_TIME}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All completed assessments</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completed.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.training}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={a.type} tone="info" />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {a.score}%
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {a.submittedAt}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/assessment/$id/result" params={{ id: a.id }}>
                          View
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
