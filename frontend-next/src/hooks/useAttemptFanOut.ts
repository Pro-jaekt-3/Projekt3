import { useQueries } from "@tanstack/react-query";
import { getAttemptId } from "@/lib/attempt-storage";
import { qk } from "@/lib/query-keys";
import { assessmentAttemptsService } from "@/services/assessmentAttempts";
import type { Assessment } from "@/types";

// Fans out to each assessment's remembered attempt id (see attempt-storage.ts —
// there is no "list my attempts" backend endpoint) to learn its actual state.
export function useAttemptFanOut(assessments: Assessment[] | undefined) {
  return useQueries({
    queries: (assessments ?? []).map((assessment) => {
      const rememberedAttemptId = getAttemptId(assessment.id);
      return {
        queryKey: qk.assessmentAttempts.detail(rememberedAttemptId ?? `missing-${assessment.id}`),
        queryFn: () => assessmentAttemptsService.get(rememberedAttemptId!),
        enabled: rememberedAttemptId !== null,
        retry: false,
      };
    }),
  });
}
