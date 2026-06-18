import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check, ArrowLeft, BookOpen, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MY_ASSESSMENTS, TOPIC_PERFORMANCE, DIFFICULTY_PERFORMANCE, PRE_POST_COMPARISON } from "@/lib/mock-data";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/assessment/$id/result")({
  loader: ({ params }) => {
    const a = MY_ASSESSMENTS.find((m) => m.id === params.id);
    if (!a) throw notFound();
    return { assessment: a };
  },
  component: ParticipantResult,
});

function ParticipantResult() {
  const { assessment } = Route.useLoaderData();
  const score = assessment.score ?? 76;
  const isPost = assessment.type === "Post-test";

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <Link to="/app/my-results" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to My Results
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/my-assessments">My assessments</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{assessment.training}</div>
                <h1 className="mt-0.5 text-xl font-semibold sm:text-2xl">{assessment.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status="Completed" />
                  <span>·</span>
                  <span>Submitted {assessment.submittedAt ?? "today"}</span>
                  <span>·</span>
                  <span>Time spent 22 min</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-semibold tabular-nums text-primary">{score}%</div>
                <div className="text-xs text-muted-foreground">your score</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Correct" value="6 / 8" />
          <MetricCard label="Time spent" value="22m" />
          <MetricCard label="Strongest" value="SQL Basics" />
          <MetricCard label="Weakest" value="Joins" />
        </div>

        {isPost && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> Improvement since pre-test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={PRE_POST_COMPARISON}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="topic" fontSize={11} />
                    <YAxis fontSize={11} domain={[0, 100]} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="pre" fill="var(--chart-2)" radius={4} />
                    <Bar dataKey="post" fill="var(--primary)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Topic breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="h-56">
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
            <CardHeader><CardTitle className="text-base">Difficulty breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="h-56">
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
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Feedback</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Section title="Strong areas" tone="success" items={["SQL Basics — WHERE / SELECT", "Difficulty: Easy"]} />
            <Section title="Areas to improve" tone="warning" items={["SQL Joins — distinguishing LEFT vs RIGHT", "Normalization to 3NF"]} />
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/app/my-results"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to My Results</Link>
          </Button>
          <Button>
            <BookOpen className="mr-1.5 h-4 w-4" /> Review learning areas
          </Button>
        </div>
      </main>
    </div>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" }) {
  return (
    <div>
      <div className={`text-xs font-semibold uppercase tracking-wide ${tone === "success" ? "text-emerald-700" : "text-amber-700"}`}>{title}</div>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2">
            <Check className={`mt-0.5 h-4 w-4 ${tone === "success" ? "text-emerald-600" : "text-amber-600"}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
