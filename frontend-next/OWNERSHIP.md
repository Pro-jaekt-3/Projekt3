# OWNERSHIP.md — 3-dev parallel wiring plan (frontend-next)

How three developers wire **mock → real** in parallel without collisions. **Trainings**
is already wired as the reference; everyone follows **[SERVICES.md](./SERVICES.md)** and
codes against **`src/types`**. Routes come from [SCREENS.md](./SCREENS.md); backend
behaviour from [docs/FRONTEND-NOTES.md](../docs/FRONTEND-NOTES.md).

---

## PART 1 — Screen / feature coverage check

What CREATE/EDIT UI exists today (mock) per domain, and where the gaps are.

| Domain                          | Create UI                                                                | Edit UI                     | Where                                                                                                         | Status                                                                             |
| ------------------------------- | ------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Training**                    | ✅ Dialog (list)                                                         | ✅ Dialog + Delete (detail) | `app.trainings.index.tsx`, `app.trainings.$id.tsx`                                                            | **WIRED (reference)**                                                              |
| **Topic**                       | ⚠️ button only ("Add topic")                                             | ❌                          | `app.trainings.$id.tsx` → Curriculum tab (buttons are inert, no form/route)                                   | **GAP — no real create/edit UI**                                                   |
| **LearningObjective**           | ⚠️ button only ("Add objective")                                         | ❌                          | `app.trainings.$id.tsx` → Curriculum tab (inert)                                                              | **GAP — no real create/edit UI**                                                   |
| **Question (incl. MCQ editor)** | ✅ `/app/questions/$id` with `id="new"` (`existing ? "Edit" : "Create"`) | ✅ same screen              | `app.questions.index.tsx` ("Create question" → `$id` id=new), `app.questions.$id.tsx` (MCQ editor + AI panel) | Mock UI exists → wire                                                              |
| **Question status transitions** | n/a                                                                      | ⚠️ in editor                | `app.questions.$id.tsx`                                                                                       | Wire to `PATCH /questions/:id/status` (subset only — see gotchas)                  |
| **EquivalentGroup**             | ❌                                                                       | ❌                          | none (AI "Generate variant" exists in question editor + post-test wizard, but no group CRUD screen)           | **GAP — no create/edit UI; also no `EquivalentQuestionGroup` type in `src/types`** |
| **Assessment create**           | ✅ wizard                                                                | —                           | `app.assessments.new.tsx` (basics → blueprint → pick questions → assignment → preview & publish)              | Mock UI exists → wire                                                              |
| **Assessment edit**             | —                                                                        | ⚠️ partial                  | `app.assessments.$id.tsx` Draft action "Continue editing" → links to `/app/assessments/new` (NOT id-bound)    | **Partial gap — no id-bound edit; reuses create wizard**                           |
| **Assessment generate (AI)**    | ✅ in wizard + post-test                                                 | —                           | `app.assessments.new.tsx`, `app.assessments.$id.post-test.tsx`                                                | Wire to `POST /assessments/generate`                                               |
| **Assessment publish/archive**  | ✅ in wizard / detail                                                    | —                           | `new.tsx` "Publish", `post-test.tsx` "Publish"                                                                | Wire to `PATCH /assessments/:id/status`                                            |

### Intended flow (record + enforce)

The **assessment wizard PICKS already-`APPROVED` questions** that belong to the
**training's topics**. Topics and questions are authored **upstream** — Topics/Objectives
in the **Curriculum** tab and questions in the **Question Bank** — **NOT inside the wizard**.

**Confirmed gap (verified in routes):** there is **no GUI to create a Topic or a Question
from inside the assessment wizard** — and that's by design (the wizard only selects). The
standalone **Question** create/editor **does exist** (`/app/questions/$id`). The standalone
**Topic** and **LearningObjective** create/edit **do NOT exist** (only inert buttons in the
Curriculum tab), and **EquivalentGroup** has **no UI at all**. These three are real
coverage gaps and are owned by **Dev A** (see PART 4).

> Backend note: the missing pieces above are **frontend** gaps. The backend already
> exposes CRUD for `/topics`, `/learning-objectives`, and `/equivalent-question-groups`
> (AUDIT §3), so Dev A builds UI against existing endpoints — no backend work needed for
> those (unlike admin users / attempts list in PART 4).

---

## PART 2 — Ownership split (covers ALL domains)

Rule: a dev owns their **pages + services + their usage of shared types**. Never edit
another dev's service. Trainings stays wired and is **maintained by Dev A**.

### Dev A — Curriculum + Question Bank

|                            |                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Routes owned**           | `app.questions.index.tsx` (`/app/questions`), `app.questions.$id.tsx` (`/app/questions/$id`, create+edit), the **Curriculum** tab of `app.trainings.$id.tsx` (Topics + Learning Objectives), plus **maintains** wired `app.trainings.index.tsx` / `app.trainings.$id.tsx`. New screen(s) for **Equivalent Groups** (none exists). |
| **Services to create**     | `src/services/topics.ts`, `src/services/learningObjectives.ts`, `src/services/questions.ts`, `src/services/equivalentGroups.ts`, `src/services/aiAuthoring.ts` (AI **question-draft** + **equivalence-suggestion** — advisory; `POST /ai/question-draft`, `POST /ai/equivalence-suggestion`).                                     |
| **Already owns**           | `src/services/trainings.ts` (reference — keep).                                                                                                                                                                                                                                                                                   |
| **Shared types consumed**  | `Topic`, `LearningObjective`, `Question`, `AnswerOption`, `QuestionType`, `QuestionStatus`, `EquivalentQuestionGroup` (⚠️ **not in `src/types` yet — lead must add**, see PART 3/4), `AiInteraction`, `AiAction`, `AiReviewStatus`.                                                                                               |
| **AI helper UI**           | Advisory only: every AI draft / equivalence suggestion shows **Accept / Reject**, never auto-applies; generated questions land as `DRAFT`/`NEEDS_REVIEW`. (The review **queue** itself is Dev C; Dev A only triggers generation + inline accept of its own draft.)                                                                |
| **FRONTEND-NOTES gotchas** | **Status enum subset** — `PATCH /questions/:id/status` accepts only `REVIEW                                                                                                                                                                                                                                                       | APPROVED | REJECTED | ARCHIVED`(not`DRAFT`/`NEEDS_REVIEW`); APPROVED/REJECTED auto-sets `reviewedBy/At`. `createQuestion` does **not** validate title/description/difficulty/`topicId`(missing`topicId`→ 500) → **validate client-side**. MCQ needs **≥2 options, ≥1 correct**; sending`options`for non-MCQ → 400.`GET /questions` returns **all statuses** (no filter) → filter client-side. **Delete 204 + FK-500** (deleting a topic with questions/objectives fails) → warn + handle. |

### Dev B — Assessments + Solving (one attempt-lifecycle domain)

|                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Routes owned**           | `app.assessments.index.tsx` (`/app/assessments`), `app.assessments.new.tsx` (`/app/assessments/new` — create/generate/publish; also the edit entry), `app.assessments.$id.tsx` (`/app/assessments/$id` — detail, publish/unpublish/archive, QR/access), `app.assessments.$id.results.tsx` (`/app/assessments/$id/results` — **instructor** per-assessment results), `app.assessments.$id.post-test.tsx`, `app.my-assessments.tsx` (`/app/my-assessments`), `app.my-results.tsx` (`/app/my-results`), and the solving flow `assessment.$id.access.tsx`, `assessment.$id.solve.tsx`, `assessment.$id.result.tsx`.                                                                                                                                                                                                                                                                        |
| **Services to create**     | `src/services/assessments.ts` (list/get/create/update/generate/status/delete; `GET /assessments/available` for participants), `src/services/assessmentAttempts.ts` (start / submit / get by id).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Shared types consumed**  | `Assessment`, `AssessmentQuestion`, `AssessmentType`, `AssessmentStatus`, `AssessmentAttempt`, `ParticipantAnswer`, `AttemptStatus`, `Question` + `AnswerOption` (read, **sanitized** for solving).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **FRONTEND-NOTES gotchas** | **`isCorrect` leak → B**: run solving questions through `sanitizeQuestionForSolving()` (`src/lib/sanitize.ts`) before render — never show correct answers pre-submit. **APPROVED-only + same-training picker → B**: question picker filters `status=APPROVED` AND same training (else 400; no duplicate ids). **Single submit, no autosave**: build one final submit; re-submit → 400 "already submitted"; disable editing after submit. `score/maxScore` only exist after submit. OPEN/CODE → `needsManualReview`, show "awaiting review", not final. Participant sees only `PUBLISHED` (`GET /assessments` role-filtered; use `/assessments/available`); `GET /assessments/:id` → **403** if not published (catch + redirect). Results endpoint is **ADMIN/INSTRUCTOR only**. **No attempts-list endpoint** → persist ids via `src/lib/attempt-storage.ts`. **Delete 204 + FK-500**. |

### Dev C — Analytics + AI Review + Admin

|                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Routes owned**           | `app.system-analytics.tsx` (`/app/system-analytics`), `app.results.tsx` (`/app/results` — **global instructor analytics**; coordinate with Dev B's per-assessment results), `app.ai-insights.tsx` (`/app/ai-insights` — advisory + AI **review queue** UI), `app.ai-models.tsx` (`/app/ai-models`), `app.users.tsx` (`/app/users`).                                                                                                                              |
| **Services to create**     | `src/services/analytics.ts` (`/analytics/*` incl. pre-post-series, worst-questions, by-topic/objective/difficulty), `src/services/aiReview.ts` (AI insights `POST /ai/pre-post-insights` + interaction review `PATCH /ai/interactions/:id/review` + listing PENDING interactions), `src/services/aiModels.ts` (`/ai/models`, `/ai/ollama/status`), `src/services/users.ts` (admin user/role CRUD — **backend likely missing**, see PART 4).                      |
| **Shared types consumed**  | `AiModel`, `AiInteraction`, `AiAction`, `AiReviewStatus`, `AiProvider`, `User`, `UserRole`, and read-only `Assessment`/`AssessmentAttempt`/`Question` for analytics.                                                                                                                                                                                                                                                                                             |
| **AI rules**               | AI insights are **advisory only** — render with a "review required" note; the review queue is **Accept/Reject** (`PATCH /ai/interactions/:id/review`); **never auto-apply** (MVP AI rule, `CLAUDE.md`).                                                                                                                                                                                                                                                          |
| **FRONTEND-NOTES gotchas** | Analytics count **only submitted attempts** (`submittedAt != null`) → expect zeros/empty states. Pre/post pairs **same user who did both** tests (last attempt each). Paired breakdowns use **1 point per answer**, not weighted `points`. AI errors are specific: **501** (non-Ollama), **502** (Ollama unreachable), **400** (model inactive/not installed) → show specific messages. `GET /auth/me` has **no `name`**. **Delete 204 + FK-500** (all domains). |

### Domain → owner quick map

`trainings`→A · `topics`→A · `learning-objectives`→A · `questions`→A · `equivalent-question-groups`→A · `ai (authoring)`→A ·
`assessments`→B · `assessment-attempts`/solving→B ·
`analytics`→C · `ai (review/insights/models)`→C · `users/admin`→C.

---

## PART 3 — Rules of engagement

1. **You own your pages + services + your usage of shared types.** Never edit another
   dev's `src/services/*` file. Cross-domain needs (e.g. B's picker reading A's questions)
   go through the **published service API + `src/types`**, never by editing the other service.
2. **Frozen — change only via the lead (one coordinated PR):**
   - `src/types/*` (now includes `EquivalentQuestionGroup` + `AssessmentResults`)
   - `src/services/apiClient.ts`
   - `src/lib/firebase.ts`, `src/lib/role-context.tsx`, `src/lib/route-guards.ts`
   - `src/lib/query-keys.ts` (add a `qk.<domain>` entry via the lead if missing)
   - cross-cutting helpers: `src/lib/sanitize.ts`, `src/lib/attempt-storage.ts`, `src/lib/training-view.ts`
   - **`src/lib/mock-data.ts` is READ-ONLY** — the shared demo fixture. Each dev only
     **removes** mock imports from their OWN pages as they wire real services; **nobody
     edits `mock-data.ts`** (editing it would collide across domains). It is deleted only
     at the very end, once no page imports it.
   - UI primitives `src/components/ui/*`, shared `src/components/common/*`, `src/styles.css` (Tailwind tokens)
3. **Branching:** one feature branch per domain off `projekt2.0`; **one domain per PR**.
   Branch names: `feat/questions`, `feat/assessments`, `feat/analytics`, etc.
4. **Quality bar per PR:** visuals stay identical; code against `src/types`; follow
   SERVICES.md (service → seam → loading/empty/error → mutation+invalidation); `npm run build`
   green; no edits to frozen files; no `.env`, root `package-lock.json`, or `repo-files.txt`.
5. **Coordination points:** B's question picker ↔ A's `questions` service/types; C's
   `/app/results` ↔ B's per-assessment results (avoid duplicated analytics calls); curriculum
   tab lives in A's Trainings detail — keep the wired Training **core** intact.

---

## PART 4 — Backend gaps / parallel hardening track

Work that blocks a dev or improves quality. Tracked separately from UI wiring.

| #   | Gap                                                                                                                                                                                                               | Impact                                                                                                              | Owner / action                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Admin user/role CRUD** — no `/users` route is mounted (AUDIT §3 lists `/auth /questions /topics /learning-objectives /trainings /equivalent-question-groups /assessments /assessment-attempts /analytics /ai`). | Blocks **Dev C** `app.users.tsx`.                                                                                   | Backend: add `/users` (list + role update), ADMIN-only. Until then Dev C builds UI against a stub service + documents it. |
| 2   | **No `GET /assessment-attempts` list** — only `GET /:id`.                                                                                                                                                         | **Dev B** can't list a participant's attempts.                                                                      | Interim: `src/lib/attempt-storage.ts` (client persistence). Backend: add "my attempts" list, then drop the shim.          |
| 3   | **`name` missing in `GET /auth/me`** (returns `{id,email,role,firebaseUid}`).                                                                                                                                     | Display names fall back to email-derived (Dev C / shell).                                                           | Backend: include `name`; then read it in role-context (lead).                                                             |
| 4   | **`PORT` hardcoded 3000** (ignores `process.env.PORT`) + **CORS fully open** (AUDIT §2/§3).                                                                                                                       | Deploy/config friction; prod CORS risk.                                                                             | Backend hardening: `process.env.PORT` fallback; restrict CORS origin for non-demo.                                        |
| 5   | **3 pre-existing TS errors** — `app.dashboard.tsx:71,85` and `app.trainings.$id.tsx:390` use hardcoded `/app/assessments/a1/...` links not matching the typed `$id` routes.                                       | `tsc --noEmit` not clean (build still green; runtime matches `$id="a1"`).                                           | Fix when those screens are wired (Dev B/C): use `params={{ id }}` form.                                                   |
| 6   | ~~**`EquivalentQuestionGroup` type missing**~~ — ✅ **DONE**: `EquivalentQuestionGroup` + `AssessmentResults` added to `src/types/models.ts`; `equivalentGroup?` added to `Question`.                                | Unblocks **Dev A** (equivalent groups) and **Dev B** (assessment results).                                          | Resolved by the lead (P0-2).                                                                                              |
| 7   | **Frontend create/edit UI gaps** (PART 1): Topic create/edit, LearningObjective create/edit, EquivalentGroup CRUD, id-bound Assessment edit.                                                                      | Dev A (topics/LO/equiv) and Dev B (assessment edit) must **build** these screens (backend endpoints already exist). | Build new forms/dialogs consistent with the design system; not a backend gap (except #6 type).                            |

> Hardening items (#1–#4) run in **parallel** with UI wiring and don't block A. Item #6 is
> a quick lead action that unblocks A's equivalent-groups slice.
