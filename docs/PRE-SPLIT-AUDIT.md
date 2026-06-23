# PRE-SPLIT-AUDIT — frontend-next readiness for 3-way parallel work

Read-only audit of `frontend-next/` before three developers wire mock → real in parallel.
No code, `.env`, or commits were changed by this audit. Scope: health, foundation,
reference pattern, backend contract cross-check, mock isolation, coverage, dead code.

**Date:** 2026-06-22 · **Branch:** `main` (contains the frontend-next work)

---

## Verdict

**🟡 READY WITH CONDITIONS.** The foundation is solid and the Trainings reference is a
correct template. Three things must be handled before/at split: (1) the **lint CRLF flood**
(workflow blocker — every PR fails `npm run lint`), (2) **Dev C is largely blocked by
missing backend** (AI models / Ollama status / AI insights / AI-interactions list have **no
endpoints** — AUDIT §3 over-claimed the `/ai` surface), (3) the **lead must add
`EquivalentQuestionGroup` + an `AssessmentResults` response type** to `src/types`.
Devs A and B can start immediately.

---

## Green / Red checklist

| # | Check | Status |
| --- | --- | --- |
| 1 | `npm run build` | 🟢 green (static `dist/`, only benign >500 kB firebase chunk warning) |
| 2 | `npx tsc --noEmit` | 🟡 3 **pre-existing** errors only (no new) |
| 3 | `npm run lint` | 🔴 red — **12,101 `prettier/prettier` CRLF errors** + 21 `no-explicit-any` + 7 `react-refresh` warnings (all pre-existing / env) |
| 4 | apiClient (Bearer, `{error}`, 204) | 🟢 present & coherent |
| 5 | auth/role-context + route guards | 🟢 present & coherent |
| 6 | Dev role override disabled in prod build | 🟢 confirmed (dead-code-eliminated) |
| 7 | query-keys factory | 🟢 present |
| 8 | sanitizeQuestionForSolving | 🟢 present |
| 9 | attempt-storage | 🟢 present (with documented backend TODO) |
| 10 | `src/types` (enums + models) | 🟡 present; **2 types missing** (EquivalentQuestionGroup, AssessmentResults) + minor field gaps |
| 11 | Trainings reference follows SERVICES.md | 🟢 yes — correct copy template |
| 12 | Mock isolation (only Trainings wired) | 🟢 yes; `mock-data.ts` must stay read-only |
| 13 | OWNERSHIP PART 1 gaps accurate | 🟢 accurate; **+ new backend gaps found (AI surface)** |
| 14 | TanStack Start remnants / dead code | 🟢 none |

---

## 1. Health (commands run in `frontend-next/`)

### `npm run build` — 🟢 GREEN
Static `dist/` (`index.html` + `assets/`, no server bundle). Only warning: one chunk
>500 kB (firebase) — benign, expected.

### `npx tsc --noEmit` — 🟡 3 PRE-EXISTING errors, none new
```
app.dashboard.tsx:71  TS2820  "/app/assessments/a1/post-test" not assignable (use "$id")
app.dashboard.tsx:85  TS2820  "/app/assessments/a1/results"   not assignable (use "$id")
app.trainings.$id.tsx:390 TS2820 "/app/assessments/a1/post-test" not assignable (use "$id")
```
All three are hardcoded demo links from the Lovable export (run-time they still match the
`$id` route). New foundation/Trainings code type-checks clean.

### `npm run lint` — 🔴 RED (but almost entirely line-endings)
`12,129 problems (12,122 errors, 7 warnings)`:
- **12,101 = `prettier/prettier` "Delete ␍"** → CRLF line endings (Git checked out CRLF on
  Windows; prettier expects LF). **Environmental, not code.** Hits *every* file incl. the
  foundation. `--fix`able.
- **21 = `@typescript-eslint/no-explicit-any`** → all in Lovable mock UI (`components/ui/chart.tsx`,
  some `ui/*`, mock pages like `ai-insights`). Pre-existing.
- **7 = `react-refresh/only-export-components`** warnings (shadcn `ui/*`, `role-context.tsx`,
  `lovable-error-reporting.ts`). Benign.
- Lint of **only the foundation/wired files** (excluding CRLF) = **1 benign warning, 0 errors.**

> The foundation code is clean; lint is red for the whole repo due to CRLF + pre-existing
> mock `any`. See P0-1.

---

## 2. Foundation consistency — 🟢

| Piece | File | Verified |
| --- | --- | --- |
| apiClient | `src/services/apiClient.ts` | Bearer via `auth.currentUser.getIdToken()`; `{error}` extraction; **204 / empty-body → `undefined`**; `apiFetch`/`apiJsonFetch`/`apiEnsureOk` ✓ |
| Auth/roles | `src/lib/role-context.tsx` | single `useAuthController`; `/auth/me` → role map ADMIN/INSTRUCTOR/PARTICIPANT → admin/instructor/participant ✓ |
| Guards | `src/lib/route-guards.ts`, `src/main.tsx` | auth lifted above router; `ensureAuthenticated`/`ensureRole`; render gated on `isLoading` (no /login flash) ✓ |
| query-keys | `src/lib/query-keys.ts` | `qk.<domain>` factory for all 9 domains ✓ |
| sanitize | `src/lib/sanitize.ts` | `sanitizeQuestionForSolving` strips `answerOptions.isCorrect` ✓ |
| attempt-storage | `src/lib/attempt-storage.ts` | localStorage attempt-id map + TODO ✓ |
| types | `src/types/{enums,models,index}.ts` | enums 1:1 with Prisma; models for all entities; aliases `textAnswer`/`participantId` ✓ |

**Dev role override prod-safety — 🟢 confirmed.** `isDevRoleOverrideEnabled = import.meta.env.DEV && Boolean(VITE_DEV_ROLE_OVERRIDE)`. `import.meta.env.DEV` is statically `false` in a production build, so Vite dead-code-eliminates the override; `setRole`/dev-login are no-ops in prod.

---

## 3. Reference pattern (Trainings) — 🟢 a correct template

`src/services/trainings.ts` + `app.trainings.index.tsx` + `app.trainings.$id.tsx` follow
SERVICES.md exactly:
- Service over `apiClient` (list/get/create/update/remove); **204 delete via `apiEnsureOk`**.
- `useQuery` for list & detail; `useMutation` for create/edit/delete.
- **loading/empty/error**: `LoadingState` / `EmptyState` / `ErrorState`, detail 404 → not-found EmptyState.
- **invalidation**: create/delete → `qk.trainings.all`; update → `detail(id)` + `lists()`.
- **FK-500**: delete `AlertDialog` warns "remove children first"; `onError` toast surfaces the backend message.

A dev copying this gets a correct result. The only intentional extra is the
`training-view.ts` bridge for not-yet-wired display fields (documented). **No deviation.**

---

## 4. Backend contract cross-check (`src/types` vs `backend/controllers`)

| Domain | Result |
| --- | --- |
| **Questions** | 🟢 Shapes match. GET includes `topic, learningObjective, equivalentGroup, answerOptions(ordered)`. Status PATCH subset `REVIEW/APPROVED/REJECTED/ARCHIVED` ✓. **Minor:** `Question` type has `equivalentGroupId` but not the included `equivalentGroup` object — add `equivalentGroup?: EquivalentQuestionGroup`. **delete returns `{message}` JSON (200), not 204.** |
| **Assessments** | 🟢 Core matches. `GET /assessments` role-filtered (participant→PUBLISHED); `/available` lighter (training only); `:id` → 403 if not published; create/generate/update(DRAFT-only,409 on submitted)/status(no transition checks)/delete `{message}`. ✓ |
| **Assessment results** | 🟡 `GET /assessments/:id/results` returns a **bespoke** object `{assessment, summary, attempts[], questionStats[]}` — **NOT** a plain `Assessment`. Dev B needs a dedicated response type (not in `src/types`). |
| **Attempts** | 🟢 Aliases confirmed: `textAnswer`(=answerText), `participantId`(=userId) serialized in responses ✓. start→403 if not PUBLISHED; single-submit (400 re-submit); `score/maxScore` only post-submit; OPEN/CODE → `needsManualReview`. |
| **Analytics** | 🟢 Endpoints exist: `/by-topic`, `/by-learning-objective`, `/by-difficulty`, `/pre-post-comparison`, `/worst-questions`, `/questions`. **Doc nit:** FRONTEND-NOTES says `/pre-post-series` — actual route is `/pre-post-comparison`. Responses are custom analytics shapes (Dev C defines response types locally). |
| **AI** | 🔴 `/ai` exposes **only** `POST /question-draft`, `POST /equivalence-suggestion`, `PATCH /interactions/:id/review`. Returns `{ suggestion, aiInteractionId, reviewStatus:"PENDING", … }` ✓. **Missing entirely:** `GET /ai/interactions` (review queue list), `/ai/models`, `/ai/ollama/status`, `/ai/pre-post-insights`. **Contract nit:** model inactive/missing → **500** (FRONTEND-NOTES says 400); 501 non-Ollama, 502 unreachable are correct. |

> **AUDIT.md §3 over-claims the `/ai` surface** (it lists models, ollama/status,
> pre-post-insights, interactions list — none exist). This directly blocks Dev C.

---

## 5. Mock isolation — 🟢 (one caveat)

Only **Trainings** is wired. Every other domain still imports from `src/lib/mock-data.ts`
per page; the swap seam is the per-page import (see SERVICES.md §2). **No two devs need to
edit the same screen.**

**Caveat:** `mock-data.ts` is a single shared fixture imported by many pages (e.g. Trainings
detail still reads `PARTICIPANTS`, `RECENT_ACTIVITY`, `assessmentsForTraining`,
`questionsForTraining`, charts from it). Isolation holds **only if nobody edits
`mock-data.ts`** — each dev *removes imports from their own pages*, never mutates the
fixture. → Treat `mock-data.ts` as **read-only/frozen** (add to PART 3 frozen list).

---

## 6. Coverage — OWNERSHIP PART 1 accurate, plus new gaps

PART 1 gaps **confirmed accurate**: Topic create/edit, LearningObjective create/edit and
EquivalentGroup CRUD have **no real UI** (only inert buttons); Question create/editor exists
(`/app/questions/$id` id="new"); assessment edit is partial (reuses wizard, not id-bound).

**New gaps found (backend, beyond OWNERSHIP PART 4):**
- ❌ **No `GET /ai/interactions` list** → Dev C cannot build the AI review queue from the
  backend (only review-by-id exists).
- ❌ **No `/ai/models` CRUD** → Dev C `app.ai-models.tsx` has no backend.
- ❌ **No `/ai/ollama/status` (or test)** → Ollama status/test panel has no backend.
- ❌ **No `/ai/pre-post-insights`** → `app.ai-insights.tsx` AI report has no backend
  (analytics `/pre-post-comparison` exists for the numeric pre/post, but not the AI narrative).
- ❌ **No `/users` route** (confirmed) → admin user/role CRUD missing (already in OWNERSHIP P4 #1).

Net effect: **Dev C's Admin + AI-Review + AI-Insights are mostly blocked on backend.**
Analytics (the data half of Dev C) is fully supported.

---

## 7. Risk / dead code — 🟢 clean

- **No TanStack Start remnants**: no `@tanstack/react-start`, `createServerFn`, `Scripts`,
  `nitro`. `HeadContent` in `__root.tsx` is the legit client head component.
- **TODO/FIXME**: only one, intentional — `attempt-storage.ts` (backend attempts-list TODO).
- No orphaned `server.ts`/`start.ts`/`config.server.ts` (removed in the SPA conversion).

---

## P0 — must fix before / at split

| # | Issue | File(s) | Owner |
| --- | --- | --- | --- |
| P0-1 | **Lint CRLF flood** makes `npm run lint` red for everyone (12,101 errors). Add `.gitattributes` (`* text=auto eol=lf`) + renormalize, or set prettier `endOfLine: "auto"`; then `--fix`. Without this, the "lint green per PR" gate is unusable. | `frontend-next/.prettierrc` / new `.gitattributes` | **Lead** |
| P0-2 | **Add missing shared types** before A/B start their slices: `EquivalentQuestionGroup` (Dev A) and an `AssessmentResults` response type for `/assessments/:id/results` (Dev B). Also add `equivalentGroup?` to `Question`. | `src/types/models.ts` (frozen) | **Lead** |
| P0-3 | **Dev C backend blockers**: AI models CRUD, Ollama status/test, AI interactions list, AI pre-post-insights, and `/users` admin CRUD do not exist. Decide scope (build endpoints on the hardening track, or Dev C ships UI against stubbed services + flags). | `backend/` (hardening) | **Lead + backend; Dev C** |
| P0-4 | **Mark `mock-data.ts` frozen** (read-only fixture) in OWNERSHIP PART 3 so parallel swaps don't collide. | `frontend-next/OWNERSHIP.md` | **Lead** |

---

## Nice-to-have (non-blocking)

- Fix the 3 pre-existing `tsc` errors when those screens are wired (use `params={{ id }}`):
  `app.dashboard.tsx:71,85` (Dev C), `app.trainings.$id.tsx:390` (Dev A).
- Clear `@typescript-eslint/no-explicit-any` in `components/ui/chart.tsx` + mock pages as they get touched.
- FRONTEND-NOTES corrections: AI "model inactive" is **500** (not 400); analytics route is
  `/pre-post-comparison` (not `/pre-post-series`).
- Consider `manualChunks` to silence the >500 kB chunk warning (cosmetic).
- Backend hardening (AUDIT §5): `PORT` from env, restrict CORS origin, add `name` to `/auth/me`.

---

## Readiness for 3-way parallel work

- **Dev A (Curriculum + Question Bank)** — 🟢 **GO** once P0-2 lands (EquivalentQuestionGroup type). Backend CRUD for topics/LO/questions/equivalent-groups all exist; status subset confirmed.
- **Dev B (Assessments + Solving)** — 🟢 **GO** once P0-2 lands (AssessmentResults type). All endpoints exist incl. `/available`, generate, attempts start/submit/get; sanitize + attempt-storage ready.
- **Dev C (Analytics + AI Review + Admin)** — 🟡 **PARTIAL**: Analytics → GO (endpoints exist). AI Review / AI Models / Ollama / AI Insights / Admin Users → **blocked on P0-3 backend**. Start with Analytics; sequence the rest behind backend work.

Overall: **proceed with A and B in parallel now (after P0-1/P0-2); start C on Analytics and
run P0-3 on the hardening track.**

---

## Appendix

**Files read:** `CLAUDE.md`; `frontend-next/{ARCHITECTURE,SCREENS,SERVICES,OWNERSHIP}.md`;
`docs/{FRONTEND-NOTES,AUDIT}.md`; `frontend-next/src/lib/{role-context,route-guards,query-keys,sanitize,attempt-storage,training-view}.ts(x)`,
`src/services/{apiClient,trainings}.ts`, `src/types/*`, `src/main.tsx`, `src/router.tsx`,
`src/routes/{__root,app,login,app.trainings.index,app.trainings.$id,app.questions.index}.tsx`;
`backend/controllers/{training,question,assessment,assessmentAttempt,ai,analytics,auth}Controller.js`;
`backend/routes/{training,ai,analytics}Routes.js`; `backend/prisma/schema.prisma`.

**Commands run (read-only):** `git branch/status`; `npm run build`; `npx tsc --noEmit`;
`npm run lint` (+ filtered re-run); `npx eslint <foundation files>`. No writes to app code or `.env`.

**git status at audit end:** only this new report is added; `package-lock.json` and
`repo-files.txt` remain untracked (unchanged, not committed).
