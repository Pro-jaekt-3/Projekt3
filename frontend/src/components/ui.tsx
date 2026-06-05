import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneClasses: Record<Tone, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  primary: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {eyebrow && (
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-indigo-700">
          {eyebrow}
        </p>
      )}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
            {title}
          </h1>
          {description && (
            <div className="mt-4 max-w-4xl text-lg leading-8 text-slate-600">
              {description}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </header>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
}) {
  return (
    <div className="app-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-3xl font-bold tabular-nums text-slate-950">
        {value}
      </div>
      {helper && <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>}
    </div>
  );
}

function StatusBadge({ status, tone }: { status: string; tone?: Tone }) {
  const normalized = status.replaceAll("_", " ");
  const inferredTone =
    tone ||
    (["APPROVED", "PUBLISHED", "SUBMITTED", "Correct"].includes(status)
      ? "success"
      : ["DRAFT", "NEEDS_REVIEW", "REVIEW", "Pending review"].includes(status)
        ? "warning"
        : ["REJECTED", "Incorrect"].includes(status)
          ? "danger"
          : status === "ARCHIVED"
            ? "neutral"
            : "primary");

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-bold ${toneClasses[inferredTone]}`}
    >
      {normalized}
    </span>
  );
}

function SectionCard({
  title,
  description,
  actions,
  children,
  tone = "neutral",
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <section
      className={`rounded-xl border p-6 shadow-sm ${
        tone === "warning"
          ? "border-amber-200 bg-amber-50"
          : "border-[var(--app-border)] bg-white"
      }`}
    >
      {(title || description || actions) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && <h2 className="text-2xl font-bold text-slate-950">{title}</h2>}
            {description && (
              <div
                className={`mt-2 leading-7 ${
                  tone === "warning" ? "text-amber-800" : "text-slate-600"
                }`}
              >
                {description}
              </div>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="app-empty">
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
      <div className="mt-2 leading-7">{description}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function ActionCard({
  title,
  description,
  action,
  meta,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="app-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      {meta && <div className="mb-3">{meta}</div>}
      <h3 className="text-xl font-bold text-slate-950">{title}</h3>
      <div className="mt-2 min-h-[3.5rem] leading-7 text-slate-600">{description}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        {children}
      </div>
    </div>
  );
}

function Stepper({
  steps,
  currentStep,
}: {
  steps: string[];
  currentStep: number;
}) {
  return (
    <ol className="grid gap-2 md:grid-cols-4">
      {steps.map((step, index) => {
        const number = index + 1;
        const isActive = number === currentStep;
        const isComplete = number < currentStep;

        return (
          <li
            key={step}
            className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${
              isActive
                ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                : isComplete
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold tabular-nums">
              {isComplete ? "✓" : number}
            </span>
            <span className="text-sm font-bold">{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--app-border)] bg-white p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {description && <div className="mt-1 text-sm leading-6 text-slate-600">{description}</div>}
      </div>
      {children}
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 font-bold text-slate-950">{value}</div>
    </div>
  );
}

export {
  ActionCard,
  EmptyState,
  FilterBar,
  FormSection,
  KeyValue,
  MetricCard,
  PageHeader,
  SectionCard,
  StatusBadge,
  Stepper,
};
