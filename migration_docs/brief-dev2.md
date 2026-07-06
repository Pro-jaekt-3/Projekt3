# BRIEF — DEV 2: Question bank (ekvivalenca + odstranitev LO + review cleanup)

Lastnik question-bank domene in največjega tip-churna. `types/models.ts` je tvoj —
objavi ga zgodaj (publish-first), ker Dev 3 nanj veže. Ne odstranjuj enum vrednosti
(frontend jih tipsko pričakuje).

## Naloži pred delom
`schema-v2.prisma`, `schema-v2-NOTES.md`, `pre-db-design.md`, `migration-plan.md`, ta brief.
Čakaj na Fazo 0; od Dev 1 uvozi scoping helper za route-guarde svojih endpointov.

## Scope IN
1. **Odstranitev `LearningObjective` (celoten model):**
   - Izbriši `routes/learningObjectiveRoutes.js`, `controllers/learningObjectiveController.js`;
     odstrani require+mount v `server.js` *(mount edit koordiniraj z vodjo)*.
   - `questionController.js`: odstrani `learningObjective` iz `questionInclude`, iz create/update
     destructure in data (`:5,52,86,117,183`).
   - `aiController.js`: odstrani vse `learningObjective*` (prompt interpolacija, include, draft
     persist — `:18,63,75,359-361,527,640,695,838`).
   - Seed: odstrani LO-helper + 7 klicev.
2. **`EquivalentQuestionGroup` → `EquivalenceGroup` (preimenuj + scope + cleanup):**
   - Preimenuj `controllers/equivalentQuestionGroupController.js` + routes; vse
     `prisma.equivalentQuestionGroup.*` → `prisma.equivalenceGroup.*`.
   - **Dodaj `trainingId` scope:** ob `create` izpelji training (iz konteksta/parametra ali prve
     dodane question); pri `addQuestionToGroup` uveljavi `question.topic.trainingId ===
     group.trainingId` (invarianta NOTES §5.4).
   - **Čiščenje:** pri `removeQuestionFromGroup` po odstranitvi preveri `memberCount<2` in po
     potrebi izbriši prazno skupino (naslavlja živo anomalijo, `pre-db-design.md` §3.5#1).
   - `.name` → `.title` (opcijsko, nullable) — preimenuj VSA branja/pisanja te lastnosti.
   - Mount `/equivalent-question-groups` → `/equivalence-groups` *(z vodjo)*.
   - `questionController.js`: `equivalentGroup(Id)` → `equivalenceGroup(Id)` v include/create/update.
   - `aiController.js`: equiv reference (`:363-365,528,641,818-841,875-876`) → nova imena.
   - Seed: preimenuj helper + klice.
3. **Odstranitev `reviewedById` (obdrži `reviewedAt`):**
   - `questionController.js:243` — odstrani pisanje `data.reviewedById` v `PATCH /questions/:id/status`.
   - `aiController.js:860,872,884,892` — odstrani `reviewedById` iz accept/reject + response DTO.
   - Seed: odstrani `reviewedById` na Question/AiInteraction klicih.

## Frontend (tvoj)
- **Odstrani (LO):** `services/learningObjectives.ts`, `query-keys.ts:27`, LO tipi v `models.ts`,
  LO polja v `services/questions.ts`; LO UI na question straneh (`app.questions.$id.tsx` LO-dropdown).
  *(LO-filter na assessment/analytics straneh je Dev 3 — ne posegaj tja.)*
- **Preimenuj (equiv):** `services/equivalentGroups.ts` → `equivalenceGroups.ts` (+ endpoint-poti);
  `app.questions.equivalent-groups.tsx`; equiv panel v `app.questions.$id.tsx`; tipi v `models.ts`
  (`.name`→`.title`, nullability).
- **Odstrani (reviewedById):** `models.ts:87,186`; **oba** podvojena tipa `ReviewInteractionResult`
  v `services/ai.ts:117` IN `services/aiAuthoring.ts:141`.

## `types/models.ts` (tvoj, publish-first)
Ti si lastnik tega fajla. Objavi spremembe zgodaj (LO removal + equiv rename + reviewedById removal),
da Dev 3 rebase-a. **Ne odstranjuj enum vrednosti** — vse ostanejo (NOTES §4, `pre-db-design.md` §6.3).

## Odvisnosti
- Čakaš: Faza 0; Dev 1 scoping helper (za guarde tvojih question/equiv endpointov — INSTRUCTOR scope).
- Objaviš prvi: `types/models.ts`.
- Koordinacija z vodjo: `server.js` mount editi, `seed.js`.

## Done-kriterij
LO popolnoma odstranjen (backend+frontend); equivalence preimenovan, scope-an na training, brez
praznih skupin; `reviewedById` odstranjen povsod (reviewedAt ostane); question/AI CRUD dela na novih
poljih; enum vrednosti nedotaknjene.

---

## Dev 2 Completion Report

Branch: `feat/db-v2-dev2`. All four tasks complete. TSC clean on Dev 2-owned files (22 remaining
errors are all in Dev 3 files — see §Dev 3 below).

### Changed files (git diff vs main)

**Backend — deleted:**
- `backend/controllers/equivalentQuestionGroupController.js`
- `backend/controllers/learningObjectiveController.js`
- `backend/routes/equivalentQuestionGroupRoutes.js`
- `backend/routes/learningObjectiveRoutes.js`

**Backend — created:**
- `backend/controllers/equivalenceGroupController.js`
- `backend/routes/equivalenceGroupRoutes.js`

**Backend — modified:**
- `backend/controllers/aiController.js`
- `backend/controllers/analyticsController.js` *(scope note added — see §Lead below)*
- `backend/controllers/assessmentController.js` *(one-line equiv rename — see §Dev 3 below)*
- `backend/controllers/questionController.js`
- `backend/prisma/schema.prisma` *(ERD generator commented out — see §Lead below)*
- `backend/prisma/seed.js`
- `backend/routes/analyticsRoutes.js` *(scope note added)*
- `backend/routes/questionRoutes.js`
- `backend/server.js`

**Frontend — deleted:**
- `frontend-next/src/services/equivalentGroups.ts`
- `frontend-next/src/services/learningObjectives.ts`

**Frontend — created:**
- `frontend-next/src/services/equivalenceGroups.ts`

**Frontend — modified:**
- `frontend-next/src/lib/query-keys.ts`
- `frontend-next/src/routes/app.questions.$id.tsx`
- `frontend-next/src/routes/app.questions.equivalent-groups.tsx`
- `frontend-next/src/services/ai.ts`
- `frontend-next/src/services/aiAuthoring.ts`
- `frontend-next/src/services/questions.ts`
- `frontend-next/src/types/models.ts`

*All other files in `git diff main --name-only` (topicController, trainingController,
userTrainingController, scopeMiddleware, training/topic routes, SidebarNav, app.join,
app.trainings.*, app.trainings.index, trainings.ts, userTrainings.ts, enums.ts, phase0 scripts,
migration 20260704*, routeTree.gen.ts) are Dev 1 changes inherited from the branch base — not
modified by Dev 2.*

### Task 1 — types/models.ts
- Removed: `LearningObjective` interface; `learningObjectiveId` and `learningObjective?` from
  `Question`; `reviewedById` from `Question` and `AiInteraction`; `equivalentGroupId` and
  `equivalentGroup?` from `Question`; `EquivalentQuestionGroup` interface.
- Added/renamed: `EquivalenceGroup` with `trainingId: Id` and `title: string | null`; `equivalenceGroupId?`
  and `equivalenceGroup?` on `Question`.
- No enum values removed.

### Task 2 — LearningObjective removal (backend + frontend)
- Deleted `learningObjectiveController.js`, `learningObjectiveRoutes.js`; removed mount from `server.js`.
- `questionController.js`: removed `learningObjective` from `questionInclude`, create/update.
- `aiController.js`: removed all `learningObjective*` references (prompt, include, draft persist).
- `seed.js`: removed LO helper and all 7 call sites.
- Frontend: deleted `services/learningObjectives.ts`; removed `learningObjectives` key from
  `query-keys.ts`; removed LO types from `models.ts`; removed `learningObjectiveId?` from
  `services/questions.ts`; removed LO dropdown from `app.questions.$id.tsx`.

### Task 3 — EquivalentQuestionGroup → EquivalenceGroup
- Deleted old controller+routes; created `equivalenceGroupController.js` + `equivalenceGroupRoutes.js`.
- `server.js`: `/equivalent-question-groups` → `/equivalence-groups`.
- All `prisma.equivalentQuestionGroup.*` → `prisma.equivalenceGroup.*`; `.name` → `.title` (nullable).
- `createEquivalenceGroup`: `isTrainingOwner` check on `trainingId` (required field, 404 if not owner).
- `addQuestionToGroup`: fetches question with `include: { topic: true }`; enforces
  `question.topic.trainingId === group.trainingId` → 409 (invariant NOTES §5.4).
- `removeQuestionFromGroup`: `$transaction` — clears `equivalenceGroupId`, counts remaining members,
  auto-deletes group if `remainingCount < 2` (fixes pre-db-design.md §3.5#1 live anomaly).
- `questionController.js`, `aiController.js`, `seed.js`: all equiv field/model references updated.
- Frontend: deleted `equivalentGroups.ts`; created `equivalenceGroups.ts`; rewrote
  `app.questions.equivalent-groups.tsx` (training selector added, title nullable); updated
  `app.questions.$id.tsx` (service import, all field refs, `name`→`title ?? "(untitled)"`).

### Task 4 — reviewedById removal
- `questionController.js`: removed `data.reviewedById = Number(req.user.id)` in `updateQuestionStatus`;
  `data.reviewedAt = new Date()` kept.
- `aiController.js`: removed `reviewedById: reviewerId` from `tx.aiInteraction.update` (accept-flow)
  and from the non-transactional update; removed `reviewedById: interaction.reviewedById` from both
  response objects.
- `seed.js`: removed `reviewedById` from `findOrCreateQuestion` and `findOrCreateAiInteraction`
  params+data, and from all 8 question call sites and 2 AI interaction call sites.
- `services/ai.ts` + `services/aiAuthoring.ts`: removed `reviewedById: number` from both
  `ReviewInteractionResult` interfaces.

### Route guards (per handoff_dev2_dev3)
- `GET /questions`: `scopedListWhere(req.user, "question")` in controller → 403 if null.
- `POST /questions`: `isTrainingOwner(req.user.id, topic.trainingId)` in controller → 404 if not owner.
- `GET/PUT/DELETE /questions/:id`, `PATCH /questions/:id/status`: `requireRole("INSTRUCTOR")` +
  `requireOwnership("question")`.
- `GET /equivalence-groups`: `scopedListWhere(req.user, "equivalenceGroup")` in controller → 403 if null.
- `POST /equivalence-groups`: `isTrainingOwner` in controller.
- `GET/PUT/DELETE /equivalence-groups/:id`, `POST/DELETE /:id/questions/*`:
  `requireOwnership("equivalenceGroup")`.
- ADMIN removed from all question and equivalence-group content routes.

### Dev 3 — must fix on rebase

**22 tsc errors in 3 files (all Dev 3-owned):**

1. `src/components/analytics/FilterBar.tsx` (5 errors):
   - `@/services/learningObjectives` deleted — remove import.
   - `queryKeys.learningObjectives` removed — update or remove query usage.

2. `src/routes/app.assessments.$id.post-test.tsx` (11 errors):
   - Same LO import/queryKey fixes as above.
   - `question.equivalentGroupId` → `question.equivalenceGroupId` (5 occurrences, lines 199–215).

3. `src/routes/app.assessments.new.tsx` (6 errors):
   - Same LO import/queryKey/type fixes.
   - `question.equivalentGroup` → `question.equivalenceGroup` (lines 869, 871).
   - `question.learningObjective` → remove or replace (line 862).

**analyticsController.js** — LO analytics code (filter, include, `getAnalyticsByLearningObjective`
handler, LO sections in `getParticipantProfile`, LO include in `getQuestionOptionDistribution`) was
removed during Task 2 (out of Dev 2 scope). Scope note at top of file describes exactly what was
removed. Dev 3 must implement the by-topic replacement for `getAnalyticsByLearningObjective` and
re-add the corresponding route (`GET /analytics/by-topic`) in `analyticsRoutes.js`.

**assessmentController.js** — `question.equivalentGroupId` → `question.equivalenceGroupId` (one
line, ~line 419 in original) already applied during Task 3. No further action needed; just awareness
that this one-line change is committed in this branch.

### Lead — one issue

**`backend/prisma/schema.prisma` — `prisma-erd-generator` block commented out.**
The generator was configured in the schema but the package is absent from `backend/package.json`
(never installed). It caused `prisma generate` to fail with `spawn prisma-erd-generator ENOENT`.
Commented out the block to unblock client regeneration. Decision needed: install the package and
add it to `package.json`, or remove the generator block entirely.
