# AUDIT — Dev 2 & Dev 3 (branch `feat/db-v2-dev3`)

> READ-ONLY audit, 2026-07-06. Podlaga: `migration_docs/handoff_dev2_dev3`, `brief-dev2.md`,
> `brief-dev3.md`, `schema-v2-NOTES.md`, `docs/migration-plan.md`. Metoda: exhaustive grep
> (source, brez `node_modules`), branje kontrolerjev/route/sheme, inšpekcija generiranega
> Prisma klienta, `node --check` + module-load test backenda, `tsc -b` + `vite build`
> frontenda (build output preusmerjen izven repa). Brez sprememb kode; delovno drevo po
> auditu nespremenjeno (`git status`: samo predobstoječi `backups/`).
>
> Ocene: **PASS** / **FAIL** / **DELNO** / **NI PREVERJENO**. Dokazi kot `pot:vrstica`.

## Povzetek (TL;DR)

| Področje | Ocena |
|---|---|
| Dev 2 — LO odstranjen | **PASS** (kozmetični ostanek v `mock-data.ts`) |
| Dev 2 — EquivalenceGroup rename + scope + cleanup | **PASS** |
| Dev 2 — reviewedById odstranjen | **PASS** |
| Dev 2 — enumi nedotaknjeni | **PASS** |
| Dev 3 — pairing | **PASS** |
| Dev 3 — enrollment guard na /start | **PASS** |
| Dev 3 — grading endpoint + GRADED + score | **FAIL — endpoint ne obstaja, UI kliče v prazno** |
| Dev 3 — by-LO → by-topic | **PASS** |
| Dev 3 — en poskus (D) | **FAIL — runtime-pokvarjen `/start` (neobstoječ unique selector)** |
| Scoping — Dev 2 route | **PASS** |
| Scoping — Dev 3 assessment route | **FAIL — brez ownershipa, ADMIN ostal** |
| Scoping — Dev 3 analitika | **PASS** |
| Integracija — build/load | **PASS** (a glej kritični bug D3.5) |
| Destruktivni DROP-i | **PASS — jih ni** (shema ostaja aditivna) |

Kritični napaki sta dve, obe Dev 3: **(1)** grading backend sploh ni implementiran, čeprav
frontend UI nanj že kliče; **(2)** `startAttempt` uporablja Prisma compound-unique selector
`assessmentId_userId`, ki v fazi-0 shemi (namenoma) ne obstaja — **vsak `POST
/assessment-attempts/start` pade s 500**, torej nihče ne more začeti reševanja.

---

## 1. DEV 2 — Question bank

### 1.1 LearningObjective odstranjen povsod — **PASS** (z opombo)

- Backend datoteke izbrisane: `git diff main --name-status` → `D backend/controllers/learningObjectiveController.js`, `D backend/routes/learningObjectiveRoutes.js`. Mount odstranjen — `backend/server.js` nima nobenega `learning-objectives` (celotna datoteka, 43 vrstic).
- Grep `learningObjective|LearningObjective` po `backend/` (brez node_modules) zadene SAMO: `prisma/schema.prisma:49,99-101,312-320` (namerno — faza 0, cutover kasneje; glej §5), stare migracije, `schema.sql`, `ERD.svg`, `phase0/*` skripte. **Nič v živi kodi** (controllers/routes/middleware/seed = 0 zadetkov).
- `questionController.js:4-10` — `questionInclude` brez `learningObjective`; `aiController.js` 0 zadetkov; `seed.js` 0 zadetkov.
- Frontend: `D frontend-next/src/services/learningObjectives.ts`; grep po `frontend-next/src` zadene samo `src/lib/mock-data.ts:23,26` (lokalen mock tip `LearningObjective`, neodvisen od `types/models.ts`; uporablja ga samo mock dashboard). `query-keys.ts`, `models.ts`, `questions.ts`, `FilterBar.tsx`, vse analitične strani — čisto.
- **Opomba (kozmetično):** `mock-data.ts` ni bil počiščen. Brief Dev 2 ga ni izrecno naštel (naštel ga je `migration-plan.md:155`), tsc kljub temu prevede. Ni funkcionalen problem.

### 1.2 EquivalentQuestionGroup → EquivalenceGroup (rename + trainingId scope + cleanup) — **PASS**

- Rename datotek: `D .../equivalentQuestionGroupController.js` + `D .../equivalentQuestionGroupRoutes.js`, `A .../equivalenceGroupController.js` + `A .../equivalenceGroupRoutes.js`. Mount: `server.js:32` → `app.use("/equivalence-groups", ...)`.
- Grep `equivalentGroup|equivalentQuestionGroup` po backend živi kodi: 0 zadetkov (ostanki samo v shemi/migracijah/phase0 — namerno, faza 0).
- **trainingId scope ob create:** `equivalenceGroupController.js:47-62` — `trainingId` obvezen (400), `isTrainingOwner` → 404, zapiše `trainingId`.
- **Invarianta NOTES §5.4 pri addQuestionToGroup:** `equivalenceGroupController.js:157-162` — `question.topic.trainingId !== group.trainingId` → 409. Dodatno: vprašanje v drugi skupini → 409 (`:164-171`).
- **Cleanup praznih skupin:** `equivalenceGroupController.js:212-229` — `$transaction`: odklop, `count` preostalih, `remainingCount < 2` → `delete` skupine.
- `.name` → `.title` (nullable): controller `:60,91` (`title?.trim() || null`); `aiController.js:358` bere `.title ?? "(untitled)"`; frontend `models.ts:107` `title: string | null`, `models.ts:106` `trainingId: Id`.
- AI accept-flow pravilno ustvarja NOVO entiteto z obveznim `trainingId`: `aiController.js:813-817`.
- Frontend: `D services/equivalentGroups.ts`, `A services/equivalenceGroups.ts`; API poti se ujemajo z backend mountom (`equivalenceGroups.ts:21-54` → `/equivalence-groups...`); `questions.ts`, `app.questions.$id.tsx`, post-test wizard — vsi na `equivalenceGroup(Id)` (grep `equivalentGroup` po frontendu zadene samo interne UI route poti `/app/questions/equivalent-groups` + 2 komentarja).
- **Opomba (kozmetično):** stran `app.questions.equivalent-groups.tsx` ni bila preimenovana (UI pot ostaja `/app/questions/equivalent-groups`, `":47"`). To je interna SPA pot, ne API kontrakt; brief je datoteko naštel med "preimenuj", torej formalno DELNO — funkcionalno brez posledic.

### 1.3 reviewedById odstranjen (reviewedAt ostane) — **PASS**

- Grep `reviewedById` po backend živi kodi: 0 zadetkov (ostane samo `schema.prisma:106-107,178-179` — faza 0, cutover; + stare migracije/phase0).
- `questionController.js:259` — `data.reviewedAt = new Date()` OSTAJA, `reviewedById` pisanja ni.
- `aiController.js` — accept/reject piše `reviewedAt` (`:854`), `reviewedById` 0 zadetkov; `seed.js` 0 zadetkov.
- Frontend: grep `reviewedById` po `frontend-next/src` = **0 zadetkov** (popravljena oba podvojena `ReviewInteractionResult` tipa v `services/ai.ts` in `services/aiAuthoring.ts`).

### 1.4 Enum vrednosti nedotaknjene — **PASS**

`backend/prisma/schema.prisma:322-388`: vseh 9 starih enumov identičnih, vse vrednosti ohranjene —
`QuestionStatus` vklj. `NEEDS_REVIEW` IN `REVIEW` (`:328-335`), `AiAction` vseh 7 vklj.
`EDIT_QUESTION`/`GENERATE_SYNTHETIC_DATA` (`:337-345`), `AttemptStatus` vklj. `GRADED` (`:372-376`).
Dodan je samo nov `TrainingRole` (`:385-388`, aditivno). Ujema se s `schema-v2.prisma` §Enumi.

---

## 2. DEV 3 — Assessment / attempts / grading / pairing / analitika

### 2.1 Pairing (`pairedAssessmentId`) — **PASS**

- Validacija: `assessmentController.js:307-381` `validatePairedAssessment` — samo POST_TEST sme imeti par (`:319-328`), self-pair blokiran (`:343-348`), par mora obstajati (404, `:359-364`), **isti trainingId** (`:366-371`), **cilj mora biti PRE_TEST** (`:373-378`). Konvencija `POST.pairedAssessmentId = PRE.id` ✓.
- Uporabljeno v `createAssessment` (`:557-566,575-577`), `generateAssessment` (`:650-659,722-724`) in `updateAssessment` (`:826-836,845-847`).
- **Ekvivalenca pri generaciji post-testa (zaklenjena odločitev) — implementirana:** `buildPairedPostTestQuestions` (`:418-526`) iz vsake skupine pre-testa vzame največ enega člana (`usedGroupIds`, `:499,504,516`) in izbere **drugo** vprašanje kot v pre-testu (`id: { notIn: preQuestionIds }` `:476` + `item.id !== question.id` `:509`), scope na training + APPROVED (`:474-479`).
- Frontend dejansko pošlje par: `app.assessments.$id.post-test.tsx:260` — `pairedAssessmentId: selectedPre.id` v `assessmentsService.generate(...)`; tipi v `services/assessments.ts:41,50,59`.
- LO-filter iz `generateAssessment` odstranjen (grep `learningObjective` po datoteki = 0); dedup rename `equivalenceGroupId` ✓ (`:389`).
- NI PREVERJENO: dejanski zapis v bazo (audit brez zagona proti DB); statična pot je pravilna.

### 2.2 Enrollment guard na `/start` — **PASS**

- `assessmentAttemptRoutes.js:9-15` — `POST /start` gre skozi `requireEnrollment` (uvožen iz `scopeMiddleware`, `:7`); ADMIN umaknjen s `/start`.
- Controller uporabi rezultat guarda: `assessmentAttemptController.js:71-75` — `req.enrolledAssessment` + ujemanje id-ja, sicer 404.
- `requireEnrollment`/`assertEnrollment` (Dev 1): PUBLISHED + `UserTraining(PARTICIPANT)`, vsi neuspehi 404 (`scopeMiddleware.js:190-211,276-294`) ✓. `userId` iz `req.user` (`assessmentAttemptController.js:61`) ✓.

### 2.3 Grading endpoint + SUBMITTED→GRADED + preračun score — **FAIL (manjka v celoti)**

- Grep `grade|gradedById|gradedAt|GRADED` (case-insensitive) po `backend/` živi kodi: **noben controller/route ne piše `gradedById`/`gradedAt` in noben ne nastavi statusa `GRADED`**. Edini zadetki: shema/migracije, `seed.js:737` (statični seed status), komentarji v analitiki, in `assessmentController.js:210-229` (le bere `pointsAwarded` za statistiko).
- `assessmentAttemptRoutes.js` ima samo `/start`, `/:id/submit`, `/:id` — **route `PATCH /assessment-attempts/:attemptId/answers/:answerId/grade` ne obstaja**; `assessmentAttemptController.js` exporta samo `startAttempt, submitAttempt, getAttempt` (`:300-304`).
- Frontend UI pa je ožičen na neobstoječi endpoint: `services/assessmentAttempts.ts:82-96` (`gradeAnswer` → `PATCH /assessment-attempts/${attemptId}/answers/${answerId}/grade`) in `app.assessments.$id.results.tsx:330` — **vsak klik "grade" bo dobil 404** (Express brez route).
- Posledično tudi: noben poskus nikoli ne doseže `GRADED`, score se po ročni oceni ne preračuna (mrtvi status iz `pre-db-design.md` §3.5#3 ostaja mrtev), invarianta NOTES §5.6 ni implementirana.
- Dodatna posledica-v-čakanju: `getAssessmentResults` filtrira samo `status === "SUBMITTED"` (`assessmentController.js:177-179`) — ko bo grading nekoč obstajal, bodo GRADED poskusi izpadli iz rezultatov.

### 2.4 by-LO → by-topic — **PASS**

- Backend: `GET /analytics/by-learning-objective` ne obstaja; `analyticsRoutes.js:21` → `GET /by-topic` → `getAnalyticsByTopic` (`analyticsController.js:262-280`, agregacija po `question.topic`).
- Participant profil: LO strong/weak nadomeščen s topic — `analyticsController.js:701-727` (`topicPerformance`, `strongAreas.topics`, `weakAreas.topics`).
- LO-filter parsing odstranjen: `parseAnalyticsFilters` (`:50-57`) brez LO polja; grep `learningObjective` po datoteki = 0.
- Frontend: `services/analytics.ts:336-338` `byTopic` → `/analytics/by-topic`; uporabljeno v `app.analytics.tsx:60-62`, `app.results.tsx:45-47`, `app.system-analytics.tsx:45-47`, `app.trainings.$id.tsx:188-189`; `FilterBar.tsx` brez LO (grep = 0); `LearningObjectiveAnalytics` tip odstranjen.

### 2.5 En poskus na test na uporabnika (D) — **FAIL (logika obstaja, a je runtime-pokvarjena)**

- Namera pravilna: `assessmentAttemptController.js:77-90` — pred create preveri obstoječ poskus in vrne **409** (dovoljena produktna izbira "zavrni").
- **Ampak:** preverba uporablja `prisma.assessmentAttempt.findUnique({ where: { assessmentId_userId: {...} } })` (`:77-84`). Compound selector `assessmentId_userId` obstaja SAMO, če ima model `@@unique([assessmentId, userId])` — ta pa je v fazi 0 **namenoma izpuščen**: `backend/prisma/schema.prisma:260` — »`@@unique([assessmentId, userId]) NAMENOMA IZPUŠČEN v FAZI 0 (zahteva dedup — cutover)`«.
- Potrjeno na generiranem klientu: grep `assessmentId_userId` po `backend/node_modules/.prisma/client` = **0 zadetkov** (kontrolni grep `userId_trainingId` = 2 zadetka, torej metoda preverbe drži). Prisma bo ob klicu vrgel `PrismaClientValidationError` (Unknown argument), catch pa vrne 500.
- **Posledica: VSAK `POST /assessment-attempts/start` pade s 500 — udeleženci sploh ne morejo začeti reševanja.** Popravek je trivialen (`findFirst({ where: { assessmentId, userId } })`), a v READ-ONLY auditu ni bil izveden.
- To hkrati pomeni, da tudi DB-nivo ne varuje (unique pride šele s cutoverom) — kar je za fazo 0 pričakovano; app-preverba je pravilna strategija, samo napačen API klic.

---

## 3. SCOPING (uporaba Dev 1 modula)

### 3.1 Dev 2 route (question + equivalence) — **PASS**

- `questionRoutes.js:16-23`: vse `/:id` poti `requireRole("INSTRUCTOR")` + `requireOwnership("question")`; **ADMIN umaknjen** (komentar `:16`).
- `questionController.js:2,14-17` — `GET /` prek `scopedListWhere(req.user,"question")`, `null` → 403; `:91` — `POST /` prek `isTrainingOwner(topic.trainingId)` → 404. Točno po handoffu.
- `equivalenceGroupRoutes.js:17-26`: `router.use(requireRole("INSTRUCTOR"))` (ADMIN ven), `/:id` in `/:id/questions*` z `requireOwnership("equivalenceGroup")`; list/create scope-ana v controllerju (`equivalenceGroupController.js:6,53`).
- Scope logika je povsod UVOŽENA iz `middleware/scopeMiddleware`, ne podvojena (grep: edine definicije so v `scopeMiddleware.js`).

### 3.2 Dev 3 assessment route — **FAIL**

Handoff izrecno zahteva: `GET/PUT/DELETE /assessments/:id`, `PATCH /:id/status`, `GET /:id/results`,
`POST /generate` → `requireOwnership("assessment")`; `GET /assessments` → `scopedListWhere`
(instructor) + participant filter prek UserTraining; ADMIN umaknjen. Dejansko stanje:

- `assessmentRoutes.js:18-26` — **nobene** `requireOwnership` uporabe; **ADMIN je še vedno v `requireRole` na vseh vsebinskih poteh** (`:20,22-26`), v nasprotju z matriko vlog in vzorcem, ki sta ga Dev 1/Dev 2 že uveljavila na trainings/topics/questions/equivalence.
- `assessmentController.js:70-85` `getAssessments` — **brez `scopedListWhere`**: INSTRUCTOR (in ADMIN) dobi VSE assessmente vseh trenerjev (`where: undefined`); PARTICIPANT dobi vse PUBLISHED **brez** filtra na vpisane treninge (UserTraining se sploh ne uporabi). Enako `getAvailableAssessments` (`:87-105`).
- `getAssessment`/`getAssessmentResults`/`updateAssessment`/`updateAssessmentStatus`/`deleteAssessment`/`generateAssessment` — nobene lastniške preverbe (npr. `:107-132`, `:134-261`): katerikoli INSTRUCTOR lahko bere rezultate, ureja, briše in objavlja assessmente TUJIH treningov. `grep scopedListWhere|isTrainingOwner|requireOwnership` po `assessmentController.js` + `assessmentRoutes.js` = **0 zadetkov**.
- Posledica: lastniška izolacija (Dev 1 temelj) je na celotni assessment domeni preluknjana.

### 3.3 Dev 3 attempts + analitika — **DELNO / PASS**

- `/start`: PASS (glej §2.2; ADMIN umaknjen).
- `/:id/submit` in `GET /:id`: `requireRole("ADMIN","INSTRUCTOR","PARTICIPANT")` (`assessmentAttemptRoutes.js:16-17`) + `canAccessAttempt` (`assessmentAttemptController.js:46-56`), ki **kateremukoli** INSTRUCTOR/ADMIN dovoli dostop do kateregakoli poskusa (role-based, ne ownership) — podedovano staro vedenje, handoff tega sicer ni izrecno naštel, a odstopa od duha matrike (DELNO, nizka prioriteta).
- Analitika: **PASS** — vse route `requireRole("INSTRUCTOR")` brez ADMIN (`analyticsRoutes.js:21-33`); controller scope-a na lastniške treninge prek **uvoženega** `instructorTrainingIds` (`analyticsController.js:2,59-72`), uporabljeno v vseh handlerjih (`:264,284,428,447,496,561,617,747,794,911,1005`). Zahtevan `trainingId` izven lastništva se sesede v prazen seznam (`:62-64`) — pravilno.
- Podvojene scope logike ni: analitika gradi svoje `where` fragmente, a identiteto lastništva vedno črpa iz skupnega modula.

---

## 4. INTEGRACIJA

- **Merge ostanki:** grep `<<<<<<<|=======|>>>>>>>` po `backend/` + `frontend-next/` source = 0 zadetkov. **PASS**
- **Backend se naloži:** `node --check` čez `server.js`, vse controllers/routes/middleware/seed = OK; module-load test vseh 10 route modulov (`require(...)`) = OK. (Zagon `app.listen` + DB v read-only auditu nista bila izvedena — NI PREVERJENO end-to-end.) **PASS (statično)**
- **Frontend build:** `tsc -b --force` exit 0; `vite build` uspešen (✓ built in 23.39s; output preusmerjen v scratchpad, repo nedotaknjen). 22 tsc napak iz Dev 2 poročila (FilterBar, post-test, new) je Dev 3 očitno počistil. **PASS**
- **Ostanki klicev na odstranjena/preimenovana polja:** grep po živi kodi: `learningObjective*` = 0 (backend) / samo `mock-data.ts` (frontend); `equivalentGroup(Id)` = 0 / samo UI route poti + 2 komentarja; `reviewedById` = 0 / 0. **PASS**
- **Klic na neobstoječ endpoint (nasprotna smer):** frontend `gradeAnswer` kliče route, ki ga backend nima (glej §2.3) — edina kontraktna luknja. **FAIL**
- **Klic na neobstoječ Prisma selector:** `assessmentId_userId` (glej §2.5). **FAIL**
- **Seed (koordinacija z vodjo, ne strogo D2/D3):** `seed.js` NE seeda `UserTraining` (0 zadetkov), `enrollmentToken` (0) niti pairing demo para (`pairedAssessment` 0 zadetkov; brief-dev3 §Odvisnosti ga omenja). Posledica na sveže seedani bazi: instruktorji brez lastništva → scope-ane liste prazne / `requireOwnership` 404; participanti brez enrollmenta → `/start` 404 (še preden pade na §2.5 bug). Priporočilo za vodjo pred integracijskim testom.

---

## 5. ODSTOPANJA OD BRIEFOV + DESTRUKTIVNI DROP-i

### Destruktivni DROP-i — **PASS (jih ni)**

- `backend/prisma/schema.prisma` ostaja **aditivna faza-0 shema**: `LearningObjective` (`:312-320`), `EquivalentQuestionGroup` (`:303-310`), `Question.learningObjectiveId/reviewedById/equivalentGroupId` (`:99-113`), `AiInteraction.reviewedById` (`:178-179`), `AssessmentBlueprint` (`:216-226`) — vse še prisotno; glava datoteke (`:1-9`) to izrecno dokumentira.
- Edina nova migracija je aditivna: `prisma/migrations/20260704112500_additive_v2_phase0/migration.sql` (ADD COLUMN / CREATE TABLE / CREATE INDEX). Nobenega `DROP TABLE`/`DROP COLUMN` v `migrations/`.
- `prisma/phase0/04_drop_lo_data.sql` briše **podatke** (DELETE, transakcijsko, FK SET NULL), ne sheme — phase-0 artefakt vodje (dokumentiran v glavi skripte + `phase0/README.md`), ni delo Dev 2/3 in ni schema-DROP.
- `@@unique([assessmentId,userId])` pravilno NI uveljavljen (cutover) — a glej §2.5, koda ga napačno predpostavlja.

### Odstopanja (po resnosti)

1. **Dev 3 / grading v celoti manjka na backendu**, frontend UI pa je nanj že vezan (§2.3). Največje odstopanje od brief-dev3 §Attempts+Grading in done-kriterija.
2. **Dev 3 / `startAttempt` runtime bug** — en-poskus preverba prek neobstoječega unique selectorja; vsak `/start` → 500 (§2.5).
3. **Dev 3 / assessment scoping ni izveden** — brez `requireOwnership("assessment")`, brez `scopedListWhere`, ADMIN ostal na vseh assessment poteh; participant lista ni omejena na vpisane treninge (§3.2). Izrecna zahteva handoffa.
4. **Dev 3 / `canAccessAttempt`** ostaja role-based (katerikoli INSTRUCTOR vidi tuj poskus) — ni izrecno v briefu, a neskladno z matriko (§3.3).
5. **Dev 2 / `mock-data.ts`** ohranja lokalen LO mock tip (kozmetično; brief ga ni naštel) (§1.1).
6. **Dev 2 / `app.questions.equivalent-groups.tsx`** ni preimenovana (interna UI pot, kozmetično) (§1.2).
7. **Vodja / seed** brez `UserTraining`/`enrollmentToken`/pairing demo para — blokira smiselni ročni test celotne verige (§4).
8. **Vodja / `prisma-erd-generator`** zakomentiran v shemi (`schema.prisma:15-17`) — znano, dokumentirano v Dev 2 poročilu, odločitev odprta.
9. **Informativno:** `getAssessmentResults` šteje samo `SUBMITTED` (`assessmentController.js:177-179`) — ob uvedbi gradinga bodo GRADED poskusi izpadli iz rezultatov; popraviti skupaj z gradingom.

### NI PREVERJENO

- Runtime vedenje proti živi MySQL bazi (migracije/seed/endpointi niso bili zagnani — read-only audit; sklepi o §2.5 temeljijo na shemi + generiranem klientu, kar je za PrismaClientValidationError deterministično).
- Firebase auth tok in dejanske vloge testnih uporabnikov.
- Stanje podatkov v bazi po phase-0 skriptah (backup `backups/` obstaja kot untracked mapa, vsebina ni bila pregledana).
