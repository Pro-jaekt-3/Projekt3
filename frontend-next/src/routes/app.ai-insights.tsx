import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, RefreshCw, Bot, Info, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { MetricCard } from "@/components/common/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { qk } from "@/lib/query-keys";
import { aiService } from "@/services/ai";
import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/ai-insights")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: AIInsights,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");
const pct = (value: number) => `${value}%`;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;

function AIInsights() {
  // GET /ai/pre-post-insights: cohort pre/post numbers + an optional Ollama
  // narrative. Advisory only — the backend logs each request as a PENDING
  // AiInteraction; nothing is applied automatically.
  const query = useQuery({
    queryKey: qk.ai.list("pre-post-insights"),
    queryFn: () => aiService.prePostInsights(),
  });

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI insights
          </span>
        }
        description="Advisory pre/post analysis with an optional local-model narrative. An instructor must review it before acting."
        meta={
          <>
            <Badge variant="secondary" className="gap-1">
              <Bot className="h-3 w-3" /> Advisory only
            </Badge>
            {query.data?.model && (
              <>
                <span>·</span>
                <span>
                  {query.data.provider} · {query.data.model}
                </span>
              </>
            )}
          </>
        }
        actions={
          <Button size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
            Re-analyze
          </Button>
        }
      />

      {query.isLoading ? (
        <LoadingState label="Generating advisory insights…" />
      ) : query.isError ? (
        <ErrorState message={errText(query.error)} onRetry={() => query.refetch()} />
      ) : !query.data ? null : (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          {/* Advisory notice — always shown (CLAUDE.md AI rule). */}
          <div className="flex items-start gap-2 rounded-md border bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{query.data.notice}</span>
          </div>

          {(() => {
            const { comparison: pp } = query.data;
            const hasData = pp.preTest.attemptCount > 0 || pp.postTest.attemptCount > 0;
            const chart = [
              { label: "Pre-test", value: pp.preTest.averagePercentage },
              { label: "Post-test", value: pp.postTest.averagePercentage },
            ];
            return (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard
                    label="Pre-test average"
                    value={pct(pp.preTest.averagePercentage)}
                    hint={`${pp.preTest.attemptCount} submitted`}
                  />
                  <MetricCard
                    label="Post-test average"
                    value={pct(pp.postTest.averagePercentage)}
                    hint={`${pp.postTest.attemptCount} submitted`}
                  />
                  <MetricCard
                    label="Pre→Post improvement"
                    value={signed(pp.improvement)}
                    trend={{ value: "paired average", positive: pp.improvement >= 0 }}
                  />
                  <MetricCard
                    label="Attempts analyzed"
                    value={pp.preTest.attemptCount + pp.postTest.attemptCount}
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pre-test vs post-test</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {hasData ? (
                      <>
                        <div className="h-60">
                          <ResponsiveContainer>
                            <BarChart data={chart}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="label" fontSize={11} />
                              <YAxis domain={[0, 100]} fontSize={11} />
                              <Tooltip />
                              <Bar dataKey="value" fill="var(--primary)" radius={4} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Paired averages over participants who submitted both a pre- and a
                          post-test.
                        </p>
                      </>
                    ) : (
                      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                        No submitted pre/post attempts yet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}

          {/* AI narrative (optional — depends on an active local Ollama model). */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> AI narrative
              </CardTitle>
            </CardHeader>
            <CardContent>
              {query.data.narrativeAvailable && query.data.narrative ? (
                <div className="whitespace-pre-wrap rounded-md border bg-surface/40 p-4 text-sm leading-relaxed">
                  {query.data.narrative}
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    {query.data.narrativeUnavailableReason ??
                      "No AI narrative available. Activate a local Ollama model under AI Models."}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
