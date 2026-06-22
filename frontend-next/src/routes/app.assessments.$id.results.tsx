import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Download, QrCode, Sparkles, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
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
import {
  ASSESSMENTS,
  PARTICIPANTS,
  QUESTIONS,
  SCORE_DISTRIBUTION,
  TOPIC_PERFORMANCE,
  DIFFICULTY_PERFORMANCE,
  getAssessment,
} from "@/lib/mock-data";
import type { Assessment } from "@/lib/mock-data";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/assessments/$id/results")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  loader: ({ params }): { assessment: Assessment } => {
    const a = getAssessment(params.id) ?? ASSESSMENTS[0];
    if (!a) throw notFound();
    return { assessment: a };
  },
  component: AssessmentResults,
});

function AssessmentResults() {
  const { assessment } = Route.useLoaderData() as { assessment: Assessment };
  const questions = QUESTIONS.filter((q) => assessment.questionIds.includes(q.id));

  return (
    <>
      <PageHeader
        breadcrumbs={
          <>
            <Link to="/app/assessments" className="hover:underline">
              Assessments
            </Link>
            <span className="mx-1">/</span>
            <Link
              to="/app/assessments/$id"
              params={{ id: assessment.id }}
              className="hover:underline"
            >
              {assessment.title}
            </Link>
          </>
        }
        title="Results"
        meta={
          <>
            <StatusBadge status={assessment.status} />
            <span>·</span>
            <span>{assessment.training}</span>
            <span>·</span>
            <span>{assessment.type}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm">
              <QrCode className="mr-1.5 h-4 w-4" /> Access
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            <Button asChild size="sm">
              <Link to="/app/assessments/$id/post-test" params={{ id: assessment.id }}>
                <Sparkles className="mr-1.5 h-4 w-4" /> Create post-test
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <MetricCard label="Assigned" value={assessment.assigned} />
          <MetricCard label="Submitted" value={assessment.submitted} />
          <MetricCard label="Avg score" value={`${assessment.avgScore ?? 0}%`} />
          <MetricCard label="Completion" value={`${assessment.completionRate}%`} />
          <MetricCard label="Avg time" value="22 min" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={SCORE_DISTRIBUTION}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--primary)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Topic performance</CardTitle>
            </CardHeader>
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Difficulty performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={DIFFICULTY_PERFORMANCE}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="difficulty" fontSize={11} />
                    <YAxis fontSize={11} domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="score" fill="var(--chart-2)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weakest learning objectives</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <WeakRow title="Resolve ambiguous columns" topic="Joins" score={49} />
              <WeakRow title="Distinguish LEFT and RIGHT JOIN" topic="Joins" score={52} />
              <WeakRow title="Use INNER JOIN correctly" topic="Joins" score={58} />
              <WeakRow title="Normalize a table to 3NF" topic="Normalization" score={64} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question statistics</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead className="hidden md:table-cell">Topic</TableHead>
                  <TableHead className="text-right">Correct %</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Avg time</TableHead>
                  <TableHead className="text-right">Quality</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q, i) => {
                  const correct = [82, 76, 49, 58, 71][i % 5];
                  const flag = correct < 55;
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="max-w-md">
                        <span className="line-clamp-2 font-medium">{q.text}</span>
                        {flag && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" /> Many participants answered
                            incorrectly
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {q.topic}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {correct}%
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right text-xs tabular-nums">
                        {40 + (i % 4) * 15}s
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={flag ? "Needs Review" : "Approved"} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Participant attempts</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Time</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PARTICIPANTS.slice(0, 7).map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status="Completed" />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {[88, 76, 64, 54, 91, 70, 82][i]}%
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-xs tabular-nums">
                      {18 + i} min
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline">
                        View attempt
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

function WeakRow({ title, topic, score }: { title: string; topic: string; score: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{topic}</div>
      </div>
      <span className="text-sm font-semibold tabular-nums text-amber-700">{score}%</span>
    </div>
  );
}
