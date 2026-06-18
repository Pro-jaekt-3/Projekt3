import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary" | "muted";

const TONE: Record<Tone, string> = {
  neutral: "bg-muted text-foreground/70 border-border",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  warning: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  danger: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  info: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  primary: "bg-primary-soft text-accent-foreground border-transparent",
  muted: "bg-muted text-muted-foreground border-border",
};

const STATUS_TONE: Record<string, Tone> = {
  Draft: "muted",
  "Needs Review": "warning",
  Approved: "success",
  Archived: "neutral",
  "Ready to Publish": "info",
  Published: "info",
  Open: "success",
  Closed: "neutral",
  "Results Ready": "primary",
  Active: "success",
  Invited: "info",
  Inactive: "muted",
  Disabled: "danger",
  "To do": "info",
  "In progress": "warning",
  Completed: "success",
  Local: "success",
  Cloud: "warning",
  AI: "primary",
};

interface Props {
  status: string;
  tone?: Tone;
  className?: string;
  icon?: React.ReactNode;
}

export function StatusBadge({ status, tone, className, icon }: Props) {
  const t = tone ?? STATUS_TONE[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE[t],
        className,
      )}
    >
      {icon}
      {status}
    </span>
  );
}
