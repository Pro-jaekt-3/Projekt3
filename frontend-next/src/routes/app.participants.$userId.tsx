import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, UserX, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { MetricCard } from "@/components/common/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { qk } from "@/lib/query-keys";
import { analyticsService } from "@/services/analytics";
import type {
  ParticipantProfile,
  ParticipantTopicPerformance,
} from "@/services/analytics";
import { ensureRole } from "@/lib/route-guards";
import { analyticsSearchSchema } from "@/lib/analytics-filters";

export const Route = createFileRoute("/app/participants/$userId")({
  // Carry the filter context through the URL so "back" returns to the same view.
  // NOTE: the profile endpoint is scoped by :userId only — it does NOT filter by
  // these params, so the page reads them purely to preserve the back-link.
  validateSearch: analyticsSearchSchema,
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["instructor"]),
  component: ParticipantProfilePage,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");
const pct = (value: number) => `${value}%`;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}%`;

const ASSESSMENT_TYPE_LABEL: Record<string, string> = {
  PRE_TEST: "Pre-test",
  POST_TEST: "Post-test",
  QUIZ: "Quiz",
};

const formatDuration = (seconds: number | null): string => {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

function ParticipantProfilePage() {
  const { userId } = Route.useParams();
  const search = Route.useSearch();

  const profileQuery = useQuery({
    queryKey: qk.analytics.detail(`participant:${userId}`),
    queryFn: () => analyticsService.participantProfile(userId),
  });

  const backLink = (
    <Link
      to="/app/participants"
      search={search}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Participant progress
    </Link>
  );

  if (profileQuery.isLoading) {
    return <LoadingState label="Loading participant profile…" />;
  }

  if (profileQuery.isError) {
    const message = errText(profileQuery.error);
    // 404 -> render a clean not-found state rather than the error box.
    if (/not found/i.test(message)) {
      return (
        <>
          <PageHeader title="Participant" breadcrumbs={backLink} />
          <div className="p-4 sm:p-6 lg:p-8">
            <EmptyState
              icon={<UserX className="h-5 w-5" />}
              title="Participant not found"
              description="This participant does not exist or has no analytics available."
            />
          </div>
        </>
      );
    }
    return <ErrorState message={message} onRetry={() => profileQuery.refetch()} />;
  }

  const profile = profileQuery.data;
  if (!profile) return null;

  const name = profile.user.name?.trim() || profile.user.email || `Participant #${profile.user.id}`;

  return (
    <>
      <PageHeader
        title={name}
        breadcrumbs={backLink}
        description={profile.user.email}
        meta={
          <>
            <Badge variant="secondary">{profile.user.role}</Badge>
            <span>·</span>
            <span>{profile.assessments.length} submitted attempts</span>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <ProfileBody profile={profile} />
      </div>
    </>
  );
}

function ProfileBody({ profile }: { profile: ParticipantProfile }) {
  const { prePost, assessments } = profile;

  const prePostChart =
    prePost.prePct !== null || prePost.postPct !== null
      ? [
          { label: "Pre-test", value: prePost.prePct ?? 0 },
          { label: "Post-test", value: prePost.postPct ?? 0 },
        ]
      : [];

  return (
    <>
      {/* Paired pre -> post progress. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pre → post progress</CardTitle>
        </CardHeader>
        <CardContent>
          {prePost.hasBoth ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
                <MetricCard label="Pre-test" value={pct(prePost.prePct ?? 0)} />
                <MetricCard label="Post-test" value={pct(prePost.postPct ?? 0)} />
                <MetricCard
                  label="Improvement"
                  value={signed(prePost.improvement ?? 0)}
                  trend={{
                    value: "paired",
                    positive: (prePost.improvement ?? 0) >= 0,
                  }}
                />
              </div>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={prePostChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis domain={[0, 100]} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="var(--primary)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <span>No paired result — needs both a submitted pre- and a post-test.</span>
              {(prePost.prePct !== null || prePost.postPct !== null) && (
                <span className="text-xs">
                  {prePost.prePct !== null ? `Pre-test ${pct(prePost.prePct)}` : "No pre-test"} ·{" "}
                  {prePost.postPct !== null ? `Post-test ${pct(prePost.postPct)}` : "No post-test"}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-assessment results. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessment results</CardTitle>
        </CardHeader>
        {assessments.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Result</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Time</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((a) => (
                  <TableRow key={a.attemptId}>
                    <TableCell className="font-medium">{a.assessmentTitle}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ASSESSMENT_TYPE_LABEL[a.assessmentType] ?? a.assessmentType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {a.score}/{a.maxScore}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {pct(a.percentage)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums">
                      {formatDuration(a.timeTakenSeconds)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                      {formatDate(a.submittedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <CardContent>
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No submitted attempts yet.
            </div>
          </CardContent>
        )}
      </Card>

      {/* Strong / weak areas (MULTIPLE_CHOICE only). */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AreaCard
          title="Strong areas"
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          topics={profile.strongAreas.topics}
          emptyLabel="No strong areas yet (≥ 70% correct on multiple-choice)."
          tone="positive"
        />
        <AreaCard
          title="Weak areas"
          icon={<TrendingDown className="h-4 w-4 text-rose-600" />}
          topics={profile.weakAreas.topics}
          emptyLabel="No weak areas yet (< 50% correct on multiple-choice)."
          tone="negative"
        />
      </div>

      <p className="text-xs text-muted-foreground">{profile.note}</p>
    </>
  );
}

function AreaCard({
  title,
  icon,
  topics,
  emptyLabel,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  topics: ParticipantTopicPerformance[];
  emptyLabel: string;
  tone: "positive" | "negative";
}) {
  const isEmpty = topics.length === 0;
  const valueClass = tone === "positive" ? "text-emerald-600" : "text-rose-600";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-32 items-center justify-center text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <div className="space-y-4">
            <AreaList
              label="Topics"
              items={topics.map((t) => ({
                id: t.topicId,
                title: t.topicTitle,
                percentage: t.correctPercentage,
                answerCount: t.answerCount,
              }))}
              valueClass={valueClass}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AreaList({
  label,
  items,
  valueClass,
}: {
  label: string;
  items: Array<{ id: number; title: string; percentage: number; answerCount: number }>;
  valueClass: string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.title}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              <span className={`font-semibold ${valueClass}`}>{pct(item.percentage)}</span>{" "}
              <span className="text-xs">({item.answerCount})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
