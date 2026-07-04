# schema-v2 — NOTES & HANDOFF

Spremni dokument k `schema-v2.prisma`. Namen: (1) človeški diff proti stari shemi,
(2) migracijska strategija (additivno vs rušilno, backfill), (3) app-level invariante,
ki jih FK ne izrazi, (4) checklist za Korak 3 (menjava, večinoma prek Claude Code).

> **Status:** predlog. `schema-v2.prisma` odloži v repo NEAKTIVNO. Migracij ne poganjaj,
> dokler ni pregledana menjava kode. Migracijski SQL naj nastane iz te sheme prek
> `npx prisma migrate dev` v Koraku 3 — ne piši SQL ročno.

---

## 1. Sprejete odločitve (povzetek)

| # | Odločitev | Rešitev v shemi |
|---|---|---|
| Lastništvo | instructor vidi samo svoje | `UserTraining(role=INSTRUCTOR)` |
| Enrollment | participant vidi le svoje treninge | `UserTraining(role=PARTICIPANT)` |
| QR self-enroll | skeniranje doda participanta | `Training.enrollmentToken` + app flow |
| A — pairing | pre↔post povezava | `Assessment.pairedAssessmentId` (1:1, self, SET NULL) |
| A — ekvivalenca | zamenljive različice vprašanj | `EquivalenceGroup` (scope na training) + `Question.equivalenceGroupId` |
| B — "class" | ostane training | brez nove entitete; kohorta = `UserTraining(role=PARTICIPANT)` treninga |
| C — ocenjevanje | dodamo zdaj | `ParticipantAnswer.gradedById` + `gradedAt`; pot `SUBMITTED→GRADED` (app) |
| D — poskusi | en poskus na test na uporabnika | `@@unique([assessmentId, userId])` |
| aiInteraction.reviewedById | odpade (pregledovalec == naročnik) | odstranjen; `reviewStatus`+`reviewedAt` ostaneta |
| question.reviewedById | odpade | odstranjen; `reviewedAt` ostane |
| blueprint / stara equiv. tabela | odpadeta | `AssessmentBlueprint`, `EquivalentQuestionGroup` odstranjena |
| LearningObjective | odpade | tabela + `Question.learningObjectiveId` odstranjena |

Dedup privzetek za D: **obdrži zadnji oddani** poskus. Pairing: **1:1**.
`gradedById` on delete: **SET NULL**. Poimenovanje: **PascalCase / `UserTraining`**.

---

## 2. Diff proti stari shemi

### NOVO (additivno — ne podre kontrakta)
- **`UserTraining`** (+ enum `TrainingRole`) — vezna tabela User↔Training, `@@unique([userId,trainingId])`.
- **`EquivalenceGroup`** — nadomesti staro `EquivalentQuestionGroup`, a scope-ana na `trainingId`.
- **`Training.enrollmentToken`** (unique, nullable) — QR self-enrollment.
- **`Assessment.pairedAssessmentId`** (self 1:1, `@unique`, SET NULL) — pre/post par.
- **`ParticipantAnswer.gradedById` + `gradedAt`** — ročno ocenjevanje OPEN/CODE.
- **`createdAt`/`updatedAt`** na `User`, `Topic`, `Question` (prej jih niso imeli).
- **Indeksi**: `Question(status, topicId)`, `Assessment(status, trainingId)`, `ParticipantAnswer(gradedById)`, `UserTraining(trainingId, role)`.

### SPREMENJENO
- **`Question.description`** VARCHAR(191) → `@db.Text`. *(additivno; širitev, brez izgube — max opažen 107 znakov)*
- **`ParticipantAnswer.answerText`** VARCHAR(191) → `@db.Text`. *(additivno)*
- **`Question.equivalentGroupId` → `equivalenceGroupId`** (preimenovan + nov cilj). **[RUŠILNO + BACKFILL]**
- **`AssessmentAttempt.userId`** `Int?`/SET NULL → **`Int` NOT NULL / RESTRICT**. **[BACKFILL]** (0 NULL danes → čisto)
- **`AssessmentAttempt`** dobi **`@@unique([assessmentId, userId])`**. **[BACKFILL]** (dedup obstoječih večkratnikov)

### ODSTRANJENO (rušilno za kontrakt — glej §4)
- Tabela **`LearningObjective`** + `Question.learningObjectiveId`.
- Tabela **`AssessmentBlueprint`** (mrtva shema, 0 kod-referenc → varno, a še vedno odstranitev).
- Tabela **`EquivalentQuestionGroup`** (nadomeščena z `EquivalenceGroup`).
- **`Question.reviewedById`** (+ `reviewedBy` relacija).
- **`AiInteraction.reviewedById`** (+ relacija + njen indeks).

---

## 3. Migracijska strategija (additivno najprej, rušilno nazadnje)

Če se ohranjajo obstoječi podatki, migriraj v treh fazah. Če gre za čisto novo bazo
(brez migracije podatkov), so pomembne le faze 1 in 3 kot en `migrate`, backfill (faza 2)
pa odpade — a app-invariante iz §5 veljajo enako.

**FAZA 1 — additivno (varno, samostojno deployabilno):**
dodaj `UserTraining`, `TrainingRole`, `EquivalenceGroup`, `enrollmentToken`,
`equivalenceGroupId` (nov stolpec ob starem), `pairedAssessmentId`, `gradedById`/`gradedAt`,
timestampe, nove indekse; razširi `description`/`answerText` v TEXT.

**FAZA 2 — backfill podatkov (pred fazo 3):**
1. **UserTraining / INSTRUCTOR** — lastništva v starih podatkih NI, zato ga ni mogoče
   avtomatsko izpeljati. Potrebna produktna/ročna dodelitev, kdo je instructor katerega
   treninga. (Možna hevristika: `Question.createdById` → instructor treninga tega vprašanja;
   preveri z naročnikom, ni zanesljivo.)
2. **UserTraining / PARTICIPANT** — lahko se seedira iz obstoječih poskusov:
   za vsak `AssessmentAttempt` → `UserTraining(userId, assessment.trainingId, PARTICIPANT)` (dedup).
3. **equivalenceGroupId** — za vsako staro `EquivalentQuestionGroup` ustvari `EquivalenceGroup`
   z `trainingId` izpeljanim iz treninga njenih vprašanj; prekopiraj članstva v nov stolpec;
   **počisti prazne/singleton** (danes 5/17 skupin ima <2 člana — audit §3.5).
4. **dedup AssessmentAttempt** — obdrži zadnji oddani (`submittedAt` max, fallback `startedAt`)
   na `(assessmentId, userId)`; ostale zbriši (kaskadno vzame `ParticipantAnswer`). Šele nato UNIQUE.
   *(Danes npr. userId=4 ima 4 poskuse na istem assessmentu — audit §3.5/§11#5.)*
5. **enrollmentToken** — generiraj naključen token za obstoječe treninge.

**FAZA 3 — rušilno (šele po frontend follow-upu iz §4):**
uveljavi `NOT NULL` + `RESTRICT` na `AssessmentAttempt.userId`; `@@unique([assessmentId,userId])`;
`@unique` na `pairedAssessmentId`; odstrani `learningObjectiveId`, `LearningObjective`,
`AssessmentBlueprint`, `EquivalentQuestionGroup`, `equivalentGroupId`,
`Question.reviewedById`, `AiInteraction.reviewedById`.

---

## 4. Rušilne točke za frontend (kje kontrakt poči)

Ni DTO/serializer plasti — vsak stolpec priteče v odgovor prek Prisma `include`
(audit §11#15). Zato odstranitve/preimenovanja spodaj **spremenijo obliko odgovorov**;
vsako je treba popraviti na obeh straneh.

- **`learningObjectiveId` / `learningObjective`** — bran v `questionInclude` na vsakem Question
  odgovoru (audit §5.3) in v analitiki by-LO (`GET /analytics/*`, audit §5.9). Odstrani vse
  bralce + endpoint(e), ki agregirajo po učnem cilju.
- **`equivalentGroupId` → `equivalenceGroupId`** — bran v `questionInclude` in v **post-test
  wizardu** (`app.assessments.$id.post-test.tsx`, audit §13.4). Preimenuj povsod + preveži na
  novo `EquivalenceGroup`.
- **`reviewedById` (Question)** — nastavljen ob APPROVED/REJECTED (audit §7.1); če ga frontend
  kje prikazuje ("kdo je potrdil"), odstrani prikaz. `reviewedAt` ostane.
- **`AssessmentBlueprint`** — po auditu brez controllerja/routa/frontend-strani (§10.2) →
  odstranitev naj bo brez vpliva; vseeno grep za varnost.

Ob **dodajanju** stolpcev pazi na obstoječi answer-leak (audit §11#8): `isCorrect` že sedaj
priteče udeležencu prek include; vsak nov občutljiv stolpec se bo obnašal enako, dokler ni
`select`-filtra. Priložnost, da se v Koraku 3 uvede minimalna DTO plast.

---

## 5. App-level invariante (shema jih NE izraža — implementirati v kodi)

1. `/start` poskusa dovoljen **samo če** `assessment.status=PUBLISHED` **in** obstaja
   `UserTraining(userId, assessment.trainingId, PARTICIPANT)`.
2. Vidnost instructorja: sme videti/urejati Training/Topic/Question/Assessment **samo** kjer
   ima `UserTraining(role=INSTRUCTOR)` za pripadajoči training. (404-namesto-403 konvencija.)
3. `AssessmentQuestion`: `question.topic.trainingId == assessment.trainingId` in
   `question.status == APPROVED`.
4. `EquivalenceGroup`: vsa vprašanja delijo isti `trainingId`; skupina "uporabna" pri ≥2 članih;
   pri generaciji post-testa se iz vsake skupine vzame **največ en** član (dedup) in izbere
   **drugo** vprašanje kot v pre-testu.
5. Pairing: `POST_TEST.pairedAssessmentId` kaže na PRE_TEST istega `trainingId`, komplementaren `type`.
6. Ocenjevanje (C): ob submit OPEN/CODE → `needsManualReview=true`; ločen "grade answer" endpoint
   nastavi `isCorrect`/`pointsAwarded`/`gradedById`/`gradedAt`; ko noben odgovor poskusa ne čaka
   pregleda → `AssessmentAttempt.status=GRADED` + **preračun `score`** (danes se ne preračuna, §11#6/#7).
7. QR: token na `Training` → ob skeniranju backend ustvari `UserTraining(PARTICIPANT)`; token
   regeneratabilen/prekicljiv (opcijsko).

---

## 6. Checklist za Korak 3 (handoff za Claude Code)

Predlagana podlaga za implementacijski chat: priloži `schema-v2.prisma`, ta NOTES in
`pre-db-design.md` (audit). Nato po datotekah:

- [ ] **Prisma**: zamenjaj shemo, `migrate dev`, regeneriraj klienta; preveri, da se seed prilagodi.
- [ ] **Auth/vloge**: dodaj lastniško preverbo (UserTraining) v middleware ali per-controller;
      404-vs-403 konvencija; ohrani Firebase→User pot nespremenjeno.
- [ ] **Training/Topic/Question/Assessment controllerji**: scope poizvedb na instructorjeve treninge;
      odstrani `learningObjective*`; preimenuj `equivalentGroup*` → `equivalenceGroup*`.
- [ ] **AssessmentQuestion**: uveljavi invarianti #3.
- [ ] **AssessmentAttempt**: `/start` invarianta #1 + preverba "en poskus" (#D); userId iz `req.user`.
- [ ] **Grading (C)**: nov endpoint za oceno OPEN/CODE; SUBMITTED→GRADED + preračun score.
- [ ] **EquivalenceGroup**: novi CRUD + scope; migracija/ureditev članstev; generacija post-testa
      dejansko uveljavi ekvivalente (danes le UI-svetovalno, §13.4).
- [ ] **Pairing**: endpoint za povezavo post↔pre; analitika bere `pairedAssessmentId` namesto
      "zadnji poskus vsakega tipa" ugibanja (§13.1).
- [ ] **AiInteraction**: odstrani `reviewedById` iz review-toka; ostalo nespremenjeno.
- [ ] **QR / enrollment**: generacija tokena + join endpoint.
- [ ] **Frontend (`frontend-next/`)**: popravi bralce iz §4; posodobi tipe (`types/models.ts`);
      nič v enumih ne odstranjaj (frontend jih tipsko pričakuje).
- [ ] **Cleanup**: odstrani mrtvo `authMiddleware.js`; odloči o mock-ožičenih straneh (§6.5/§11#13).

---

## 7. Odprta drobna vprašanja (za Korak 3, ne blokirajo sheme)

- Dodelitev INSTRUCTOR lastništva obstoječim treningom (faza 2, korak 1) — ročno ali hevristika?
- Ali `GET /assessment-attempts?mine=true` nadomesti client-side `attempt-storage.ts` shim (audit §10.1)?
- Ali se ob menjavi uvede minimalna DTO plast (zaradi answer-leak §11#8), ali se ohrani `select`-sanitizacija.
- Enum higiena (`NEEDS_REVIEW` vs `REVIEW`): počistiti kasneje? Zahteva frontend follow-up, zato ne zdaj.
