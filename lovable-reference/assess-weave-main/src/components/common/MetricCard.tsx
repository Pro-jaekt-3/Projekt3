import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: { value: string; positive?: boolean };
  className?: string;
}

export function MetricCard({ label, value, hint, icon, trend, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 sm:p-5 transition-shadow hover:shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              trend.positive ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
