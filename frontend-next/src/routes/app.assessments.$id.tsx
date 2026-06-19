import { createFileRoute, Link, notFound, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  QrCode, Copy, ExternalLink, Eye, Play, AlertTriangle, Check, Users, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricCard } from "@/components/common/MetricCard";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ASSESSMENTS, PARTICIPANTS, QUESTIONS, getAssessment } from "@/lib/mock-data";
import type { Assessment } from "@/lib/mock-data";

import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/assessments/$id")({
  validateSearch: z.object({ published: z.coerce.number().optional() }),
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin", "instructor"]),
  loader: ({ params }): { assessment: Assessment } => {
    const assessment = getAssessment(params.id) ?? ASSESSMENTS[0];
    if (!assessment) throw notFound();
    return { assessment };
  },
  component: AssessmentDetail,
});

function AssessmentDetail() {
  const { assessment } = Route.useLoaderData() as { assessment: Assessment };
  const { published } = useSearch({ from: "/app/assessments/$id" });
  const [accessOpen, setAccessOpen] = useState(false);

  useEffect(() => {
    if (published) setAccessOpen(true);
  }, [published]);

  const questions = QUESTIONS.filter((q) => assessment.questionIds.includes(q.id));
  const primary =
    assessment.status === "Draft"
      ? { label: "Continue editing", to: "/app/assessments/new" as const }
      : assessment.status === "Results Ready"
      ? { label: "View results", to: "/app/assessments/$id/results" as const, params: { id: assessment.id } }
      : null;

  return (
    <>
      <PageHeader
        breadcrumbs={<Link to="/app/assessments" className="hover:underline">Assessments</Link>}
        title={assessment.title}
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
            {assessment.status !== "Draft" && (
              <Button variant="outline" size="sm" onClick={() => setAccessOpen(true)}>
                <QrCode className="mr-1.5 h-4 w-4" /> Access & QR
              </Button>
            )}
            {primary && (
              <Button asChild size="sm">
                {primary.to === "/app/assessments/$id/results" ? (
                  <Link to={primary.to} params={primary.params!}>{primary.label}</Link>
                ) : (
                  <Link to={primary.to as any}>{primary.label}</Link>
                )}
              </Button>
            )}
          </>
        }
      />

      {published && (
        <div className="border-b bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30 sm:px-6 lg:px-8">
          <div className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-200">
            <Check className="mt-0.5 h-4 w-4" />
            <div>
              <strong>Assessment published.</strong> Share the QR code or copy the participant link to begin.
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard label="Assigned" value={assessment.assigned} icon={<Users className="h-4 w-4" />} />
          <MetricCard label="Submitted" value={`${assessment.submitted} / ${assessment.assigned}`} />
          <MetricCard label="Avg score" value={assessment.avgScore ? `${assessment.avgScore}%` : "—"} />
          <MetricCard label="Time limit" value={`${assessment.timeLimit} min`} icon={<Clock className="h-4 w-4" />} />
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex w-full flex-wrap sm:w-auto sm:inline-flex">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="access">Access & Live</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <SumRow label="Type" value={assessment.type} />
                <SumRow label="Time limit" value={`${assessment.timeLimit} min`} />
                <SumRow label="Created" value={assessment.createdAt} />
                <SumRow label="Due" value={assessment.dueDate ?? "—"} />
                <SumRow label="Access code" value={assessment.accessCode ?? "—"} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Validation</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Validate ok={true} label="All questions approved" />
                <Validate ok={assessment.assigned > 0} label="Participants assigned" />
                <Validate ok={!!assessment.dueDate} label="Availability set" />
                <Validate ok={true} label="Instructions added" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="mt-4">
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead className="hidden md:table-cell">Topic</TableHead>
                      <TableHead className="hidden sm:table-cell">Difficulty</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((q, i) => (
                      <TableRow key={q.id}>
                        <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                        <TableCell className="max-w-md">
                          <Link to="/app/questions/$id" params={{ id: q.id }} className="line-clamp-2 font-medium hover:underline">{q.text}</Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{q.topic}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs capitalize">{q.difficulty}</TableCell>
                        <TableCell><StatusBadge status={q.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="mt-4">
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="hidden md:table-cell">Started</TableHead>
                      <TableHead className="text-right">Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PARTICIPANTS.slice(0, 8).map((p, i) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <StatusBadge status={i < 6 ? "Completed" : i === 6 ? "In progress" : "To do"} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {i < 7 ? "2 hours ago" : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {i < 6 ? "Yes" : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="access" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Access</CardTitle>
                <CardDescription>QR code, link, access code and live session monitoring.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setAccessOpen(true)}>
                  <QrCode className="mr-1.5 h-4 w-4" /> Open access & live session
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="mt-4">
            {assessment.status === "Results Ready" ? (
              <div className="rounded-lg border bg-card p-6 text-center">
                <Button asChild>
                  <Link to="/app/assessments/$id/results" params={{ id: assessment.id }}>Open detailed results</Link>
                </Button>
              </div>
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Results will appear after participants submit attempts.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AccessDrawer open={accessOpen} onOpenChange={setAccessOpen} assessment={assessment} />
    </>
  );
}

function SumRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Validate({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <Check className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
      <span>{label}</span>
    </div>
  );
}

function AccessDrawer({ open, onOpenChange, assessment }: { open: boolean; onOpenChange: (v: boolean) => void; assessment: Assessment }) {
  const link = `${typeof window !== "undefined" ? window.location.origin : "https://projekt3.app"}/assessment/${assessment.id}/access`;
  const copy = () => {
    if (typeof navigator !== "undefined") navigator.clipboard?.writeText(link);
    toast.success("Link copied");
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Assessment access & live session</SheetTitle>
          <SheetDescription>{assessment.title}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <StatusBadge status={assessment.status} />
            <span className="text-xs text-muted-foreground">Access code: <span className="font-mono">{assessment.accessCode ?? "—"}</span></span>
          </div>

          <div className="rounded-md border bg-card p-4">
            <div className="flex justify-center">
              <QrPlaceholder value={link} />
            </div>
            <div className="mt-3 text-center text-xs text-muted-foreground">
              QR respects assignment. Unassigned users see access-denied.
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Participant link</label>
            <div className="flex gap-2">
              <Input value={link} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copy}><Copy className="h-4 w-4" /></Button>
              <Button asChild variant="outline" size="icon">
                <a href={link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <LiveStat label="Assigned" value={assessment.assigned} />
            <LiveStat label="Opened" value={Math.min(assessment.assigned, assessment.submitted + 3)} />
            <LiveStat label="In progress" value={Math.max(0, 3)} />
            <LiveStat label="Submitted" value={assessment.submitted} />
          </div>

          <div className="rounded-md border bg-card">
            <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live participants
            </div>
            <ul className="divide-y text-sm">
              {PARTICIPANTS.slice(0, 5).map((p, i) => (
                <li key={p.id} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {i < 3 ? "Submitted · 18 min" : i === 3 ? "In progress · Q5/8" : "Not started"}
                    </div>
                  </div>
                  <StatusBadge status={i < 3 ? "Completed" : i === 3 ? "In progress" : "To do"} />
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm"><Eye className="mr-1.5 h-4 w-4" /> Display QR fullscreen</Button>
            <Button variant="outline" size="sm"><Play className="mr-1.5 h-4 w-4" /> Open / close</Button>
            <Button asChild size="sm">
              <Link to="/app/assessments/$id/results" params={{ id: assessment.id }}>View results</Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LiveStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-surface p-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function QrPlaceholder({ value }: { value: string }) {
  // Decorative QR: deterministic pixel pattern from string.
  const cells = 21;
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  const pixels: boolean[] = [];
  let s = h || 1;
  for (let i = 0; i < cells * cells; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    pixels.push((s >> 16) % 4 !== 0);
  }
  // mark corner finder patterns
  const setBlock = (r: number, c: number) => {
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 7; j++) {
        const v = i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4);
        pixels[(r + i) * cells + (c + j)] = v;
      }
  };
  setBlock(0, 0);
  setBlock(0, cells - 7);
  setBlock(cells - 7, 0);
  return (
    <div className="rounded-md border bg-white p-3">
      <div className="grid h-44 w-44 grid-cols-[repeat(21,minmax(0,1fr))] gap-[1px]">
        {pixels.map((on, i) => (
          <div key={i} className={on ? "bg-foreground" : "bg-white"} />
        ))}
      </div>
    </div>
  );
}
