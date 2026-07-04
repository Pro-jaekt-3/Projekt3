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
