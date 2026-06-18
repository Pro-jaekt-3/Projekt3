import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight, ShieldCheck, BarChart3, Brain, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PROJEKT3 — Plan, deliver and analyze assessments" },
      { name: "description", content: "AI-supported knowledge assessment platform for informatics and computer science education." },
    ],
  }),
  component: PublicHome,
});

function PublicHome() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">PROJEKT3</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">View demo</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 lg:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              For instructors, participants and admins
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Plan, deliver and analyze knowledge assessments.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              PROJEKT3 is an AI-supported platform for designing assessments around
              topics, learning objectives and difficulty. Build pre-tests and post-tests
              with equivalent variants, then turn results into clear learning insights.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/login">
                  Log in <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login">View demo</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Prototype with static data. No real authentication or AI calls.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-2 shadow-sm">
            <div className="overflow-hidden rounded-lg border bg-surface">
              <div className="flex items-center gap-1.5 border-b bg-card px-3 py-2">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <div className="ml-3 text-[11px] text-muted-foreground">projekt3.app / training / databases</div>
              </div>
              <div className="grid grid-cols-3 gap-3 p-4">
                <MiniStat label="Participants" value="28" />
                <MiniStat label="Avg score" value="71%" />
                <MiniStat label="Approved Q" value="36" />
                <div className="col-span-3 rounded-md border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium">Curriculum readiness</span>
                    <span className="text-muted-foreground">82%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[82%] rounded-full bg-primary" />
                  </div>
                </div>
                <div className="col-span-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-md border bg-card px-2 py-1.5">
                    <div className="text-muted-foreground">SQL Basics</div>
                    <div className="font-semibold">81%</div>
                  </div>
                  <div className="rounded-md border bg-card px-2 py-1.5">
                    <div className="text-muted-foreground">Joins</div>
                    <div className="font-semibold text-amber-600">49%</div>
                  </div>
                  <div className="rounded-md border bg-card px-2 py-1.5">
                    <div className="text-muted-foreground">Normalization</div>
                    <div className="font-semibold">68%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-surface">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <Feature icon={ClipboardList} title="Blueprint-driven assessments" body="Design pre-tests and post-tests around topics, objectives and difficulty." />
          <Feature icon={Brain} title="Contextual AI assistance" body="Draft, rewrite and check equivalent variants. Instructors stay in control." />
          <Feature icon={BarChart3} title="Learning analytics" body="Compare pre/post results and surface weak areas at topic and objective level." />
          <Feature icon={ShieldCheck} title="Safe by default" body="AI suggestions never auto-approve. QR access respects assignment." />
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div>© 2026 PROJEKT3 — Educational assessment platform</div>
          <div>Prototype</div>
        </div>
      </footer>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-accent-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
