import { z } from "zod";
import type { AnalyticsFilters } from "@/services/analytics";

// Shared analytics filter state. Lives in the URL search params so it is the
// single source of truth and can be PASSED across every analytics page (the
// basis for drill-down). Pages register `analyticsSearchSchema` via the route's
// `validateSearch`, render <FilterBar>, and turn the search into service params
// with `searchToFilters`.

export const DIFFICULTY_OPTIONS = [
  { value: 1, label: "Easy" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Hard" },
] as const;

// URL search schema. URL values arrive as strings, so coerce; anything invalid
// falls back to `undefined` (= "All") instead of throwing.
export const analyticsSearchSchema = z.object({
  trainingId: z.coerce.number().int().positive().optional().catch(undefined),
  topicId: z.coerce.number().int().positive().optional().catch(undefined),
  learningObjectiveId: z.coerce.number().int().positive().optional().catch(undefined),
  difficulty: z.coerce.number().int().min(1).max(3).optional().catch(undefined),
});

export type AnalyticsSearch = z.infer<typeof analyticsSearchSchema>;

export const EMPTY_ANALYTICS_SEARCH: AnalyticsSearch = {
  trainingId: undefined,
  topicId: undefined,
  learningObjectiveId: undefined,
  difficulty: undefined,
};

// Search -> the filter object consumed by analyticsService (only the four
// drill-down dimensions the FilterBar exposes).
export const searchToFilters = (search: AnalyticsSearch): AnalyticsFilters => ({
  trainingId: search.trainingId,
  topicId: search.topicId,
  learningObjectiveId: search.learningObjectiveId,
  difficulty: search.difficulty,
});

export const hasAnyAnalyticsFilter = (search: AnalyticsSearch): boolean =>
  search.trainingId !== undefined ||
  search.topicId !== undefined ||
  search.learningObjectiveId !== undefined ||
  search.difficulty !== undefined;
