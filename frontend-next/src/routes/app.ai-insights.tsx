import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Sparkles, RefreshCw, Download, Send, FileText, AlertTriangle, TrendingUp,
  TrendingDown, Lightbulb, Bot, User as UserIcon, Wand2, Clock, ShieldAlert,
  CheckCircle2, ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { MetricCard } from "@/components/common/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  TRAININGS, PARTICIPANTS, ASSESSMENTS, TOPIC_PERFORMANCE,
  DIFFICULTY_PERFORMANCE, PRE_POST_COMPARISON, PROGRESS_OVER_TIME, SCORE_DISTRIBUTION,
} from "@/lib/mock-data";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, AreaChart, Area,
} from "recharts";

import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/ai-insights")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  component: AIInsights,
});

// ---------- Simulated AI content ----------

const REPORT_TEMPLATES = [
  { id: "exec", title: "Executive summary", desc: "1-page snapshot for leadership.", icon: FileText },
  { id: "weekly", title: "Weekly cohort digest", desc: "Last 7 days of activity, scores and at-risk learners.", icon: Clock },
  { id: "prepost", title: "Pre/Post comparison", desc: "Topic-level improvement after the post-test.", icon: TrendingUp },
  { id: "risk", title: "At-risk learners", desc: "Participants likely to fail without intervention.", icon: ShieldAlert },
  { id: "items", title: "Item analysis", desc: "Question-level quality, discrimination, and flags.", icon: Wand2 },
];

const AI_INSIGHTS = [
  {
    tone: "danger" as const,
    icon: AlertTriangle,
    title: "Joins is the dominant weakness",
    body: "Avg score on Joins is 49% — 32 points below SQL Basics. The objective 'Resolve ambiguous columns' is the steepest drop (49%) and appears across 3 assessments.",
    actions: ["Add 4 targeted practice questions", "Schedule a 20-min review session", "Re-test only weak objectives"],
  },
  {
    tone: "warning" as const,
    icon: TrendingDown,
    title: "Hard questions underperform expected band",
    body: "Hard items average 48% — below the 55–65% target band. 2 hard items have discrimination below 0.15, suggesting they confuse strong learners too.",
    actions: ["Flag 2 low-discrimination items", "Rewrite distractors with AI", "Move 1 item to medium difficulty"],
  },
  {
    tone: "success" as const,
    icon: TrendingUp,
    title: "Post-test improvement is strong",
    body: "Cohort improved +18% from pre to post on average. Normalization improved +17%, SQL Basics +19%. Joins improved +26% — the intervention is working.",
    actions: ["Lock in current Joins materials", "Publish a cohort recap to participants"],
  },
  {
    tone: "info" as const,
    icon: Lightbulb,
    title: "5 participants are at risk",
    body: "5 of 28 participants have completion below 50% and latest score under 60%. Without action, predicted post-test pass rate drops from 86% to 71%.",
    actions: ["Send personalized nudges", "Assign a remedial practice", "Schedule 1:1 check-ins"],
  },
];

const EXEC_REPORT = `# Executive summary — Introduction to Databases

**Cohort:** 28 participants · **Window:** Oct 12 – Nov 4, 2026
**Overall health:** 🟡 On track with one critical risk

## Headline metrics
- Average score: **71%** (+4% vs prior cohort)
- Completion rate: **86%**
- Pre → Post improvement: **+18 percentage points**
- At-risk learners: **5 of 28** (18%)

## What's working
- Post-test gains are above the 12-point target on every topic.
- SQL Basics is the strongest area (81%) and most questions show good discrimination.
- Practice assignments correlate with a +14% post-test bump for participants who completed them.

## What needs attention
- **Joins** remains the weakest topic at 49%. Resolve-ambiguous-columns is the worst objective.
- **Hard items** average 48%, below the healthy 55–65% band — likely an item-quality issue, not learner ability.
- 5 participants are unlikely to pass the post-test without intervention.

## Recommended next steps (next 7 days)
1. Run the AI question rewriter on the 2 flagged hard items.
2. Add 4 AI-drafted practice questions for Joins → "Resolve ambiguous columns".
3. Send a personalized nudge to the 5 at-risk learners.
4. Re-publish SQL Joins — Practice as a focused 10-min booster.

_Generated by PROJEKT3 AI · Local model: gpt-oss:120b · ~1.8s · simulated for prototype._
`;

const AT_RISK = [
  { name: "Tilen Vidmar", score: 54, completion: 33, risk: 82, reason: "Low completion + weak Joins score" },
  { name: "Luka Zupan", score: 62, completion: 67, risk: 64, reason: "Inconsistent attempts, struggles on hard items" },
  { name: "Jure Petrič", score: 70, completion: 67, risk: 41, reason: "Trending down vs cohort over last 2 weeks" },
];

const ITEM_FLAGS = [
  { id: "q-12", text: "Which join returns rows from both tables even when there is no match?", flag: "Ambiguous wording", severity: "high" as const },
  { id: "q-7",  text: "True or false: HAVING can be used without GROUP BY.", flag: "Low discrimination (0.11)", severity: "high" as const },
  { id: "q-19", text: "What is the result of SELECT * FROM users LEFT JOIN orders …", flag: "Distractors too similar", severity: "medium" as const },
];

const QUICK_PROMPTS = [
  "Which topic should I focus on next week?",
  "Who is most at risk of failing the post-test?",
  "Which questions should I rewrite?",
  "Compare this cohort to the previous one.",
  "Draft a recap email for participants.",
];

const ANSWERS: { match: RegExp; text: string }[] = [
  {
    match: /focus|next week|priority|topic/i,
    text:
      "**Focus area: Joins (avg 49%).**\n\nThe biggest lever is the objective *Resolve ambiguous columns*. I'd:\n\n1. Add 4 practice items (I can draft them).\n2. Run a 20-min targeted review.\n3. Re-test only the 3 weak objectives — no need to repeat the full assessment.\n\nExpected lift: +12–15 points on Joins within one week.",
  },
  {
    match: /risk|fail|at[- ]risk|struggling/i,
    text:
      "**5 participants are at risk** (completion < 50% AND latest score < 60%):\n\n- Tilen Vidmar — 82% risk · low completion + weak Joins\n- Luka Zupan — 64% risk · inconsistent attempts\n- Jure Petrič — 41% risk · trending down\n\nI can draft personalized nudges in one click.",
  },
  {
    match: /rewrite|bad question|item|flag|distractor/i,
    text:
      "**3 items need attention:**\n\n- *q-12* — ambiguous wording on FULL OUTER JOIN.\n- *q-7* — discrimination 0.11 (strong learners miss it too).\n- *q-19* — distractors are too similar.\n\nWant me to draft rewrites using the **gpt-oss:120b** model?",
  },
  {
    match: /compare|previous|cohort|prior/i,
    text:
      "**vs prior cohort (Spring 2026):**\n\n- Avg score: **71% vs 67%** (+4)\n- Pre→Post lift: **+18 vs +12** (+6)\n- Completion: **86% vs 79%** (+7)\n- Joins is *still* the weakest topic in both cohorts — consider a curriculum change, not just more practice.",
  },
  {
    match: /draft|email|recap|message|summary/i,
    text:
      "**Draft — Cohort recap email**\n\nSubject: Great progress on Databases — and what's next\n\nHi everyone, the cohort improved an average of **+18 points** from pre to post. SQL Basics is your strongest area. Joins is the topic to keep practicing — I've published a focused 10-minute booster.\n\n_Sounds good? I can also personalize per learner._",
  },
];

function fakeAnswer(q: string) {
  const hit = ANSWERS.find((a) => a.match.test(q));
  return hit?.text ?? "I scanned the cohort data but didn't find a strong signal for that. Try one of the suggested prompts, or ask about topics, at-risk learners, item quality, or trends.";
}

// ---------- Component ----------

type ChatMsg = { role: "user" | "ai"; text: string; pending?: boolean };

function AIInsights() {
  const [scope, setScope] = useState("tr-db");
  const [model, setModel] = useState("m1");
  const [reportId, setReportId] = useState("exec");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSeed, setReportSeed] = useState(0);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "ai",
      text:
        "Hi 👋 I'm your analytics assistant. I've already analyzed **Introduction to Databases** — 4 assessments, 28 participants. Ask me anything, or pick a prompt below.",
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const training = useMemo(() => TRAININGS.find((t) => t.id === scope) ?? TRAININGS[0], [scope]);

  function regenerate() {
    setReportLoading(true);
    setTimeout(() => {
      setReportLoading(false);
      setReportSeed((s) => s + 1);
    }, 900);
  }

  function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }, { role: "ai", text: "Thinking…", pending: true }]);
    setTimeout(() => {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "ai", text: fakeAnswer(q) };
        return next;
      });
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }, 700);
  }

  const radarData = TOPIC_PERFORMANCE.map((t) => ({ topic: t.topic, current: t.score, target: 80 }));

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI insights & analytics
          </span>
        }
        description="Auto-generated reports, anomaly detection, and a conversational analyst over your cohort data."
        meta={
          <>
            <Badge variant="secondary" className="gap-1">
              <Bot className="h-3 w-3" /> Simulated AI — prototype
            </Badge>
            <span>·</span>
            <span>Last analysis: 2 min ago</span>
          </>
        }
        actions={
          <>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All trainings</SelectItem>
                {TRAININGS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="m1">gpt-oss:120b (local)</SelectItem>
                <SelectItem value="m2">llama3.1:8b (fast)</SelectItem>
                <SelectItem value="m3">Cloud Reasoning</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={regenerate} disabled={reportLoading}>
              <RefreshCw className={cn("mr-1.5 h-4 w-4", reportLoading && "animate-spin")} />
              Re-analyze
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Cohort health" value="🟡 On track" hint="1 critical risk" />
          <MetricCard label="Avg score" value={`${training.avgScore}%`} trend={{ value: "+4%", positive: true }} />
          <MetricCard label="Pre→Post lift" value="+18 pts" trend={{ value: "above target", positive: true }} />
          <MetricCard label="At-risk learners" value={`${AT_RISK.length} / ${training.participants}`} hint="Predicted to miss pass mark" />
          <MetricCard label="Items needing rewrite" value={ITEM_FLAGS.length} hint="2 high severity" />
        </div>

        {/* Insights row */}
        <div className="grid gap-4 lg:grid-cols-2">
          {AI_INSIGHTS.map((ins) => (
            <InsightCard key={ins.title} {...ins} />
          ))}
        </div>

        {/* Two-column: report + chat */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Automated report */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Automated report
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick a template — the AI compiles it from current cohort data.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" /> Export PDF</Button>
                <Button size="sm" onClick={regenerate} disabled={reportLoading}>
                  <Wand2 className={cn("mr-1.5 h-4 w-4", reportLoading && "animate-pulse")} />
                  {reportLoading ? "Generating…" : "Regenerate"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {REPORT_TEMPLATES.map((r) => {
                  const Icon = r.icon;
                  const active = r.id === reportId;
                  return (
                    <button
                      key={r.id}
                      onClick={() => { setReportId(r.id); regenerate(); }}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-input hover:bg-muted",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {r.title}
                    </button>
                  );
                })}
              </div>
              <Separator />
              <div className="relative">
                {reportLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                    <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium shadow-sm">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                      Analyzing 28 participants × 4 assessments…
                    </div>
                  </div>
                )}
                <div
                  key={reportSeed}
                  className="prose prose-sm max-w-none rounded-md border bg-surface/40 p-4 text-sm leading-relaxed text-foreground"
                >
                  <Markdown text={EXEC_REPORT} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chat */}
          <Card className="flex h-[640px] flex-col overflow-hidden">
            <CardHeader className="space-y-0 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" /> Ask the analytics AI
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Conversational queries grounded in this cohort's data.
              </p>
            </CardHeader>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4">
              {messages.map((m, i) => (
                <ChatBubble key={i} msg={m} />
              ))}
            </div>
            <div className="border-t bg-surface/40 p-3 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  placeholder="Ask: 'Which question should I rewrite?' or 'Compare cohorts'…"
                  className="min-h-[44px] resize-none"
                />
                <Button size="icon" onClick={() => send()} disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts grid */}
        <Tabs defaultValue="performance">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="risk">Risk & items</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Topic coverage vs target</CardTitle>
                <p className="text-xs text-muted-foreground">Target = 80%. AI highlights gaps below the target ring.</p>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="topic" fontSize={11} />
                      <PolarRadiusAxis domain={[0, 100]} fontSize={10} />
                      <Radar name="Target" dataKey="target" stroke="var(--muted-foreground)" fill="var(--muted)" fillOpacity={0.3} />
                      <Radar name="Current" dataKey="current" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.4} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pre vs Post by topic</CardTitle>
                <p className="text-xs text-muted-foreground">AI summary: largest gain on Joins (+26 pts).</p>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={PRE_POST_COMPARISON}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="topic" fontSize={11} />
                      <YAxis domain={[0, 100]} fontSize={11} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="pre" name="Pre-test" fill="var(--chart-2)" radius={4} />
                      <Bar dataKey="post" name="Post-test" fill="var(--primary)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Objective-level heatmap</CardTitle>
                <p className="text-xs text-muted-foreground">Red cells are AI-flagged objectives below 60%.</p>
              </CardHeader>
              <CardContent>
                <Heatmap />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score trajectory</CardTitle>
                <p className="text-xs text-muted-foreground">AI forecast: post-test will land at 78–82%.</p>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer>
                    <AreaChart data={PROGRESS_OVER_TIME}>
                      <defs>
                        <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} domain={[0, 100]} />
                      <Tooltip />
                      <Area type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} fill="url(#scoreFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Engagement vs score</CardTitle>
                <p className="text-xs text-muted-foreground">Practice completion correlates with +14 pts on post-test.</p>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer>
                    <LineChart data={[
                      { week: "W1", engagement: 60, score: 64 },
                      { week: "W2", engagement: 68, score: 67 },
                      { week: "W3", engagement: 74, score: 71 },
                      { week: "W4", engagement: 81, score: 76 },
                      { week: "W5", engagement: 86, score: 78 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" fontSize={11} />
                      <YAxis fontSize={11} domain={[40, 100]} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="engagement" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score distribution</CardTitle>
                <p className="text-xs text-muted-foreground">Bimodal — 2 small clusters detected.</p>
              </CardHeader>
              <CardContent>
                <div className="h-72">
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
                <CardTitle className="text-base">Difficulty calibration</CardTitle>
                <p className="text-xs text-muted-foreground">Hard items below the 55–65% healthy band.</p>
              </CardHeader>
              <CardContent>
                <div className="h-72">
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
          </TabsContent>

          <TabsContent value="risk" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-600" /> At-risk participants
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {AT_RISK.map((p) => (
                  <div key={p.name} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.reason}</div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-rose-600">{p.risk}%</span>
                    </div>
                    <Progress value={p.risk} className="mt-2 h-1.5" />
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs">Send nudge</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs">Assign practice</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-amber-600" /> Items the AI suggests rewriting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ITEM_FLAGS.map((it) => (
                  <div key={it.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{it.id}</span>
                      <Badge variant={it.severity === "high" ? "destructive" : "secondary"} className="text-[10px]">
                        {it.severity}
                      </Badge>
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm">{it.text}</div>
                    <div className="mt-1 text-xs text-amber-700">{it.flag}</div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs"><Wand2 className="mr-1 h-3 w-3" /> Rewrite with AI</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs">View question <ChevronRight className="ml-1 h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* What would change */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" /> What the AI suggests changing
            </CardTitle>
            <p className="text-xs text-muted-foreground">One-click actions, queued for instructor approval — nothing runs automatically.</p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {[
              { t: "Rewrite 2 flagged hard items", d: "Improve discrimination on q-7 and q-12.", a: "Generate drafts" },
              { t: "Draft 4 new Joins practice items", d: "Targeting 'Resolve ambiguous columns'.", a: "Draft questions" },
              { t: "Send personalized nudges to 5 learners", d: "Tailored to weakest objective per learner.", a: "Preview messages" },
              { t: "Publish a 10-min Joins booster", d: "Reuse the existing practice blueprint.", a: "Open wizard" },
            ].map((s) => (
              <div key={s.t} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-primary" /> {s.t}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.d}</p>
                </div>
                <Button size="sm" variant="outline">{s.a}</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ---------- Sub-components ----------

function InsightCard({
  tone, icon: Icon, title, body, actions,
}: {
  tone: "danger" | "warning" | "success" | "info";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  actions: string[];
}) {
  const styles: Record<typeof tone, string> = {
    danger: "border-rose-200 bg-rose-50/60 text-rose-900",
    warning: "border-amber-200 bg-amber-50/60 text-amber-900",
    success: "border-emerald-200 bg-emerald-50/60 text-emerald-900",
    info: "border-sky-200 bg-sky-50/60 text-sky-900",
  };
  const iconColor: Record<typeof tone, string> = {
    danger: "text-rose-600",
    warning: "text-amber-600",
    success: "text-emerald-600",
    info: "text-sky-600",
  };
  return (
    <div className={cn("rounded-lg border p-4", styles[tone])}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 rounded-md bg-background p-1.5", iconColor[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <p className="mt-1 text-sm leading-relaxed text-foreground/80">{body}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {actions.map((a) => (
              <button
                key={a}
                className="rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground/80 hover:bg-muted"
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-foreground text-background" : "bg-primary/10 text-primary",
        )}
      >
        {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          isUser ? "bg-primary text-primary-foreground" : "border bg-surface/60",
          msg.pending && "animate-pulse",
        )}
      >
        <Markdown text={msg.text} />
      </div>
    </div>
  );
}

// Minimal markdown: **bold**, *italic*, headings, bullets, paragraphs
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length) {
      out.push(
        <ul key={out.length} className="my-1 list-disc space-y-0.5 pl-5">
          {listBuf.map((li, i) => <li key={i}>{inline(li)}</li>)}
        </ul>,
      );
      listBuf = [];
    }
  };
  lines.forEach((raw) => {
    const line = raw.trimEnd();
    if (/^#\s/.test(line)) { flushList(); out.push(<h3 key={out.length} className="mt-2 text-base font-semibold">{inline(line.replace(/^#\s/, ""))}</h3>); }
    else if (/^##\s/.test(line)) { flushList(); out.push(<h4 key={out.length} className="mt-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{inline(line.replace(/^##\s/, ""))}</h4>); }
    else if (/^\d+\.\s/.test(line)) { flushList(); out.push(<div key={out.length} className="ml-4">{inline(line)}</div>); }
    else if (/^[-*]\s/.test(line)) { listBuf.push(line.replace(/^[-*]\s/, "")); }
    else if (line === "") { flushList(); out.push(<div key={out.length} className="h-1" />); }
    else { flushList(); out.push(<p key={out.length} className="leading-relaxed">{inline(line)}</p>); }
  });
  flushList();
  return <>{out}</>;
}

function inline(s: string): React.ReactNode {
  // Replace **bold** and *italic* and _italic_
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else parts.push(<em key={i++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}

function Heatmap() {
  const rows = [
    { topic: "SQL Basics", cells: [82, 78, 85, 81] },
    { topic: "Joins", cells: [58, 52, 49, 55] },
    { topic: "Normalization", cells: [71, 64, 68, 70] },
  ];
  const cols = ["Pre-test", "Practice", "Joins drill", "Post-test"];
  const color = (v: number) => {
    if (v >= 80) return "bg-emerald-500/85 text-white";
    if (v >= 70) return "bg-emerald-400/70 text-emerald-950";
    if (v >= 60) return "bg-amber-300/70 text-amber-950";
    if (v >= 50) return "bg-amber-400/80 text-amber-950";
    return "bg-rose-500/80 text-white";
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="text-left font-medium text-muted-foreground"> </th>
            {cols.map((c) => <th key={c} className="text-center font-medium text-muted-foreground">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.topic}>
              <td className="pr-2 font-medium">{r.topic}</td>
              {r.cells.map((v, i) => (
                <td key={i} className="p-0">
                  <div className={cn("flex h-10 items-center justify-center rounded-md font-semibold tabular-nums", color(v))}>
                    {v}%
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
