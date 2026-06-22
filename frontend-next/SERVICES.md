# SERVICES.md — converting a domain from mock to the real API

This is the **canonical recipe** every dev follows to wire a domain (Questions,
Topics, Assessments, …) from mock data to the real backend. **Trainings** is the
worked reference; copy its shape.

> Auth, `apiClient`, route guards, shared types, query keys and cross-cutting
> helpers already exist. You should only add a `src/services/<domain>.ts` and swap
> the screens. Do **not** call `fetch` directly and do **not** change other domains.

---

## 0. The pieces already in place

| Concern                                   | Where                                  | Use it                                                            |
| ----------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| HTTP + Bearer token + `{error}` + 204     | `src/services/apiClient.ts`            | `apiJsonFetch<T>(path, opts)`, `apiEnsureOk(path, opts)`          |
| Backend-shaped types + enums + aliases    | `src/types/`                           | `import type { Training, Question, … } from "@/types"`            |
| react-query keys                          | `src/lib/query-keys.ts`                | `qk.<domain>.list()`, `qk.<domain>.detail(id)`, `qk.<domain>.all` |
| Loading / error UI                        | `src/components/common/Spinner.tsx`    | `<LoadingState/>`, `<ErrorState/>`                                |
| Empty UI                                  | `src/components/common/EmptyState.tsx` | `<EmptyState/>`                                                   |
| Strip correct answers for solving         | `src/lib/sanitize.ts`                  | `sanitizeQuestionForSolving(q)`                                   |
| Attempt-id persistence (no list endpoint) | `src/lib/attempt-storage.ts`           | `rememberAttemptId` / `getAttemptId`                              |

---

## 1. Write the service (`src/services/<domain>.ts`)

Thin wrapper over `apiClient`. One function per endpoint. Reference:
`src/services/trainings.ts`.

```ts
import { apiEnsureOk, apiJsonFetch } from "./apiClient";
import type { Training } from "@/types";

export interface CreateTrainingInput {
  title: string;
  description?: string | null;
}
export interface UpdateTrainingInput {
  title?: string;
  description?: string | null;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const trainingsService = {
  list: () => apiJsonFetch<Training[]>("/trainings"),
  get: (id) => apiJsonFetch<Training>(`/trainings/${id}`),
  create: (input) =>
    apiJsonFetch<Training>("/trainings", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  update: (id, input) =>
    apiJsonFetch<Training>(`/trainings/${id}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(input),
    }),
  remove: (id) => apiEnsureOk(`/trainings/${id}`, { method: "DELETE" }), // 204, no body
};
```

Rules:

- Reads/JSON writes → `apiJsonFetch<T>`. **204 / empty-body** endpoints → `apiEnsureOk`
  (it never parses a body; `apiJsonFetch` already returns `undefined` for 204 too).
- Always `Content-Type: application/json` + `JSON.stringify` for POST/PUT/PATCH.
- Errors throw `Error(message)` where `message` is the backend `{ error }` text —
  let it bubble to the mutation/query and show it.

## 2. The seam: where each screen switches

Find the mock import and replace its **data source**, not the JSX:

| Before (mock)                                             | After (real)                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `import { TRAININGS } from "@/lib/mock-data"`             | `useQuery({ queryKey: qk.trainings.list(), queryFn: trainingsService.list })`                               |
| route `loader: () => getTraining(id)` + `useLoaderData()` | `useQuery({ queryKey: qk.trainings.detail(id), queryFn: () => trainingsService.get(id) })` in the component |
| direct array `.map(...)`                                  | `query.data?.map(...) ?? []`                                                                                |

We prefer **component-level `useQuery`** over TanStack route `loader`s (simpler, no
loader/context coupling). Keep the `beforeLoad` role guard.

> **Type bridge (transitional):** the Lovable screens were built on a richer mock
> shape. Where a screen reads fields the backend doesn't return yet (because they
> belong to a _different_ domain), map the real entity onto the display shape with
> neutral defaults — see `src/lib/training-view.ts` (`trainingToView`). Delete the
> bridge as those other domains get wired.

## 3. Loading / empty / error — the standard block

```tsx
const q = useQuery({ queryKey: qk.trainings.list(), queryFn: trainingsService.list });

if (q.isLoading) return <LoadingState label="Loading trainings…" />;
if (q.isError)   return <ErrorState message={errText(q.error)} onRetry={() => q.refetch()} />;
const rows = q.data ?? [];
if (rows.length === 0) return <EmptyState title="No trainings yet" description="…" action={…} />;
// …render rows
```

Helper used everywhere: `const errText = (e) => e instanceof Error ? e.message : "Request failed"`.
For a **detail** 404 the backend sends `{ error: "… not found" }` → check
`/not found/i.test(message)` and render a not-found `EmptyState` instead of the error box.

## 4. Mutations + cache invalidation

```tsx
const queryClient = useQueryClient();

const createMutation = useMutation({
  mutationFn: (input: CreateTrainingInput) => trainingsService.create(input),
  onSuccess: (created) => {
    queryClient.invalidateQueries({ queryKey: qk.trainings.all }); // refresh lists
    toast.success(`Created “${created.title}”`);
  },
  onError: (e) => toast.error(errText(e)),
});
```

Invalidation rules of thumb:

- **create / delete** → `invalidateQueries({ queryKey: qk.<domain>.all })`.
- **update** → `qk.<domain>.detail(id)` **and** `qk.<domain>.lists()`.
- Always surface `onError` via `toast` (sonner `<Toaster/>` is mounted in `__root`).

## 5. Special cases proven in Trainings

- **204 No Content (DELETE):** use `apiEnsureOk` (no JSON parse). See `trainingsService.remove`.
- **FK 500 on delete (record in use):** trainings/topics have **no cascade**; deleting one
  that still has children fails with a 500 `{ error }`. **Warn before deleting** (see the
  `AlertDialog` copy in `app.trainings.$id.tsx`) and show `onError` toast — do not assume success.
- **Correct-answer leak (solving views):** `GET /assessments/:id` returns `answerOptions.isCorrect`
  even to a participant. Run results through `sanitizeQuestionForSolving()` at the service/loader
  seam before they reach the solving UI. (Provided now; Trainings doesn't use it.)
- **No "my attempts" list endpoint:** only `GET /assessment-attempts/:id`. Persist attempt ids
  client-side via `src/lib/attempt-storage.ts` (`rememberAttemptId` from the start/submit response).
  **TODO (hardening track):** add a backend list endpoint and drop the shim.

## 6. Per-role data differences (read FRONTEND-NOTES.md)

Some endpoints return different data by role (e.g. `GET /assessments` = all statuses for
ADMIN/INSTRUCTOR but only `PUBLISHED` for PARTICIPANT; participant solving uses
`GET /assessments/available`). Don't assume one shape across roles — check
`docs/FRONTEND-NOTES.md` for your domain before wiring.

---

## Worked example: Trainings (this PR)

- Service: `src/services/trainings.ts` (list/get/create/update/remove).
- List screen `app.trainings.index.tsx`: `useQuery` list + create `Dialog` mutation +
  loading/empty/error.
- Detail screen `app.trainings.$id.tsx`: `useQuery` detail + edit `Dialog` + delete
  `AlertDialog` (FK-500 warning) + 204 handling; navigates to the list after delete.
- Bridge: `src/lib/training-view.ts` maps the flat API training onto the display shape;
  topics/participants/assessments/analytics tabs **remain on mock** until those domains
  are wired (each is removed from the bridge as it's done).
