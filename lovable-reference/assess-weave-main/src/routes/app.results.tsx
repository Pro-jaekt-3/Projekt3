import { createFileRoute } from "@tanstack/react-router";
import { Filter, Download } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/common/MetricCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRAININGS, ASSESSMENTS, PRE_POST_COMPARISON, TOPIC_PERFORMANCE } from "@/lib/mock-data";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/app/results")({
  component: GlobalResults,
});

function GlobalResults() {
  return (
    <>
      <PageHeader
        title="Results & analytics"
        description="Cross-training learning analytics."
        actions={
          <>
            <Button variant="outline" size="sm"><Filter className="mr-1.5 h-4 w-4" /> Filters</Button>
            <Button variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" /> Export</Button>
          </>
        }
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Average score" value="71%" trend={{ value: "+4%", positive: true }} />
          <MetricCard label="Completion rate" value="86%" />
          <MetricCard label="Pre→Post improvement" value="+18%" trend={{ value: "vs prior cohort", positive: true }} />
          <MetricCard label="Weakest topic" value="Joins" hint="49% avg" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Pre-test vs post-test</CardTitle></CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={PRE_POST_COMPARISON}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="topic" fontSize={11} />
                    <YAxis domain={[0, 100]} fontSize={11} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="pre" fill="var(--chart-2)" radius={4} />
                    <Bar dataKey="post" fill="var(--primary)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Topic breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={TOPIC_PERFORMANCE} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} fontSize={11} />
                    <YAxis type="category" dataKey="topic" width={110} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="score" fill="var(--primary)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">By training and assessment</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Training</TableHead>
                  <TableHead className="hidden md:table-cell">Assessment</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Participants</TableHead>
                  <TableHead className="text-right">Avg score</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Improvement</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ASSESSMENTS.filter((a) => a.avgScore != null).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.training}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{a.title}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums">{a.assigned}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{a.avgScore}%</TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-xs text-emerald-600">{a.type === "Post-test" ? "+18%" : "—"}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline">View</Button></TableCell>
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
