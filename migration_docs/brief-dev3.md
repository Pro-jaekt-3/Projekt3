# BRIEF — DEV 3: Assessment, poskusi, ocenjevanje, pairing, analitika

Lastnik izvajalske in analitične domene. Tvoj je post-test wizard (tri-smerni file:
LO-filter + equiv + pairing). Vežeš se na Dev 2 tipe in Dev 1 middleware — rebase-aj nanju.

## Naloži pred delom
`schema-v2.prisma`, `schema-v2-NOTES.md`, `pre-db-design.md`, `migration-plan.md`, ta brief.
Čakaj na: Fazo 0, objavljen `types/models.ts` (Dev 2), scoping/enrollment middleware (Dev 1).

## Scope IN

### Assessment (`assessmentController.js`)
- **Pairing (novo):** ob kreaciji POST_TEST omogoči `pairedAssessmentId` → poveži na izbrani
  PRE_TEST. Uveljavi invarianto: par ima **isti `trainingId`** + **komplementaren `type`**
  (post↔pre). Konvencija: `POST_TEST.pairedAssessmentId = PRE_TEST.id`.
- **`generateAssessment`:** `question.equivalentGroupId` → `equivalenceGroupId` (Dev 2 rename);
  odstrani LO-filter (`:359,401-402`).
- **Ekvivalenca — UVELJAVI (zaklenjena odločitev):** pri generaciji post-testa backend PRVIČ
  dejansko izbere ekvivalente pre-testa iz `EquivalenceGroup` (danes je poravnava le UI-svetovalna
  in se `selectedPre` nikoli ne pošlje backendu — `pre-db-design.md` §13.1/§13.4). Iz vsake skupine
  največ en član; izberi **drugo** vprašanje kot v pre-testu.

### Attempts + Grading (`assessmentAttemptController.js`)
- **En poskus na test na uporabnika (D):** v `startAttempt` preveri obstoj poskusa
  `(assessmentId, userId)` pred create; če obstaja, zavrni (ali vrni obstoječega — produktna izbira).
- **Enrollment guard:** vgradi Dev 1 `requireEnrollment` (dostop do /start le za vpisane +
  PUBLISHED). `userId` vedno iz `req.user`.
- **Grading endpoint (novo):** npr. `PATCH /assessment-attempts/:attemptId/answers/:answerId/grade`
  → nastavi `isCorrect`/`pointsAwarded`/`gradedById`/`gradedAt` na `ParticipantAnswer`.
  Dovoljen samo INSTRUCTOR tega treninga (prek Dev 1 ownership helper). *(Odločitev 4: ocenjevanje
  je instructor workflow, ne ADMIN.)*
- **SUBMITTED → GRADED + preračun `score`:** ko noben odgovor poskusa ne čaka pregleda
  (`needsManualReview` vsi false) → `status=GRADED` in preračunaj `score`. Naslavlja mrtev status
  (`pre-db-design.md` §3.5#3, §7.3, §8.2).

### Analitika (`analyticsController.js`, `analyticsRoutes.js`)
- Odstrani `getAnalyticsByLearningObjective` + `GET /analytics/by-learning-objective`.
- **Nadomesti z by-topic (zaklenjena odločitev):** LO-breakdown na participant-profilu
  (`strongAreas`/`weakAreas` po LO, `:688-720`) → ekvivalentna by-topic agregacija.
- Odstrani LO-filter parsing povsod v analitiki.
- `userId: {not:null}` filtri postanejo odvečni po NOT NULL (lahko pustiš, neškodljivi).

## Frontend (tvoj)
- **Assessment builder** (`app.assessments.new.tsx`): odstrani LO-filter; equiv badge `.name`→`.title`.
- **Post-test wizard** (`app.assessments.$id.post-test.tsx`) — CEL tvoj:
  - odstrani LO-filter; preimenuj equiv polja (`groupedVariants`, `variantCandidatesByQuestionId`,
    `missingVariantQuestions`);
  - **Pairing UI:** dejansko pošlji izbrani PRE_TEST backendu in poveži `pairedAssessmentId`
    (danes `selectedPre.id` ostane le lokalno stanje).
- **Analitika** (`app.analytics.tsx`, `FilterBar.tsx`, `analytics-filters.ts`, `services/analytics.ts`,
  `app.results.tsx`, `app.question-analysis.tsx`, `app.participants.$userId.tsx`): odstrani LO-filter +
  `LearningObjectiveAnalytics` tip + `byLearningObjective()` klic; preklopi na by-topic.
- **Grading UI (novo):** za OPEN/CODE odgovore (danes ne obstaja) — vezan na nov backend endpoint.

## App-invariante (NOTES §5)
#3 (AssessmentQuestion: `topic.trainingId==assessment.trainingId` + APPROVED), #4 (equiv dedup pri
generaciji), #5 (pairing pravila), #6 (grading → GRADED + score preračun).

## Odvisnosti
- Čakaš: Faza 0; Dev 2 `types/models.ts` (equiv rename, LO removal); Dev 1 middleware
  (ownership za grading, enrollment za /start).
- Koordinacija z vodjo: `server.js` (grading route mount), `seed.js` (pairing demo par).
- **Ne posegaj v:** `questionController.js`, `aiController.js` (Dev 2), Dev 1 middleware.

## Done-kriterij
Pairing dela (post↔pre povezan v bazi); generacija post-testa dejansko izbere ekvivalente;
en-poskus pravilo uveljavljeno; grading endpoint + UI deluje in doseže GRADED s preračunom score;
by-LO analitika nadomeščena z by-topic na vseh straneh.
