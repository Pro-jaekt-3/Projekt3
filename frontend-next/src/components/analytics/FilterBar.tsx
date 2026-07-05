import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { qk } from "@/lib/query-keys";
import { trainingsService } from "@/services/trainings";
import { topicsService } from "@/services/topics";
import {
  DIFFICULTY_OPTIONS,
  EMPTY_ANALYTICS_SEARCH,
  hasAnyAnalyticsFilter,
  type AnalyticsSearch,
} from "@/lib/analytics-filters";
import { cn } from "@/lib/utils";

// Shared analytics filter bar (training / topic / difficulty).
// Stateless: the current selection comes in via `value` and every change is
// pushed back through `onChange` (the page keeps the truth in the URL search).
// Selecting a parent narrows and resets its children so the query stays valid.

const ALL = "all";

interface FilterBarProps {
  value: AnalyticsSearch;
  onChange: (next: AnalyticsSearch) => void;
  className?: string;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[10rem]">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

const toValue = (id?: number) => (id === undefined ? ALL : String(id));
const fromValue = (raw: string): number | undefined => (raw === ALL ? undefined : Number(raw));

export function FilterBar({ value, onChange, className }: FilterBarProps) {
  const trainings = useQuery({
    queryKey: qk.trainings.list(),
    queryFn: trainingsService.list,
  });
  const topics = useQuery({
    queryKey: qk.topics.list(),
    queryFn: topicsService.list,
  });

  // Cascading option sets: when a parent is chosen, only show its children.
  const topicOptions = useMemo(() => {
    const all = topics.data ?? [];
    return value.trainingId === undefined
      ? all
      : all.filter((t) => t.trainingId === value.trainingId);
  }, [topics.data, value.trainingId]);

  const setTraining = (raw: string) =>
    // Reset topic: it may no longer belong to the new training.
    onChange({
      ...value,
      trainingId: fromValue(raw),
      topicId: undefined,
    });

  const setTopic = (raw: string) => onChange({ ...value, topicId: fromValue(raw) });

  const setDifficulty = (raw: string) => onChange({ ...value, difficulty: fromValue(raw) });

  const active = hasAnyAnalyticsFilter(value);

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border bg-card p-3 sm:p-4", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Filter className="h-4 w-4 text-muted-foreground" />
        Filters
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => onChange({ ...EMPTY_ANALYTICS_SEARCH })}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <FilterField label="Training">
          <Select value={toValue(value.trainingId)} onValueChange={setTraining}>
            <SelectTrigger>
              <SelectValue placeholder="All trainings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All trainings</SelectItem>
              {(trainings.data ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Topic">
          <Select value={toValue(value.topicId)} onValueChange={setTopic}>
            <SelectTrigger>
              <SelectValue placeholder="All topics" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All topics</SelectItem>
              {topicOptions.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Difficulty">
          <Select value={toValue(value.difficulty)} onValueChange={setDifficulty}>
            <SelectTrigger>
              <SelectValue placeholder="All difficulties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All difficulties</SelectItem>
              {DIFFICULTY_OPTIONS.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </div>
    </div>
  );
}
