// Central react-query key factory. One entry per backend domain so cache
// invalidation is consistent and collision-free across the 3-person split.
//
// Convention (hierarchical keys):
//   qk.<domain>.all          -> ["<domain>"]                  invalidate the whole domain
//   qk.<domain>.lists()      -> ["<domain>","list"]           all list queries
//   qk.<domain>.list(params) -> ["<domain>","list", params]   one filtered list
//   qk.<domain>.details()    -> ["<domain>","detail"]         all detail queries
//   qk.<domain>.detail(id)   -> ["<domain>","detail", id]     one entity
//
// After a mutation, invalidate the narrowest key that still covers what changed,
// e.g. create/delete -> qk.trainings.all ; update -> qk.trainings.detail(id) + lists().

export function entityKeys<TName extends string>(name: TName) {
  return {
    all: [name] as const,
    lists: () => [name, "list"] as const,
    list: (params?: unknown) => [name, "list", params ?? null] as const,
    details: () => [name, "detail"] as const,
    detail: (id: string | number) => [name, "detail", id] as const,
  };
}

export const qk = {
  trainings: entityKeys("trainings"),
  topics: entityKeys("topics"),
  learningObjectives: entityKeys("learning-objectives"),
  questions: entityKeys("questions"),
  assessments: entityKeys("assessments"),
  assessmentAttempts: entityKeys("assessment-attempts"),
  aiModels: entityKeys("ai-models"),
  aiInteractions: entityKeys("ai-interactions"),
  ai: entityKeys("ai"),
  users: entityKeys("users"),
} as const;
