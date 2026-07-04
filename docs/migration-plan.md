# MIGRATION PLAN — schema.prisma → schema-v2.prisma

> Strogo READ-ONLY change-impact analiza. Brez migracij, brez urejanja kode/sheme, brez commitov.
> Vir #1: dejanski diff `backend/prisma/schema.prisma` (trenutna) proti `backend/prisma/schema-v2.prisma`
> (predlog), izračunan polje-za-poljem, ne prepisan iz `docs/schema-v2-NOTES.md`. Vir #2:
> exhaustive grep (`backend/`, `frontend-next/`, source only — brez `node_modules`/`dist`/`build`/
> `.next`) za vsako spremenjeno ime/polje. Vir #3: `docs/pre-db-design.md` (predhodni read-only audit,
> 2026-07-04) za live-podatkovno stanje in znane vrzeli. `frontend/` (stara CRA varianta) je
> potrjeno mrtva/referenčna (`pre-db-design.md` §1.3 — brez live importov iz `frontend-next/`) in ni
> del tega načrta, razen kjer je izrecno omenjena kot informativna opomba.
>
> Kjer gotovosti ni, je to označeno **NI PREVERJENO** s konkretnim korakom za preverbo.

---

## 1. SHEMA DIFF (izračunan iz obeh `.prisma` datotek)

### User
| Sprememba | Tip |
|---|---|
| `+ createdAt`, `+ updatedAt` | ADDITIVNO |
| `+ trainingMemberships UserTraining[]` | ADDITIVNO (nova relacija na nov model) |
| `+ gradedAnswers ParticipantAnswer[] @relation("AnswerGradedBy")` | ADDITIVNO |
| `- reviewedQuestions Question[] @relation("QuestionReviewedBy")` | RUŠILNO (posledica odstranitve `Question.reviewedById`) |
| `- reviewedAiInteractions AiInteraction[] @relation("AiInteractionReviewedBy")` | RUŠILNO (posledica odstranitve `AiInteraction.reviewedById`) |

### Training
| Sprememba | Tip |
|---|---|
| `+ enrollmentToken String? @unique` | ADDITIVNO |
| `+ members UserTraining[]` | ADDITIVNO |
| `+ equivalenceGroups EquivalenceGroup[]` | ADDITIVNO |
| `- assessmentBlueprints AssessmentBlueprint[]` | RUŠILNO za shemo (tabela odstranjena), a **brez API-vpliva** (glej §2.5) |

### UserTraining — [NOVO]
Celoten model nov: `id, userId→User, trainingId→Training, role TrainingRole, enrolledAt`.
`@@unique([userId,trainingId])`, `@@index([trainingId, role])`. ADDITIVNO — brez imenske kolizije
v kodi (potrjeno grep, glej §2.7).

### Topic
| Sprememba | Tip |
|---|---|
| `+ createdAt`, `+ updatedAt` | ADDITIVNO |
| `- learningObjectives LearningObjective[]` | RUŠILNO (posledica odstranitve celega modela `LearningObjective`) |

### Question
| Sprememba | Tip |
|---|---|
| `description String` → `description String @db.Text` | ADDITIVNO (širitev VARCHAR(191)→TEXT, brez izgube) |
| `- learningObjectiveId Int?`, `- learningObjective LearningObjective?` | RUŠILNO |
| `- reviewedById Int?`, `- reviewedBy User?` (relacija) | RUŠILNO — `reviewedAt` OSTANE |
| `equivalentGroupId Int?` → **preimenovano** `equivalenceGroupId Int?`, cilj `EquivalentQuestionGroup?` → `EquivalenceGroup?` | RUŠILNO + BACKFILL |
| `+ createdAt`, `+ updatedAt` | ADDITIVNO |
| `+ @@index([status, topicId])` | ADDITIVNO |
| `@@index([equivalentGroupId])` → `@@index([equivalenceGroupId])` | posledica rename, nevtralno |

### EquivalentQuestionGroup → EquivalenceGroup — **rušilno tudi mimo preimenovanja polja**
Poleg preimenovanja modela in dodane `trainingId` (scope), izračunan diff pokaže še:
- `name String` (obvezno) → `title String?` (**opcijsko, preimenovano polje samo, ne le model**).
  To NI omenjeno eksplicitno v `docs/schema-v2-NOTES.md` §2 (ta govori le o modelu kot celoti) —
  je pa dejanska, ločena rušilna sprememba: vsako mesto, ki bere/piše `.name` na tej entiteti, se
  mora preimenovati v `.title` IN obravnavati možen `null`.
- `+ trainingId Int`, `+ training Training @relation(...)`, `+ @@index([trainingId])` — ADDITIVNO/nova zahteva (scope).
- `description`, `createdAt`, `updatedAt`, `questions Question[]` — nespremenjeno po pomenu.

### AnswerOption
Brez razlik — identičen model v obeh shemah (edina kozmetična razlika v `ParticipantAnswer.selectedOption`,
glej spodaj).

### Assessment
| Sprememba | Tip |
|---|---|
| `+ pairedAssessmentId Int? @unique`, `+ pairedAssessment Assessment? @relation("AssessmentPairing", onDelete:SetNull)`, `+ pairedBy Assessment? @relation("AssessmentPairing")` | ADDITIVNO (self 1:1 relacija) |
| `+ @@index([status, trainingId])` | ADDITIVNO |

### AssessmentBlueprint — [ODSTRANJENO]
Celoten model odstranjen. RUŠILNO za shemo/podatke, a glede na grep **brez vpliva na API-kontrakt**
(noben controller/route ga ne uporablja — glej §2.5).

### AssessmentQuestion
Brez razlik — identičen model.

### AssessmentAttempt
| Sprememba | Tip |
|---|---|
| `userId Int?` + `onDelete: SetNull` → `userId Int` (NOT NULL) + privzeti `RESTRICT` | RUŠILNO + BACKFILL |
| `+ @@unique([assessmentId, userId])` | RUŠILNO + BACKFILL (zahteva dedup obstoječih večkratnih poskusov) |

### ParticipantAnswer
| Sprememba | Tip |
|---|---|
| `answerText String?` → `answerText String? @db.Text` | ADDITIVNO |
| `+ gradedById Int?`, `+ gradedBy User? @relation("AnswerGradedBy", onDelete:SetNull)`, `+ gradedAt DateTime?` | ADDITIVNO |
| `+ @@index([gradedById])` | ADDITIVNO |
| `selectedOption AnswerOption? @relation(...)` → isto, a zdaj eksplicitno `onDelete: SetNull` | kozmetično — samo eksplicira obstoječe DB-vedenje (migracija `20260529093610` že ima `SET NULL`), brez dejanske spremembe |

### AiModel
Brez razlik.

### AiInteraction
| Sprememba | Tip |
|---|---|
| `- reviewedById Int?`, `- reviewedBy User?` (relacija) | RUŠILNO — `reviewStatus` + `reviewedAt` OSTANETA |
| `- @@index([reviewedById])` | posledica zgornjega |

### LearningObjective — [ODSTRANJENO]
Celoten model odstranjen. RUŠILNO.

### Enumi
- `+ TrainingRole { INSTRUCTOR, PARTICIPANT }` — ADDITIVNO, nov enum.
- Vseh 9 obstoječih enumov (`UserRole, QuestionType, QuestionStatus, AiAction, AiReviewStatus,
  AiProvider, AssessmentType, AssessmentStatus, AttemptStatus`) — **identični, vse vrednosti
  ohranjene** (potrjeno primerjava vrstico-za-vrstico obeh datotek). Brez sprememb.

---

## 2. PO ENTITETAH — prizadete datoteke (vrstice iz svežega grepa nad trenutnim stanjem repozitorija)

### 2.1 `Question.learningObjectiveId` / `learningObjective` + model `LearningObjective` (RUŠILNO)

**Backend — datoteke za polno brisanje:**
- `backend/routes/learningObjectiveRoutes.js` (celotna datoteka)
- `backend/controllers/learningObjectiveController.js` (celotna datoteka)
- `backend/server.js:9` (require), `:32` (`app.use("/learning-objectives", ...)`)

**Backend — Question CRUD (osiromašen include/DTO):**
- `backend/controllers/questionController.js:5` — `learningObjective: true` v skupnem `questionInclude`
- `:52` create-destructure `learningObjectiveId`, `:86` prisma `create` data
- `:117` update-destructure, `:183` pogojni spread v `update` data

**Backend — Assessment generacija (filter po LO):**
- `backend/controllers/assessmentController.js:359` destructure filtra, `:401-402` pogojni filter po `learningObjectiveId` v post-test/generate poizvedbi

**Backend — AI authoring (LO kot vhod v prompt in v drafte):**
- `backend/controllers/aiController.js:18` (required-fields list), `:63,75` (prompt interpolacija),
  `:359-361` (explain-prompt bere `question.learningObjective?.title/.description`), `:527,640`
  (dva ločena `include: { learningObjective: true }`), `:695` (equivalent-draft), `:838` (persist draft)

**Backend — Analytics (celoten "by-LO" endpoint + strong/weak areas):**
- `backend/routes/analyticsRoutes.js:5,23` — `GET /analytics/by-learning-objective`
- `backend/controllers/analyticsController.js:52,85-86,138` (filter/include), `:267-278`
  (`getAnalyticsByLearningObjective` handler), `:688-720` (per-question `learningObjectivePerformance`,
  strong/weak areas na participant profilu), `:998,1044` (per-question analytics include), `:1065` (export)

**Backend — seed:** `backend/prisma/seed.js:26-50` (helper `findOrCreateLearningObjective`),
`:66,84` (threaded param), `:438,444` (2 klica), `:465,478,491,505,530,567,583` (7× `learningObjectiveId`
na seed-vprašanjih), `:736-744` (array na drugi entiteti)

**Frontend-next — datoteka za polno brisanje:**
- `frontend-next/src/services/learningObjectives.ts` (celotna datoteka)

**Frontend-next — tipi:**
- `src/types/models.ts:55` (`Topic.learningObjectives?`), `:59` (`interface LearningObjective`),
  `:85,93` (`Question.learningObjectiveId`, `.learningObjective`)
- `src/lib/mock-data.ts:23,26` (ločen mock-tip, neodvisen od `models.ts`)
- `src/lib/query-keys.ts:27` — `learningObjectives: entityKeys("learning-objectives")`
- `src/services/questions.ts:8,34,45` — DTO polja + doc-komentar

**Frontend-next — komponente/strani:**
- `src/routes/app.questions.$id.tsx:48,104-105,118,133,246-247,546,564-565,591-592,730` — cel LO-dropdown
  v question-formi + AI-prompt payload
- `src/routes/app.assessments.new.tsx:28,31,64-65,79,147,154,178-180,186,194,203,236-237,244,546,630,714-715,862`
  — LO-filter v assessment builderju
- `src/routes/app.assessments.$id.post-test.tsx:42,47,107,125-126,240-245,252,260,285-286,569,588,590,1099,1107,1116`
  — LO-filter v post-test wizardu
- `src/routes/app.trainings.$id.tsx:79,86,172-173,180,247,251,297,308,313,319,328,330-331,864-865`
  — celoten LO CRUD-UI (create/edit/delete dialog) + prikaz naslova pri vprašanjih
- `src/lib/analytics-filters.ts:21,30,39,46` — LO-filter v zod shemi analitike
- `src/components/analytics/FilterBar.tsx:15,61-62,89,94,96,154` — LO-filter dropdown na vseh analitičnih straneh
- `src/services/analytics.ts:9,21,36,76,97-99,158,185-186,217,220,224,316,366-369` — cel
  `LearningObjectiveAnalytics` tip + `analyticsService.byLearningObjective(...)` klic
- `src/routes/app.analytics.tsx:26,66-67,149,319-320,332`
- `src/routes/app.results.tsx:50-51,249,251,266`
- `src/routes/app.question-analysis.tsx:119,227`
- `src/routes/app.participants.$userId.tsx:250,258,318-319`
- `src/services/aiAuthoring.ts:16,25,47,96` — AI draft request/response tipi

**Migracije/DDL (samo za referenco, ne za ročno urejanje):**
`backend/schema.sql:45,204,220,277`; `backend/prisma/migrations/20260523144650_.../migration.sql`,
`20260527133000_.../migration.sql`; `backend/prisma/ERD.svg` (regenerira se sam).

---

### 2.2 `equivalentGroupId` → `equivalenceGroupId` + `EquivalentQuestionGroup` → `EquivalenceGroup` (RUŠILNO + BACKFILL)

**Backend — datoteke za polno prepisovanje (ne brisanje — funkcionalnost ostane, entiteta se preimenuje in scope-a):**
- `backend/routes/equivalentQuestionGroupRoutes.js` (celotna datoteka — poti in ime datoteke naj se uskladita z novim imenom)
- `backend/controllers/equivalentQuestionGroupController.js` (celotna datoteka, 7 handlerjev — vsi CRUD +
  `addQuestionToGroup`/`removeQuestionFromGroup` berejo/pišejo `equivalentGroupId` na L146,151-152,155,162,192,201)
- `backend/server.js:11,34` — require + mount `/equivalent-question-groups`

**Backend — Question CRUD:**
- `backend/controllers/questionController.js:6` (`equivalentGroup: true` v `questionInclude`),
  `:53,87` (create), `:118,184` (update)

**Backend — AI authoring:**
- `backend/controllers/aiController.js:363-365` (prompt bere `.equivalentGroup.name`), `:528,641`
  (dva include), `:818,821-822,827,841` (resolve/create/backfill group pri AI-equivalent generaciji),
  `:875-876` (response DTO)

**Backend — Assessment generacija (dedup pravilo — kritično za app-invarianto §3.5.4 spodaj):**
- `backend/controllers/assessmentController.js:423-433` — `groupId = question.equivalentGroupId`,
  dedup-set `selectedGroupIds`, overflow fallback

**Backend — seed:**
- `backend/prisma/seed.js:70,88` (question helper param/data), `:131-153` (helper
  `findOrCreateEquivalentQuestionGroup`), `:453-456,495,534,571` (1 skupina + 3 povezana vprašanja)

**Frontend-next — datoteka za preimenovanje/prepis:**
- `src/services/equivalentGroups.ts` (celotna datoteka — `equivalentGroupsService`, `equivalentGroupsKeys`)
- `src/routes/app.questions.equivalent-groups.tsx` (celotna stran za upravljanje skupin)

**Frontend-next — tipi:**
- `src/types/models.ts:89,94` (`Question.equivalentGroupId/.equivalentGroup`), `:97-105`
  (`interface EquivalentQuestionGroup { name, ... }` — **tudi `.name`→`.title` rename tu**)
- `src/services/questions.ts:8,35,46`

**Frontend-next — komponente:**
- `src/routes/app.questions.$id.tsx:49,108-110,121,183,186,195-196,201,420-427,434,437,439-446,459-463,586,792,794,801,820-822`
  — cel "Equivalent group" panel + AI equivalence-accept flow (konflikt-preverba `hasGroupConflict`)
- `src/routes/app.assessments.new.tsx:869,871` — badge `q.equivalentGroup.name` v question-picker
- `src/routes/app.assessments.$id.post-test.tsx:196-224,430,660,762-764` — **`groupedVariants`,
  `variantCandidatesByQuestionId`, `missingVariantQuestions`** (glej tudi §3.4.4 in §7 — backend te
  poravnave danes ne uveljavlja, po preimenovanju polja frontend logika ostane po pomenu enaka, a
  vsa mesta `question.equivalentGroupId` je treba preimenovati)
- `src/routeTree.gen.ts` — auto-generiran, regenerira se sam ob build-u (ni ročno urejanje)

**Migracije/DDL (referenca):** `backend/schema.sql:49,51,193-201,229`;
`backend/prisma/migrations/20260528130000_.../migration.sql`; `backend/prisma/ERD.svg`.

**Izven scope-a (informativno):** `frontend/src/services/equivalentGroupService.ts`,
`frontend/src/pages/EquivalentGroupsPage.tsx`, `frontend/src/pages/QuestionsPage.tsx`,
`frontend/src/pages/TrainingDetailPage.tsx`, `frontend/src/services/questionService.ts` — stara,
neaktivna CRA-varianta (potrjeno mrtva, glej memo na vrhu); ni treba popravljati, a če bi jo kdo
kdaj znova zagnal proti istemu API-ju, bi se zlomila identično.

---

### 2.3 `Question.reviewedById` / `reviewedBy` (RUŠILNO — `reviewedAt` ostane)

- `backend/controllers/questionController.js:243` — edino pisalno mesto: `data.reviewedById = Number(req.user.id)` znotraj `PATCH /questions/:id/status`, ob `APPROVED`/`REJECTED`
- `backend/prisma/seed.js:68,86` (helper param/data), `:467,480,493,507,519,532,569,585` (8× seed-klic)
- `src/types/models.ts:87` — `reviewedById: Id | null` na `Question`
- **Brez frontend prikaza** populiranega `reviewedBy` objekta (nihče ne bere relacije, samo skalar) —
  odstranitev je za UI neopazna razen tipa.

### 2.4 `AiInteraction.reviewedById` / `reviewedBy` (RUŠILNO — `reviewStatus`+`reviewedAt` ostaneta)

- `backend/controllers/aiController.js:860,884` — pisanje `reviewedById: reviewerId` v accept/reject
  tranzakcijah; `:872,892` — echo nazaj v response DTO
- `backend/prisma/seed.js:319,341` (helper), `:659,680,704` (3× seed-klic)
- `src/types/models.ts:186` — `reviewedById: Id | null` na `AiInteraction`
- **Podvojen frontend tip** — `src/services/ai.ts:117` IN `src/services/aiAuthoring.ts:141` obe
  definirata `interface ReviewInteractionResult { reviewedById: number; ... }` neodvisno — obe je treba
  popraviti (obstoječa arhitekturna vrzel, dokumentirana tudi v `pre-db-design.md` §10.2 kot podvojena AI-servisna plast)

### 2.5 `AssessmentBlueprint` (RUŠILNO za shemo, brez API-vpliva)

- **Backend:** edine reference so `backend/prisma/seed.js:201-231` (helper `findOrCreateAssessmentBlueprint`
  + upsert) in `:717-720` (1 klic ob seedanju). **Noben controller/route ga ne uporablja** (potrjeno
  grep čez vseh 11 route/controller datotek — 0 zadetkov).
- **Frontend-next:** 0 zadetkov v `src/services/*` in `src/types/*` — noben servis/tip ga nikoli ni
  predstavljal. Vsa UI-besedila "blueprint" (`app.assessments.new.tsx:333,354,383,414,644`,
  `app.assessments.$id.post-test.tsx:57,514,522,526,530,534,856,934`, `app.trainings.$id.tsx:677`,
  `routes/index.tsx:118`) so **kozmetične oznake korakov/kartic**, vezane na resnične `Topic`/
  `Question`/`Assessment` podatke, ne na to tabelo — brisanje modela je varno.
- **Edini potreben poseg:** odstraniti helper + klic iz `seed.js`.

### 2.6 `AssessmentAttempt.userId` NOT NULL + `@@unique([assessmentId,userId])` (RUŠILNO + BACKFILL)

- `backend/controllers/assessmentAttemptController.js:40` — `serializeAttempt`: `participantId: attempt.userId ?? null` (null-safe, ostane veljavno tudi po NOT NULL — neškodljivo)
- `:46-56` — `canAccessAttempt` (self-ali-manager preverba)
- `:58-107` `startAttempt` — `:60-61` `participantId = req.user?.id ?? null`, `:67-69` **že danes
  vrne 401, če ni avtenticiranega uporabnika** — torej `userId` v praksi NIKOLI ni null pri kreaciji
  prek API-ja (nullability je bila dodana samo za primer kasnejšega brisanja Uporabnika,
  `onDelete:SetNull`, migracija `20260601202013_make_attempt_user_nullable`). **Brez preverbe "en
  poskus na assessment na uporabnika"** pred `create` (`:94-101`) — potrjena vrzel, 0 zadetkov za
  tako preverbo kjerkoli v `backend/`.
- `backend/controllers/analyticsController.js:342-344,364-369,573-575,791,816-829` — več mest z
  eksplicitnim `userId: {not: null}` filtrom ali `?.` na `attempt.user` — po NOT NULL migraciji ta
  koda ostane pravilna (le odvečno defenzivna), sprememba ni obvezna.
- `src/types/models.ts:149-151` — `userId: Id | null` + `participantId?: Id | null` alias — po
  backendovi spremembi bi tip lahko postal `Id` (ne `| null`), a ni nujno (širši tip je varen nadtip).
- `src/routes/app.assessments.$id.results.tsx:213,215` — `attempt.user?.name ?? "Unknown participant"`
  — edini UI, ki dejansko računa na možen manjkajoč `user` (npr. če je uporabnik izbrisan); po
  `RESTRICT` migraciji brisanje Uporabnika z obstoječimi poskusi ne bo več mogoče (FK bo blokiral) —
  ta fallback ostane neškodljiva mrtva veja.
- `src/lib/attempt-storage.ts:1-39` — localStorage shim, ki si zapomni **samo zadnji** attemptId na
  assessment na brskalnik (ne na backend) — po backfillu (obdrži zadnji oddani poskus) se ta shim
  ujema s pravilom "en poskus na uporabnika", a ostaja ločen, neizprašan client-side mehanizem (glej
  odprto vprašanje NOTES §7).

### 2.7 Novi identifikatorji — preverba imenske kolizije (vsi 0 zadetkov, torej varni novi nazivi)

`UserTraining`, `TrainingRole`, `enrollmentToken`, `pairedAssessmentId`, `EquivalenceGroup`,
`equivalenceGroupId`, `gradedById`, `gradedAt` — noben od teh se danes ne pojavlja nikjer v
`backend/`/`frontend-next/` source kodi (samo v `schema-v2.prisma` in `docs/schema-v2-NOTES.md`).
`instructorId` — 0 zadetkov v kodi; obstaja izključno kot **predlog** v `docs/BACKEND-BRIEF.md:315,323-428`
(alternativna, opuščena zasnova lastništva prek FK namesto `UserTraining` vezne tabele) — schema-v2
tega polja ne uvaja, torej ni kolizije niti potrebe po usklajevanju.

`needsManualReview` (obstoječe polje, kontekst za novo `gradedById`/`gradedAt`):
`backend/controllers/assessmentAttemptController.js:223` (MC → `false`), `:242` (OPEN/CODE → `true`,
**nikoli se ne obrne nazaj** — to je natanko vrzel, ki jo `gradedById`/`gradedAt` naslavljata);
frontend prikaz: `src/routes/app.my-results.tsx:235`, `src/routes/assessment.$id.result.tsx:71,86`,
`src/services/assessmentAttempts.ts:17`.

### 2.8 `Question.description` / `ParticipantAnswer.answerText` → `@db.Text`

0 zadetkov za frontend `maxLength`/`.slice()`/zod `.max()` validacijo, vezano na ti dve polji
(preverjeno čez celoten `frontend-next/src/**`). Širitev je varna brez frontend posega.

---

## 3. BACKEND SPREMEMBE PO DATOTEKAH (opis, ne koda)

| Datoteka | Sprememba | Zakaj |
|---|---|---|
| `routes/learningObjectiveRoutes.js`, `controllers/learningObjectiveController.js` | Izbriši v celoti | Entiteta odstranjena |
| `server.js` | Odstrani require+mount `/learning-objectives`, preimenuj mount `/equivalent-question-groups`→`/equivalence-groups` (ali obdrži staro pot, glej §7 odprto vprašanje) | Skladnost z odstranjenim/preimenovanim modelom |
| `controllers/questionController.js` | Odstrani `learningObjectiveId`/`learningObjective` iz `questionInclude`, create/update; preimenuj `equivalentGroupId`→`equivalenceGroupId`, `equivalentGroup`→`equivalenceGroup`; odstrani nastavljanje `reviewedById` v `updateQuestionStatus` (obdrži `reviewedAt`) | Uskladitev z odstranjenimi/preimenovanimi polji |
| `controllers/equivalentQuestionGroupController.js` (preimenuj datoteko/pot) | Vse poizvedbe `prisma.equivalentQuestionGroup.*`→`prisma.equivalenceGroup.*`; dodaj `trainingId` pri `create` (izpelji iz konteksta — npr. iz prve dodane question ali eksplicitnega parametra); pri `addQuestionToGroup` preveri `question.topic.trainingId === group.trainingId` (nova app-invarianta §5.4 NOTES); pri `removeQuestionFromGroup` po odstranitvi preveri `memberCount<2` in po potrebi izbriši prazno skupino (naslavlja živo anomalijo, `pre-db-design.md` §3.5#1) | Nov scope + čiščenje znane vrzeli |
| `controllers/assessmentController.js` | `generateAssessment` dedup: `question.equivalentGroupId`→`equivalenceGroupId`; `validateQuestions`: brez spremembe (že preverja `topicId===trainingId`); nov: podpora za `pairedAssessmentId` pri ustvarjanju POST_TEST (poveži na izbrani PRE_TEST); uveljavi app-invarianto "post mora biti isti trainingId + komplementaren type kot pre" | Nova pairing funkcionalnost + preimenovanje |
| `controllers/aiController.js` | Vse `learningObjective*` reference odstrani (prompt, include, draft persist); vse `equivalentGroup*`→`equivalenceGroup*`; odstrani `reviewedById` pisanje v accept/reject (obdrži `reviewedAt`) | Uskladitev |
| `controllers/analyticsController.js` | Odstrani `getAnalyticsByLearningObjective` + endpoint; odstrani LO-filter parsing in LO-breakdown v participant-profile (`strongAreas`/`weakAreas` po LO); po možnosti nadomesti z ekvivalentno "by-topic" agregacijo, ali eksplicitno opusti (produktna odločitev, glej §7) | LO entiteta ne obstaja več |
| `routes/analyticsRoutes.js` | Odstrani `GET /analytics/by-learning-objective` | isto |
| `controllers/assessmentAttemptController.js` | `startAttempt`: dodaj preverbo "ali že obstaja poskus tega uporabnika na ta assessment" (če ne dovolimo več-poskusnosti — glej invarianta §5.6 NOTES: en poskus na test na uporabnika) IN preverbo `UserTraining(userId, assessment.trainingId, PARTICIPANT)` (invarianta #1 NOTES §5); `submitAttempt`: brez neposredne spremembe (že atomarna) | Nove app-invariante iz NOTES §5 |
| **Nov: grading endpoint** (npr. `PATCH /assessment-attempts/:attemptId/answers/:answerId/grade`) | Nastavi `isCorrect`/`pointsAwarded`/`gradedById`/`gradedAt` na `ParticipantAnswer`; ko noben odgovor poskusa ne čaka pregleda → `AssessmentAttempt.status=GRADED` + preračun `score` | Naslavlja dokumentirano vrzel (`AttemptStatus.GRADED` nikoli dosežen, `pre-db-design.md` §3.5#3, §7.3, §8.2) |
| **Nov: UserTraining CRUD** (nova routes+controller datoteka) | Instructor-assign, participant-enroll, list-by-training | Nova entiteta |
| **Nov: QR/enrollment endpoint** (npr. `POST /trainings/:id/enroll` z `enrollmentToken`) | Ustvari `UserTraining(PARTICIPANT)` ob veljavnem tokenu; `POST /trainings/:id/regenerate-token` | NOTES §5.7 |
| **Nov: middleware za lastniško scoping** | Za INSTRUCTOR vloge: filtriraj Training/Topic/Question/Assessment poizvedbe na trening(e), kjer ima klicatelj `UserTraining(role=INSTRUCTOR)`; 404 namesto 403 za neposesten resource | NOTES §5.2 — danes popolnoma odsotno (potrjeno 0 zadetkov, §2.6 zgoraj) |
| `middleware/authMiddleware.js` | Izbriši (potrjeno mrtva koda, `pre-db-design.md` §4.4, §10.2) | Cleanup priložnost, ni nujna za shemo |
| `prisma/seed.js` | Odstrani LO-helper+klice, blueprint-helper+klic; preimenuj equivalent-group helper/klice; odstrani `reviewedById` na Question/AiInteraction seed-klicih; dodaj seed za `UserTraining`, `enrollmentToken`, morda `pairedAssessmentId` demo-par | Uskladitev seed-a z novo shemo |

---

## 4. FRONTEND SPREMEMBE (`frontend-next/`)

**Strani/tipi, ki berejo ODSTRANJENA polja (`learningObjectiveId`, `reviewedById`) — popolnoma odstrani branje/UI:**
- LO: `src/services/learningObjectives.ts` (izbriši), `src/lib/query-keys.ts:27`,
  `src/types/models.ts:55,59,85,93`, `src/services/questions.ts:8,34,45`,
  `src/routes/app.questions.$id.tsx` (LO-dropdown + AI-prompt polje), `app.assessments.new.tsx`
  (LO-filter), `app.assessments.$id.post-test.tsx` (LO-filter), `app.trainings.$id.tsx` (cel LO CRUD-UI),
  `src/lib/analytics-filters.ts`, `src/components/analytics/FilterBar.tsx`,
  `src/services/analytics.ts` (`LearningObjectiveAnalytics` tip + `byLearningObjective()`),
  `app.analytics.tsx`, `app.results.tsx`, `app.question-analysis.tsx`, `app.participants.$userId.tsx`,
  `src/services/aiAuthoring.ts`.
- `reviewedById`: `src/types/models.ts:87` (Question), `:186` (AiInteraction),
  `src/services/ai.ts:117` in `src/services/aiAuthoring.ts:141` (podvojen `ReviewInteractionResult`
  tip — popravi OBA).

**Strani/tipi, ki berejo PREIMENOVANO polje (`equivalentGroupId`→`equivalenceGroupId`,
`.name`→`.title`) — preimenuj, ne odstrani:**
- `src/types/models.ts:89,94,97-105` (vključno z `.name`→`.title` in nullability spremembo)
- `src/services/equivalentGroups.ts` (preimenuj v `equivalenceGroups.ts`, preveži endpoint-poti)
- `src/routes/app.questions.equivalent-groups.tsx` (cela stran za upravljanje)
- `src/routes/app.questions.$id.tsx` (Equivalent-group panel + AI equivalence accept)
- `src/routes/app.assessments.new.tsx:869,871` (badge z `.name`→`.title`)
- `src/routes/app.assessments.$id.post-test.tsx` (`groupedVariants`,
  `variantCandidatesByQuestionId`, `missingVariantQuestions` — preimenuj polje, logika ostane)

**Kateri enumi morajo OSTATI (frontend jih tipsko pričakuje, tudi neuporabljene vrednosti) —
brez sprememb, samo potrditev, da v v2 vse ostanejo:** `AssessmentStatus`, `AssessmentType`,
`QuestionType`, `QuestionStatus` (vklj. z `NEEDS_REVIEW`/`REVIEW` razlikovanjem — glej `pre-db-design.md`
§6.3), `AiAction` (vklj. `EDIT_QUESTION`/`GENERATE_SYNTHETIC_DATA`, 0 v podatkih), `AiReviewStatus`,
`UserRole`, `AiProvider`, `AttemptStatus` (vklj. `GRADED`, danes nedosežen). Vsi so v `schema-v2.prisma`
res ohranjeni 1:1 (potrjeno diff §1) — **nič dodatnega dela tu, le regresijska past, če bi kdo v
Koraku 3 "počistil" neuporabljene vrednosti brez usklajevanja s frontendom.**

**Nov frontend UI, ki ga backend spremembe omogočijo (ni nujen za deploy sheme, a smiseln takoj zatem):**
- Grading UI za OPEN/CODE odgovore (danes ne obstaja nikjer, `pre-db-design.md` §8.2) — vezan na nov backend endpoint.
- UserTraining admin/instructor UI (assign instructor, enrollment liste, QR-token prikaz).
- Pairing UI: eksplicitna izbira/potrditev `pairedAssessmentId` namesto zgolj lokalnega `selectedPre`
  stanja v `app.assessments.$id.post-test.tsx` (danes se `selectedPre.id` nikoli ne pošlje backendu,
  `pre-db-design.md` §13.1) — **priložnost, da wizard dejansko poveže par**, ne le prikaže.

**Mock-podatki, ki jih redesign ne bo avtomatsko "aktiviral" (opozorilo, ne blokada):**
`app.dashboard.tsx` (v celoti mock), `lib/training-view.ts` bridge (privzete vrednosti prekrivajo
resnične) — glej `pre-db-design.md` §6.5. Nobena shema-sprememba tega ne popravi sama po sebi.

---

## 5. BACKFILL / DATA MIGRACIJA

### 5.1 Dedup `AssessmentAttempt` pred `@@unique([assessmentId,userId])`
Koraki: za vsako skupino `(assessmentId, userId)` z >1 vrstico, obdrži tisto z najkasnejšim
`submittedAt` (fallback `startedAt`, če `submittedAt` je NULL za vse — obdrži najkasnejši `startedAt`);
izbriši ostale (kaskadno pobriše `ParticipantAnswer`). **Živ primer, ki bo prizadet:** `userId=4` ima
danes 4 poskuse na `assessmentId=4` (`pre-db-design.md` §3.5/§11#5) — po dedupu ostane 1. Šele nato
uveljavi unique constraint.

### 5.2 `AssessmentAttempt.userId` NOT NULL
Danes 0/22 vrstic ima `userId=NULL` (`pre-db-design.md` §3.3) — migracija je čista, brez dodatnega
backfilla podatkov. Sprememba FK-akcije iz `SET NULL` na `RESTRICT` (privzeto) je varna za obstoječe
podatke, a bo od zdaj naprej blokirala brisanje Uporabnika z obstoječimi poskusi (namesto tihega
`SET NULL`) — namerna sprememba vedenja, ne le shema.

### 5.3 `equivalentGroupId` → `equivalenceGroupId` + `EquivalentQuestionGroup` → `EquivalenceGroup`
1. Za vsako od 17 obstoječih `EquivalentQuestionGroup` vrstic ustvari `EquivalenceGroup` z
   `title = staro.name`, `description`, in **`trainingId` izpeljanim iz `training` njenih članskih
   vprašanj** (`question.topic.trainingId`).
2. **NI PREVERJENO**: ali vsa vprašanja ene skupine dejansko delijo isti `trainingId` (app-invarianta
   NOTES §5.4 to zahteva za v2, a v1 tega ni nikoli uveljavljala). Preveri z:
   `SELECT eqg.id, COUNT(DISTINCT t.trainingId) FROM EquivalentQuestionGroup eqg JOIN Question q ON
   q.equivalentGroupId=eqg.id JOIN Topic t ON t.id=q.topicId GROUP BY eqg.id HAVING COUNT(DISTINCT
   t.trainingId) > 1;` — če vrne kakšno vrstico, backfill zahteva ročno odločitev (razdeli skupino
   po treningu ali izberi "prevladujoč" training).
3. Prekopiraj članstva: `Question.equivalenceGroupId = mapiran EquivalenceGroup.id`.
4. **Počisti prazne/singleton skupine** — 5/17 obstoječih skupin ima <2 člana (id=13 z 1 članom,
   id=14-17 povsem prazne, `pre-db-design.md` §3.5#1) — teh 5 ne prenašaj (ali prenesi in takoj
   izbriši), saj nova app-invarianta "uporabna skupina ima ≥2 člana" to izrecno naslavlja.

### 5.4 Seed `UserTraining(PARTICIPANT)` iz obstoječih poskusov
Za vsak `AssessmentAttempt` → `UserTraining(userId, assessment.trainingId, role=PARTICIPANT)`,
dedup po `(userId,trainingId)`. Mehanično izvedljivo iz obstoječih podatkov (22 poskusov, 9
uporabnikov, 6 treningov) — brez odprtih vprašanj.

### 5.5 `UserTraining(INSTRUCTOR)` — lastništvo obstoječih treningov
**NI PREVERJENO in po trenutnih podatkih VERJETNO NI zanesljivo avtomatsko izpeljivo.** Edini
razpoložljivi signal v podatkih je `Question.createdById → Topic.trainingId` (kdo je ustvaril
katero vprašanje v katerem treningu). To je **hevristika, ne zanesljiv vir**, iz naslednjih razlogov:
- Ne pove nič o treningih, ki (še) nimajo nobenega vprašanja, ali kjer je vsa vprašanja ustvaril ADMIN
  (seed-podatki: seed vprašanja ustvari `admin`, ne dejanski `instructor@example.com` — preveri z
  `SELECT createdById, COUNT(*) FROM Question GROUP BY createdById` in primerjaj z `User.role`).
- Ne razlikuje "avtor enega vprašanja" od "lastnik/urednik celotnega treninga" — trenutna shema/koda
  te razlike sploh ne pozna (`pre-db-design.md` §11#1: avtorizacija je danes izključno po vlogi, ne
  po lastništvu — noben INSTRUCTOR ni bil nikoli "scope-an" na svoj training, torej ni obstoječega
  signala, ki bi TO namero zajel).
- Co-teaching (več instruktorjev na en training) bi hevristika sploh lahko zaznala (če je več avtorjev
  v istem treningu), a bi enako verjetno napačno vključila nekoga, ki je samo enkrat pomagal pri enem
  vprašanju.

**Priporočilo:** avtomatska hevristika naj se KVEČJEMU uporabi kot **predlog** za ročno potrditev
(npr. izpiši `training → distinct createdById avtorji njegovih vprašanj → User.role=INSTRUCTOR/ADMIN`
in zahtevaj eksplicitno potrditev/popravek od produktnega lastnika pred `UserTraining(INSTRUCTOR)`
insertom). Popolnoma ročna dodelitev (2 obstoječa INSTRUCTOR uporabnika × 6 treningov) je majhen,
obvladljiv poseg — priporočena pot, dokler ni izrecne odločitve za hevristiko. **To zahteva mojo/vašo
odločitev pred izvedbo — glej §7.**

### 5.6 `Training.enrollmentToken`
Generiraj naključen, dovolj dolg token (npr. UUID/nanoid) za vseh 6 obstoječih treningov ob migraciji;
brez odprtih vprašanj (nova, neodvisna vrednost).

### 5.7 `AssessmentBlueprint` odstranitev
Brez backfilla — tabela ima 2 vrstici, brez API-referenc (glej §2.5); podatki se preprosto opustijo
ob `DROP TABLE`.

### 5.8 `Question.reviewedById` / `AiInteraction.reviewedById` odstranitev
Brez backfilla potrebnega — `reviewedAt` (ki ostane) že nosi časovni podatek; sam identitetni podatek
"kdo" se izgubi za pretekle zapise (21 Question + 3 AiInteraction vrstice), kar je sprejeta posledica
(NOTES §1: "pregledovalec == naročnik" za AiInteraction, oz. produktna odločitev za Question).

---

## 6. VRSTNI RED KORAKOV

**FAZA 1 — additivno (varno, samostojno deployabilno brez frontend spremembe):**
`UserTraining` + `TrainingRole`, `EquivalenceGroup` (nov, prazen model — brez brisanja starega),
`equivalenceGroupId` (nov stolpec na Question, ob starem `equivalentGroupId`), `Training.enrollmentToken`,
`Assessment.pairedAssessmentId`, `ParticipantAnswer.gradedById`/`gradedAt`, timestampi na
User/Topic/Question, novi indeksi, `description`/`answerText` → TEXT. **Deployaj samostojno** —
noben obstoječi endpoint se ne spremeni, frontend ne opazi razlike.

**FAZA 2 — backfill podatkov (§5, izvedi PRED fazo 3, PO fazi 1):**
1. Dedup `AssessmentAttempt` (§5.1).
2. `UserTraining(PARTICIPANT)` seed iz poskusov (§5.4) — neproblematično.
3. `UserTraining(INSTRUCTOR)` — **čaka na odločitev §5.5/§7** (ročno ali potrjena hevristika).
4. `equivalenceGroupId` prekopiranje + čiščenje praznih skupin (§5.3) — **čaka na preverbo cross-training
   integritete** (§5.3 točka 2).
5. `enrollmentToken` generacija (§5.6).

**FAZA 3 — backend rušilne spremembe (šele PO fazi 2, PRED frontend-follow-up deployem):**
Uveljavi `AssessmentAttempt.userId` NOT NULL + RESTRICT + unique; preklopi vse backend brance/pisce
z `equivalentGroupId`→`equivalenceGroupId` in stare `EquivalentQuestionGroup` tabele/controllerja na
novo; odstrani `learningObjectiveId`/`LearningObjective`, `AssessmentBlueprint`,
`Question.reviewedById`, `AiInteraction.reviewedById`. **Ta faza ZLOMI frontend, dokler §4 ni
deployan vzporedno ali tik pred njo** — priporočilo: backend faza 3 in ustrezen frontend-popravek
naj gresta v ISTI release (ne zaporedno z vmesnim oknom v produkciji), ker ni DTO-plasti, ki bi
absorbirala razliko (`pre-db-design.md` §11#15).

**FAZA 4 — nova funkcionalnost (lahko neodvisno po fazi 3):**
Grading endpoint + UI, UserTraining scoping middleware + UI, QR-enrollment endpoint + UI, pairing UI
za post-test wizard. Te niso nujne za sam shema-cutover, a so razlog, zakaj je shema-v2 sploh nastala
(NOTES §1, sprejete odločitve C, QR, pairing).

**Varno samostojno deployati:** Faza 1 v celoti; Faza 4 (grading, UserTraining CRUD, QR) je funkcionalno
neodvisna od Faze 3, LAHKO gre pred njo, če se backend endpoint-i dodajo aditivno (nov endpoint, stari
ostane dokler ne pride Faza 3).
**Šele po frontend follow-upu:** Faza 3 v celoti (glej zgoraj).

---

## 7. TVEGANJA / ODPRTA VPRAŠANJA (zahtevajo vašo odločitev)

1. **INSTRUCTOR lastništvo (§5.5)** — ali dovolite hevristiko `Question.createdById→training` kot
   *predlog* za ročno potrditev, ali gre naravnost na ročno dodelitev (2 uporabnika × 6 treningov)?
   Priporočilo: ročno, hevristika kot pomoč pri predlogu.
2. **Cross-training integriteta obstoječih `EquivalentQuestionGroup`** (§5.3.2) — NI PREVERJENO, ali
   katera od 17 skupin združuje vprašanja iz različnih treningov. Zahteva SQL-preverbo pred backfillom
   (poizvedba priložena v §5.3).
3. **`.name` → `.title` preimenovanje na equivalence-group entiteti** — to je dodaten rušilni detajl,
   ki ga `docs/schema-v2-NOTES.md` ne izpostavi ločeno od modela-preimenovanja. Potrdite, da je
   nameravano (in da nova `title` sme biti `null`, česar stara `name` ni dopuščala).
4. **Prazne/singleton `EquivalenceGroup` po backfillu (§5.3.4)** — ali se 5 obstoječih premalo-članskih
   skupin preprosto opusti (priporočeno) ali ročno dopolni z dodatnimi vprašanji pred migracijo?
5. **Analytics "by-LO" endpoint ukinitev** (§2.1, §3) — ali se `GET /analytics/by-learning-objective`
   in ustrezni `strongAreas`/`weakAreas` po LO na participant-profilu preprosto ukineta (ker entiteta
   izgine), ali naj se nadomestita z ekvivalentno "by-topic" agregacijo? To je produktna odločitev, ki
   vpliva na 5 frontend strani (§2.1).
6. **`equivalenceGroupId` na assessment-question dedupu** — ali naj backend PRVIČ dejansko uveljavi
   post-test poravnavo iz `EquivalenceGroup` pri `POST /assessments/generate` (danes se `selectedPre`
   iz wizarda nikoli ne pošlje backendu, `pre-db-design.md` §13.1/§13.4), ali ostane le "dedup med
   generiranimi", kot danes? Shema (nova `pairedAssessmentId`) to omogoča, a ne prisili.
7. **En poskus na uporabnika (Faza 3 unique constraint)** — potrdite, da je to res želeno produktno
   pravilo (uporabnik NE sme več-krat reševati istega assessmenta), saj to spremeni obstoječe UX
   (danes lahko udeleženec `/start` kliče poljubno-krat).
8. **Mount-pot za equivalence-group routes** — obdrži `/equivalent-question-groups` (manj rušilno za
   morebitne zunanje odjemalce, a neskladno z novim imenom) ali preimenuj v `/equivalence-groups`
   (skladno, a dodatna rušilna sprememba API-poti poleg polj)? Priporočilo: preimenuj, ker JE frontend
   edini odjemalec (potrjeno) in gre vseeno za isti release kot Faza 3.
9. **`GRADED` status + score-preračun (Faza 4)** — kdo sme ocenjevati OPEN/CODE (samo INSTRUCTOR
   treninga prek `UserTraining`, ali kdorkoli z vlogo INSTRUCTOR/ADMIN kot danes za vse ostalo)?
   Vpliva na oblikovanje novega grading endpointa.
10. **Windows `lower_case_table_names=1`** (`pre-db-design.md` §2.5/§11#12) — NI PREVERJENO, ali
    produkcijsko/CI okolje uporablja drugačno nastavitev; relevantno za morebiten prenos okolja ob
    tej migraciji, neodvisno od shema-vsebine same.
