# PRE-DB-DESIGN AUDIT — PROJEKT3

> Strogo READ-ONLY popis trenutnega stanja pred redesignom podatkovne baze. Brez sprememb kode,
> sheme ali baze. Vsaka ugotovitev je podprta z referenco (pot:vrstica, ime endpointa ali rezultat
> poizvedbe). Kjer preverba ni bila mogoča, je to eksplicitno označeno z **NI PREVERJENO**.
>
> **Metodologija / viri:**
> - Statična analiza kode: `backend/` (routes, controllers, middleware, `prisma/schema.prisma`,
>   `prisma/migrations/*/migration.sql`, `prisma/seed.js`) in `frontend-next/` (routes, services, types).
> - Živa baza: povezava je bila **na voljo** (`backend/.env:1` → `mysql://root:***@localhost:3306/projekt3`,
>   MySQL **8.0.46**, `lower_case_table_names=1`). Vse poizvedbe so bile izvedene izključno kot
>   `SELECT`/`COUNT`/`GROUP BY` prek Prisma Client (`$queryRawUnsafe`, `.count()`, `.groupBy()`) — brez
>   pisanja. Introspekcija sheme: `npx prisma db pull --print` (samo izpis na stdout, ni pisal v
>   `schema.prisma`).
> - Datum izvedbe poizvedb: 2026-07-04.

---

## 1. PREGLED SISTEMA

### 1.1 Namen (iz `docs/mvp-scope.md` in `CLAUDE.md`)

Sistem inštruktorjem omogoča pripravo banke vprašanj (organizirane po izobraževanjih/tematikah/
učnih ciljih), sestavljanje preverjanj iz te banke, izvajanje preverjanj s strani udeležencev, in
osnovno analitiko rezultatov. Lokalni Ollama model nudi advisory-only AI podporo pri pripravi
vprašanj — vsak AI predlog gre skozi človeški review (`docs/mvp-scope.md:78-96`).

### 1.2 Glavni tokovi (iz kode, ne iz domnev)

1. **Training → Topic → LearningObjective**: `POST /trainings` (`trainingController.js`) →
   `POST /topics` (veže se na `trainingId`, `topicController.js:46-93`) → `POST /learning-objectives`
   (veže se na `topicId`, `learningObjectiveController.js:31-68`).
2. **Question**: `POST /questions` (`questionController.js:43-105`) — veže se na `topicId` (obvezno),
   opcijsko `learningObjectiveId`, `equivalentGroupId`; tip `OPEN|MULTIPLE_CHOICE|CODE`; za MC
   zahteva ≥2 opcije in ≥1 pravilno (`questionController.js:58-69`). Status potuje
   `DRAFT → (REVIEW|APPROVED|REJECTED|ARCHIVED)` prek `PATCH /questions/:id/status`
   (`questionController.js:218-257`).
3. **Assessment**: ustvari se ročno (`POST /assessments`, `assessmentController.js:295-350`, samo
   vprašanja s `status=APPROVED`, iz istega `trainingId`) ali z avto-izborom
   (`POST /assessments/generate`, `assessmentController.js:352-485`, dedup po
   `equivalentGroupId`). Vedno nastane kot `status=DRAFT`; objavi se ločeno prek
   `PATCH /assessments/:id/status` (`assessmentController.js:589-620`).
4. **Reševanje**: `POST /assessment-attempts/start` (samo za `PUBLISHED` assessment,
   `assessmentAttemptController.js:82-88`) → `POST /assessment-attempts/:id/submit`
   (`assessmentAttemptController.js:109-273`) — avto-ocenjevanje MC, `needsManualReview=true` za
   OPEN/CODE, atomarno prek `$transaction` (`:246-267`).
5. **Analitika**: izključno branje/agregacija nad `ParticipantAnswer`+`AssessmentAttempt`+
   `AssessmentQuestion`, `GET /analytics/*` (`analyticsController.js`, 11 endpointov, glej §5).
6. **AI advisory**: `POST /ai/question-draft|equivalence-suggestion|equivalent-question` ustvari
   `AiInteraction(reviewStatus=PENDING)`; človek potrdi/zavrne prek
   `PATCH /ai/interactions/:id/review` (glej §9).

### 1.3 Feature inventar (trenutno podprto, po kodi)

- Upravljanje Training/Topic/LearningObjective (CRUD, brez cascade delete zaščite — glej §11).
- Banka vprašanj: OPEN/MULTIPLE_CHOICE/CODE, težavnost (Int), status-workflow, avtor+reviewer.
- Ekvivalentne skupine vprašanj (`EquivalentQuestionGroup`, članstvo 1:N, T4-pravilo — glej §5.6).
- Preverjanja: ročna izgradnja, avto-generacija, DRAFT/PUBLISHED/ARCHIVED, urejanje samo v DRAFT.
- Reševanje: en poskus na klic `/start` (**brez omejitve na en poskus na uporabnika** — glej §7),
  avto-ocena MC, ročno-še-neimplementirano OPEN/CODE.
- Analitika: by-topic/by-LO/by-difficulty, pre/post primerjava (parna), worst-questions,
  leaderboard (PII-gated), trends, participant-profile, option-distribution.
- AI: generacija osnutka vprašanja (strukturiran JSON), primerjava ekvivalence, generacija novega
  ekvivalenta, review queue, pre/post AI narativ (advisory).
- Admin: seznam uporabnikov + sprememba vloge (`GET/PATCH /users`), upravljanje AiModel.
- Auth: Firebase ID token → DB `User` (po `firebaseUid` nato po `email`, avto-provision kot
  `PARTICIPANT` — glej §4).

Stack: Backend Express `^5.2.1` + `@prisma/client ^6.19.3` + MySQL 8.0.46 (`backend/package.json`);
Frontend `frontend-next/` React `^19.2.0` + Vite `^7.3.1` + TanStack Router `^1.168.25` + TanStack
Query `^5.83.0` (`frontend-next/package.json`) — to je **aktivna** aplikacija; `frontend/` (starejša
CRA-ish varianta) in `lovable-reference/` sta samo referenčna, brez live importov vanju (potrjeno z
grep — ni bilo najdenih uvozov iz `frontend-next/` v `frontend/` ali `lovable-reference/`).

---

## 2. INVENTAR PODATKOVNE SHEME

Vir: `backend/prisma/schema.prisma` (304 vrstic), navzkrižno preverjeno z živo bazo
(`npx prisma db pull --print`, 2026-07-04) in z vsemi `migration.sql` datotekami za FK `ON DELETE`
akcije (schema.prisma sam ne izpiše `onDelete` za privzeti `RESTRICT`, migracije pa to eksplicitno
vsebujejo).

### 2.1 Tabele in stolpci

**User** (`schema.prisma:14-26`)
| Stolpec | Tip | Null? | Privzeto |
|---|---|---|---|
| id | Int PK autoincrement | NE | — |
| firebaseUid | String | DA | — |
| email | String | NE | — |
| name | String | DA | — |
| externalAuthId | String | DA | — |
| role | UserRole | NE | PARTICIPANT |

Unique: `firebaseUid`, `email`, `externalAuthId`.

**Training** (`schema.prisma:37-46`)
| id PK | title String NOT NULL | description String? | createdAt DateTime @default(now()) | updatedAt DateTime @updatedAt |

**Topic** (`schema.prisma:28-35`)
| id PK | name String NOT NULL | trainingId Int NOT NULL (FK→Training) |

**LearningObjective** (`schema.prisma:233-241`)
| id PK | title String NOT NULL | description String? | topicId Int NOT NULL (FK→Topic) |

**Question** (`schema.prisma:48-82`)
| id PK | title String NOT NULL | description String NOT NULL | difficulty Int NOT NULL |
| type QuestionType NOT NULL @default(OPEN) | status QuestionStatus NOT NULL @default(DRAFT) |
| topicId Int NOT NULL (FK) | learningObjectiveId Int? (FK) | createdById Int NOT NULL (FK→User) |
| reviewedById Int? (FK→User) | reviewedAt DateTime? | equivalentGroupId Int? (FK) |
Index: `equivalentGroupId` (`@@index`, line 81).

**AnswerOption** (`schema.prisma:210-222`)
| id PK | questionId Int NOT NULL (FK, Cascade) | text String NOT NULL | isCorrect Boolean @default(false) | orderIndex Int NOT NULL |
Unique: `(questionId, orderIndex)`. Index: `questionId`.

**EquivalentQuestionGroup** (`schema.prisma:224-231`)
| id PK | name String NOT NULL | description String? | createdAt | updatedAt |

**Assessment** (`schema.prisma:129-142`)
| id PK | title String NOT NULL | description String? | trainingId Int NOT NULL (FK) |
| type AssessmentType NOT NULL | status AssessmentStatus NOT NULL @default(DRAFT) |
| timeLimitMinutes Int? | createdAt | updatedAt |

**AssessmentBlueprint** (`schema.prisma:144-154`) — **dead schema, glej §10**
| id PK | title String NOT NULL | description String? | trainingId Int NOT NULL (FK) |
| targetQuestionCount Int NOT NULL | configJson Json NOT NULL | createdAt | updatedAt |

**AssessmentQuestion** (`schema.prisma:156-168`)
| id PK | assessmentId Int NOT NULL (FK, Cascade) | questionId Int NOT NULL (FK) |
| orderIndex Int NOT NULL | points Float @default(1) |
Unique: `(assessmentId, orderIndex)`, `(assessmentId, questionId)`. Index: `questionId`.

**AssessmentAttempt** (`schema.prisma:170-188`)
| id PK | assessmentId Int NOT NULL (FK) | userId Int? (FK, SetNull) | startedAt DateTime @default(now()) |
| submittedAt DateTime? | score Float? | maxScore Float? | status AttemptStatus NOT NULL @default(IN_PROGRESS) |
| createdAt | updatedAt |
Index: `assessmentId`, `userId`, `status`. **Brez `@@unique([assessmentId,userId])`** — glej §7/§11.

**ParticipantAnswer** (`schema.prisma:190-208`)
| id PK | attemptId Int NOT NULL (FK, Cascade) | questionId Int NOT NULL (FK) |
| selectedOptionId Int? (FK, SetNull) | answerText String? | isCorrect Boolean? | pointsAwarded Float? |
| needsManualReview Boolean @default(false) | createdAt | updatedAt |
Unique: `(attemptId, questionId)`. Index: `questionId`, `selectedOptionId`.

**AiModel** (`schema.prisma:84-97`)
| id PK | provider AiProvider NOT NULL | modelName String NOT NULL | displayName String? |
| baseUrl String? | isLocal Boolean @default(false) | isActive Boolean @default(true) | createdAt | updatedAt |
Unique: `(provider, modelName)`.

**AiInteraction** (`schema.prisma:99-127`)
| id PK | aiModelId Int NOT NULL (FK) | requestedById Int NOT NULL (FK→User) | action AiAction NOT NULL |
| prompt String @db.LongText NOT NULL | resultText String? @db.LongText | resultJson Json? |
| sourceQuestionId Int? (FK, SetNull) | generatedQuestionId Int? (FK, SetNull) |
| reviewStatus AiReviewStatus NOT NULL @default(PENDING) | reviewedById Int? (FK→User, SetNull) |
| reviewedAt DateTime? | createdAt | updatedAt |
Indeksi: `aiModelId`, `requestedById`, `reviewedById`, `sourceQuestionId`, `generatedQuestionId`,
`action`, `reviewStatus` (7 indeksov, `schema.prisma:120-126`).

### 2.2 Enumi (vse vrednosti, iz `schema.prisma:243-303`)

- `QuestionType`: OPEN, MULTIPLE_CHOICE, CODE
- `QuestionStatus`: DRAFT, NEEDS_REVIEW, REVIEW, APPROVED, REJECTED, ARCHIVED
- `AiAction`: GENERATE_QUESTION, EDIT_QUESTION, GENERATE_EQUIVALENT_QUESTION, CHECK_EQUIVALENCE,
  CHECK_QUESTION_QUALITY, REVIEW_TEST, GENERATE_SYNTHETIC_DATA
- `AiReviewStatus`: PENDING, ACCEPTED, REJECTED
- `AiProvider`: OLLAMA, OPENAI, DEEPSEEK, OTHER
- `AssessmentType`: PRE_TEST, POST_TEST, QUIZ
- `AssessmentStatus`: DRAFT, PUBLISHED, ARCHIVED
- `AttemptStatus`: IN_PROGRESS, SUBMITTED, GRADED
- `UserRole`: ADMIN, INSTRUCTOR, PARTICIPANT

### 2.3 FK-ji z ON DELETE / ON UPDATE (iz `prisma/migrations/*/migration.sql`, končno stanje)

| FK (tabela.stolpec → tabela) | ON DELETE | ON UPDATE | Vir |
|---|---|---|---|
| Topic.trainingId → Training | RESTRICT | CASCADE | `20260527123000_.../migration.sql:33` |
| LearningObjective.topicId → Topic | RESTRICT | CASCADE | `20260527133000_.../migration.sql:43` |
| Question.topicId → Topic | RESTRICT | CASCADE | `20260522160442_.../migration.sql:19` |
| Question.learningObjectiveId → LearningObjective | SET NULL | CASCADE | `20260523144650_.../migration.sql:14` |
| Question.createdById → User | RESTRICT | CASCADE | `20260528110000_.../migration.sql:56` |
| Question.reviewedById → User | SET NULL | CASCADE | `20260528110000_.../migration.sql:57` |
| Question.equivalentGroupId → EquivalentQuestionGroup | SET NULL | CASCADE | `20260528130000_.../migration.sql:19` |
| AnswerOption.questionId → Question | CASCADE | CASCADE | `20260528120000_.../migration.sql:15` |
| Assessment.trainingId → Training | RESTRICT | CASCADE | `20260529091507_.../migration.sql:31` |
| AssessmentBlueprint.trainingId → Training | RESTRICT | CASCADE | `20260529144825_.../migration.sql:16` |
| AssessmentQuestion.assessmentId → Assessment | CASCADE | CASCADE | `20260529091507_.../migration.sql:34` |
| AssessmentQuestion.questionId → Question | RESTRICT | CASCADE | `20260529091507_.../migration.sql:37` |
| AssessmentAttempt.assessmentId → Assessment | RESTRICT | CASCADE | `20260529093610_.../migration.sql:38` |
| AssessmentAttempt.userId → User | **SET NULL** (spremenjeno iz RESTRICT) | CASCADE | `20260601202013_make_attempt_user_nullable/migration.sql:8` (prekriva `20260529093610_.../migration.sql:41`) |
| ParticipantAnswer.attemptId → AssessmentAttempt | CASCADE | CASCADE | `20260529093610_.../migration.sql:44` |
| ParticipantAnswer.questionId → Question | RESTRICT | CASCADE | `20260529093610_.../migration.sql:47` |
| ParticipantAnswer.selectedOptionId → AnswerOption | SET NULL | CASCADE | `20260529093610_.../migration.sql:50` |
| AiInteraction.aiModelId → AiModel | RESTRICT | CASCADE | `20260602075239_.../migration.sql:45` |
| AiInteraction.requestedById → User | RESTRICT | CASCADE | `20260602075239_.../migration.sql:48` |
| AiInteraction.sourceQuestionId → Question | SET NULL | CASCADE | `20260602075239_.../migration.sql:51` |
| AiInteraction.generatedQuestionId → Question | SET NULL | CASCADE | `20260602075239_.../migration.sql:54` |
| AiInteraction.reviewedById → User | SET NULL | CASCADE | `20260602075239_.../migration.sql:57` |

Opomba: `Question`, `Topic`, `LearningObjective`, `Training`, `Assessment` imajo **eksplicitni
RESTRICT** na svojih starševskih FK-jih (ne privzeti/implicitni, kot bi kazal sam `schema.prisma`
brez `onDelete` atributa) — MySQL bo torej vrnil FK-constraint napako, če obstajajo otroci, kar
controller-ji ne prestrežejo eksplicitno (glej §5, §11).

### 2.4 Indeksi in unique constrainti — povzetek

Vsi so navedeni zgoraj pri posamezni tabeli. Dodatno pomembno: `AssessmentAttempt` **nima**
`@@unique([assessmentId, userId])` — en uporabnik lahko ima poljubno število poskusov za isti
assessment (glej §7, §11). `ParticipantAnswer` ima `@@unique([attemptId, questionId])` — en
odgovor na vprašanje na poskus.

### 2.5 Odstopanja med `schema.prisma` in dejansko bazo

- **Poimenovanje modelov/tabel**: `npx prisma db pull --print` vrne modele z **malimi začetnicami**
  (`aiinteraction`, `answeroption`, `assessmentattempt`, ...), medtem ko `schema.prisma` in vse
  migracije uporabljajo PascalCase (`AiInteraction`, `AnswerOption`, ...). Razlog:
  `SELECT @@lower_case_table_names` → **`1`** (potrjeno poizvedbo, glej §2.6) — MySQL na tem
  Windows strežniku fizično shranjuje imena tabel z malimi črkami in jih obravnava case-insensitive.
  Vsebinsko (stolpci, tipi, FK-ji, indeksi, enumi) se introspektirana shema **ujema 1:1** s
  `schema.prisma` — ni bilo najdenih manjkajočih/dodatnih stolpcev, tipov ali FK-jev.
- To je **izključno okoljsko** (Windows dev-strežnik); na Linux/Docker MySQL z
  `lower_case_table_names=0` (pogosta produkcijska privzeta vrednost) bi bila imena tabel
  case-sensitive, kar je relevantno za morebitno migracijo okolja — glej §11.

### 2.6 Tehnične podrobnosti žive baze

```sql
SELECT VERSION(), @@lower_case_table_names;
-- '8.0.46', '1'
```
Vse tabele: `ENGINE=InnoDB`, `TABLE_COLLATION=utf8mb4_unicode_ci` (potrjeno za vseh 14 domenskih
tabel + `_prisma_migrations` prek `information_schema.TABLES`).

---

## 3. STANJE PODATKOV (žive SELECT poizvedbe, 2026-07-04)

### 3.1 Število vrstic po tabelah (točno, `COUNT(*)` prek Prisma)

| Tabela | Št. vrstic |
|---|---|
| User | 9 |
| Topic | 13 |
| Training | 6 |
| Question | 79 |
| AiModel | 8 |
| AiInteraction | 16 |
| Assessment | 5 |
| AssessmentBlueprint | 2 |
| AssessmentQuestion | 23 |
| AssessmentAttempt | 22 |
| ParticipantAnswer | 119 |
| AnswerOption | 147 |
| EquivalentQuestionGroup | 17 |
| LearningObjective | 11 |

(Seed (`prisma/seed.js`) sam po sebi ustvari bistveno manj vrstic — glej §10.4 — torej je večina
podatkov nastala z dejansko uporabo aplikacije/testiranjem po seedu, ne le s seed skripto.)

### 3.2 Distribucija enumov (dejansko prisotne vrednosti + pogostost)

- **User.role**: ADMIN=1, INSTRUCTOR=2, PARTICIPANT=6.
- **Question.type**: OPEN=33, CODE=9, MULTIPLE_CHOICE=37.
- **Question.status**: APPROVED=58, DRAFT=21. **`NEEDS_REVIEW`, `REVIEW`, `REJECTED`, `ARCHIVED` se
  v podatkih ne pojavljajo niti enkrat**, čeprav so vse 4 (razen NEEDS_REVIEW) dovoljene ciljne
  vrednosti endpointa `PATCH /questions/:id/status` (glej §5.5, §7).
- **AiModel.provider**: OLLAMA=6, OPENAI=1, DEEPSEEK=1. `OTHER`=0.
- **AiModel isActive×isLocal**: `{isActive:false,isLocal:true}`=1, `{isActive:true,isLocal:false}`=2,
  `{isActive:true,isLocal:true}`=5. Opomba: oba `isLocal:false` zapisa (OPENAI, DEEPSEEK) sta
  `isActive:true`, čeprav koda (`aiController.js` `resolveGenerationModel`) generacijo za
  ne-Ollama ponudnike izrecno zavrne (400/501) — `isActive=true` torej ne pomeni "dejansko
  uporaben za generacijo" (glej §9, §11).
- **AiInteraction.action**: GENERATE_QUESTION=5, GENERATE_EQUIVALENT_QUESTION=1,
  CHECK_EQUIVALENCE=1, CHECK_QUESTION_QUALITY=1, REVIEW_TEST=8. **`EDIT_QUESTION`,
  `GENERATE_SYNTHETIC_DATA`=0** (ujema se z ugotovitvijo iz kode — noben endpoint jih ne ustvarja).
- **AiInteraction.reviewStatus**: PENDING=13, ACCEPTED=2, REJECTED=1.
- **Assessment.type**: PRE_TEST=4, POST_TEST=1. **`QUIZ`=0** — čeprav je `QUIZ` privzeta vrednost v
  `createAssessment` (ko `type` ni podan) in fiksno v `generateAssessment`
  (`assessmentController.js:460`), v trenutnih podatkih ni niti enega `QUIZ` zapisa.
- **Assessment.status**: PUBLISHED=5. **`DRAFT`=0, `ARCHIVED`=0** — vseh 5 trenutnih assessmentov
  je v tem trenutku objavljenih; noben ni v pripravi ali arhiviran.
- **AssessmentAttempt.status**: IN_PROGRESS=5, SUBMITTED=4, GRADED=13. Glej §3.5 — `GRADED` je
  posebej analiziran spodaj, ker ga produkcijska koda nikoli ne piše.

### 3.3 Nullability v praksi (koliko od nullable stolpcev je dejansko NULL)

| Stolpec | NULL # | Opomba |
|---|---|---|
| User.firebaseUid | 8 / 9 | Samo 1 uporabnik (`jurij.dumic@gmail.com`, id=4) je dejansko prijavljen prek Firebase; ostalih 8 (seed-uporabniki) ima `firebaseUid=NULL` in se prijavlja/identificira le prek `externalAuthId` — nikoli še niso šli skozi `firebaseAuthMiddleware`'s prvi-login path. |
| User.name | 0 / 9 | Vedno izpolnjeno. |
| User.externalAuthId | 1 / 9 | Samo user id=4 (edini pravi Firebase-login) nima `externalAuthId`. |
| Question.learningObjectiveId | 8 / 79 | Večina vprašanj (71/79) ima nastavljen učni cilj. |
| Question.reviewedById | 21 / 79 | Ujema se točno s Question.status=DRAFT count (21) — vsako APPROVED vprašanje ima reviewerja, vsak DRAFT nima. |
| Question.reviewedAt | 21 / 79 | Isto kot zgoraj. |
| Question.equivalentGroupId | 53 / 79 | 26/79 vprašanj je v neki ekvivalenčni skupini. |
| Training.description | 2 / 6 | |
| Assessment.description | 0 / 5 | Vedno izpolnjeno. |
| Assessment.timeLimitMinutes | 2 / 5 | (assessment id 2 "kviz varnost" in id 5 "cyber" nimata časovne omejitve.) |
| AssessmentAttempt.userId | 0 / 22 | Kljub temu, da je stolpec nullable (`onDelete:SetNull` za primer brisanja uporabnika), v trenutnih podatkih noben poskus nima izbrisanega/NULL uporabnika. |
| AssessmentAttempt.submittedAt | 5 / 22 | Ujema se z IN_PROGRESS count (5). |
| AssessmentAttempt.score | 5 / 22 | Isto. |
| AssessmentAttempt.maxScore | 6 / 22 | 5 IN_PROGRESS + **1 dodaten** (glej §3.5 — seed-attempt id=1 je GRADED, a `maxScore=NULL`, ker ga seed skripta ni nastavila). |
| ParticipantAnswer.selectedOptionId | 5 / 119 | Ujema se s približnim številom OPEN/CODE odgovorov v podmnožici obstoječih odgovorov (ni nujno 1:1 z vsemi OPEN/CODE, ker manjkajo submittani odgovori za IN_PROGRESS poskuse, ki jih sploh ni). |
| ParticipantAnswer.answerText | 114 / 119 | Samo 5/119 odgovorov ima besedilni odgovor (torej ~5 OPEN/CODE odgovorov v tem naboru — ostalih 114 je MULTIPLE_CHOICE, `answerText=NULL`). |
| ParticipantAnswer.isCorrect | 2 / 119 | 2 odgovora imata `isCorrect=NULL` (ne-MC, še neocenjena). |
| ParticipantAnswer.pointsAwarded | 2 / 119 | Isto (ujema se z isCorrect NULL). |
| AiInteraction.resultText | 6 / 16 | 6/16 interakcij nima `resultText` (npr. `CHECK_EQUIVALENCE`/nekateri `REVIEW_TEST` z neuspelo narativo — glej §9). |
| AiInteraction.resultJson | 0 / 16 | Vedno izpolnjeno (tudi tam, kjer je `resultText` NULL). |
| AiInteraction.sourceQuestionId | 13 / 16 | 3/16 imajo izvorno vprašanje (`CHECK_EQUIVALENCE`, `GENERATE_EQUIVALENT_QUESTION` primeri). |
| AiInteraction.generatedQuestionId | 16 / 16 | **Noben** zapis nima `generatedQuestionId` nastavljen v trenutnih podatkih — glej §3.5/§9 (tudi 1 ACCEPTED GENERATE_EQUIVALENT_QUESTION primer ga nima, kar je nekonsistentno — glej anomalijo spodaj). |
| AiInteraction.reviewedById | 13 / 16 | 3/16 so že bile pregledane (ujema se z ACCEPTED=2 + REJECTED=1). |
| AiModel.displayName | 0 / 8 | Vedno izpolnjeno. |
| AiModel.baseUrl | 2 / 8 | OPENAI + DEEPSEEK modela nimata `baseUrl` (pričakovano, ker se dejansko ne uporabljata — glej §11). |
| EquivalentQuestionGroup.description | 0 / 17 | Vedno izpolnjeno. |
| LearningObjective.description | 0 / 11 | Vedno izpolnjeno. |

### 3.4 Distribucija dolžin besedilnih polj (`MAX(LENGTH(...))`)

| Stolpec | MAX(LENGTH) |
|---|---|
| Question.description | 107 |
| Question.title | 75 |
| AnswerOption.text | 76 |
| ParticipantAnswer.answerText | 76 |
| AiInteraction.prompt (`LongText`) | 1948 |
| AiInteraction.resultText (`LongText`) | 2535 |
| Training.description | 78 |
| Assessment.description | 76 |

Vsa "kratka" polja (`VARCHAR(191)` po Prisma privzeti dolžini za `String` v MySQL) so trenutno
daleč pod svojo dejansko kapaciteto (max opaženo 107 znakov od 191 dovoljenih) — trenutni podatki
ne dajejo indikacije o realnih potrebah po dolžini teh polj v produkciji z resničnimi vprašanji.
`prompt`/`resultText` sta `LongText` (brez praktične omejitve) in dejansko dosegata ~2-2.5k znakov.

### 3.5 Osirotele/nekonsistentne vrstice in podatkovne anomalije

**Preverjeno strukturno (0 najdenih primerov, torej integriteta drži za te primere):**
- `ParticipantAnswer.selectedOptionId` ki kaže na `AnswerOption` drugega vprašanja: **0**.
- `AssessmentQuestion` ki povezuje `Question` iz drugega `Training` kot `Assessment.trainingId`
  (cross-training tveganje, izrecno omenjeno v `docs/BACKEND-BRIEF.md:385-390`): **0** — trenutno
  ni kršitev, a shema tega ne preprečuje na nivoju baze (le app-level `validateQuestions`,
  `assessmentController.js:282-289`).
- `Question.type=MULTIPLE_CHOICE` brez ijedne `AnswerOption`: **0**.
- `Question.type≠MULTIPLE_CHOICE` a ima `AnswerOption` vrstice (osirotele opcije): **0** — ujema se
  z ugotovitvijo, da cleanup-logika v `questionController.js:156-173` (T5) deluje.
- `Question.status=APPROVED` brez `reviewedById`: **0**. `Question.status=DRAFT` z nastavljenim
  `reviewedById`: **0**.
- `AssessmentAttempt.status=SUBMITTED` brez `submittedAt`, ali `=GRADED` brez `score`, ali
  `=IN_PROGRESS` z nastavljenim `submittedAt`: **0** v vseh treh primerih.
- `Assessment.status=PUBLISHED` z 0 vprašanji: **0**.
- Uporabniki z vlogo INSTRUCTOR/ADMIN brez `firebaseUid`: **2** (seed `admin@example.com` in
  `instructor@example.com` — pričakovano, ker se ta dva demo-računa v tem trenutku ne prijavljata
  prek pravega Firebase toka, temveč (predvidoma) prek `externalAuthId`-poti — **NI PREVERJENO**,
  kako/če se ta dva računa dejansko prijavljata v praksi, glej §4 in Odprta vprašanja).

**Najdene anomalije:**

1. **`EquivalentQuestionGroup` s premalo člani (singleton/prazne skupine).** Poizvedba
   `LEFT JOIN Question ... GROUP BY eqg.id HAVING memberCount<2` vrne **5 od 17 skupin**: id=13
   (1 član), id=14,15,16,17 (0 članov, popolnoma prazne). To neposredno potrjuje odprto vprašanje
   iz `docs/BACKEND-BRIEF.md:177-194` (T4: "ali je dovoljena singleton/prazna skupina?") — **v
   praksi se to že dogaja**, verjetno kot stranski učinek brisanja zadnjega/edinega člana prek
   `DELETE /equivalent-question-groups/:id/questions/:questionId`
   (`equivalentQuestionGroupController.js:172-209`), ki ne preveri/ne izbriše prazne skupine.
2. **`AiInteraction.reviewStatus=ACCEPTED` in `action=GENERATE_QUESTION` brez
   `generatedQuestionId`: 1 zapis.** To se ujema s kodnim pregledom (§9): sprejem navadnega
   osnutka vprašanja (`GENERATE_QUESTION`) **nikoli ne ustvari `Question` vrstice** — edina akcija
   z dejanskim "accept → create Question" tokom je `GENERATE_EQUIVALENT_QUESTION`
   (`aiController.js:785-878`). Ta 1 ACCEPTED `GENERATE_QUESTION` zapis je torej "potrjen v
   AiInteraction smislu", a osnutek nikoli ni pristal kot resnično `Question` v banki — inštruktor
   bi ga moral ročno prepisati/ustvariti prek ločenega `POST /questions`.
3. **`AttemptStatus.GRADED` — 13 od 22 poskusov je v tem statusu, a noben endpoint v produkcijski
   kodi ga nikoli ne piše** (potrjeno z repo-wide grep za `status:\s*"GRADED"` in `status: "GRADED"`
   — edini zadetek v `.js` datotekah je `backend/prisma/seed.js:892`, znotraj
   `findOrCreateAssessmentAttempt`). Podrobna poizvedba nad vsemi 22 vrsticami
   (`SELECT id, assessmentId, userId, status, score, maxScore, ... FROM AssessmentAttempt`) pokaže:
   - Vrstica `id=1` (assessmentId=1, userId=3/`participant@example.com`, `maxScore=NULL`) **se
     ujema** z demo-poskusom, ki ga ustvari `seed.js:886-893` (`findOrCreateAssessmentAttempt(...,
     status:"GRADED")`, brez `maxScore`, kar pojasni edini "dodatni" `maxScore=NULL` primer iz §3.3).
   - Vrstice `id=4` do `id=15` (12 vrstic, assessmentId ∈ {3,4}, userId ∈ {3,5,6,7,8,9},
     `maxScore=8` dosledno, `createdAt` znotraj **~0.7 sekunde** druga od druge:
     `2026-06-05T09:35:46.481Z` → `2026-06-05T09:35:47.169Z`) **se NE ujemajo z ničemer v
     `seed.js`** — `seed.js` vsebuje samo eno kličočo mesto `findOrCreateAssessmentAttempt`
     (repo-wide grep potrjuje samo 1 klic funkcije, `seed.js:886`), ustvari samo 1 `Assessment`
     ("Demo predtest", id predvidoma =1) in nikjer ne omenja uporabnikov `ana.student@example.com`,
     `sara.student@example.com`, `luka.student@example.com`, `marko.student@example.com`,
     `nina.student@example.com` niti treninga "Introduction to Databases" (grep za vse te nize v
     `seed.js` in v **celotni git zgodovini** — `git log --all -p -S "ana.student" --
     backend`, `git log --all --oneline -S "Introduction to Databases" -- backend` — **oba brez
     zadetka**, glej metodologija spodaj).
   - **Zaključek: 12 od 13 `GRADED` vrstic (in ustrezni `User` id 5-9, `Training` id 5, `Assessment`
     id 3-4, del `Question`/`AnswerOption`/`ParticipantAnswer` vrstic) je v bazo prišlo prek
     mehanizma, ki ga v trenutnem repozitoriju (delovna kopija + celotna git zgodovina) ni mogoče
     najti** — ne prek `seed.js`, ne prek katerega koli API endpointa (noben ne piše
     `status:"GRADED"`). To je bodisi ročni vnos (npr. prek Prisma Studio ali direktnega SQL-a med
     pripravo demo/testnih podatkov za analitiko), bodisi zagon skripte, ki ni bila (ali ni več)
     del repozitorija. Za redesign je to pomembno: **`AttemptStatus.GRADED` je v shemi definiran,
     a v celotni doživeti kodni bazi nikoli ni bil dosežen prek app-flowa** — vsak "SUBMITTED"
     poskus v resnični uporabi ostane `SUBMITTED` za vedno, tudi če so vsa vprašanja
     avto-ocenjena MC (glej §7, §8).
   - Metodologija preverbe (za ponovitev): `SELECT id, assessmentId, userId, status, score,
     maxScore, startedAt, submittedAt, createdAt FROM AssessmentAttempt ORDER BY id;` +
     `git log --all -p -S "ana.student" -- backend` + `git log --all --oneline -S "Introduction to
     Databases" -- backend` (oba izvedena, glej rezultat zgoraj).

---

## 4. AUTENTIKACIJA IN VLOGE

### 4.1 Token → DB User (`backend/middleware/firebaseAuthMiddleware.js`, 79 vrstic, celotna datoteka prebrana)

1. `Authorization: Bearer <token>` header, sicer 401 (vrstice 6-16).
2. `getFirebaseAuth().verifyIdToken(idToken)` — **prava** verifikacija prek Firebase Admin SDK,
   ne samo dekodiranje (vrstica 18). Neveljaven/potekel token → 401 "Invalid or expired Firebase
   token" (vrstice 66-73), podrobnosti napake samo v server-side logu.
3. Iz dekodiranega tokena: `firebaseUid` (`decodedToken.uid`), `email`, `displayName` (vrstice 19-21).
   Brez email v tokenu → 401 (23-25).
4. **Lookup #1 — po `firebaseUid`** (`prisma.user.findUnique({where:{firebaseUid}})`, 27-31).
5. Če ni najden, **Lookup #2 — po `email`** (33-38). Če najden: **poveže** obstoječi (seed) zapis z
   Firebase UID-jem (`prisma.user.update(...{firebaseUid, ...})`, 40-49) — to je natanko pot, po
   kateri seed-uporabnik (npr. `instructor@example.com` z `externalAuthId` a brez `firebaseUid`)
   ob prvi resnični Firebase prijavi dobi svoj `firebaseUid` zapisan.
6. Če tudi po emailu ni najden: **avto-ustvari** novega `User` z `role:"PARTICIPANT"` (50-59) — vsak
   nov, doslej neznan Firebase identitet je torej avtomatsko `PARTICIPANT`, brez 401.
7. `req.user` = Prisma `User` vrstica; `req.firebaseUser` = surovi Firebase claims (62-63).

**Odgovor na "email ali firebaseUid":** primarno po `firebaseUid`, s fallbackom na `email` +
enkratno samodejno povezavo/avto-provizioniranje. Ni endpointa, ki bi to obnašanje spremenil.

### 4.2 Vloge — kje in kako (`backend/middleware/roleMiddleware.js`, celotna datoteka, 20 vrstic)

`requireRole(...roles)` bere `req.user.role` (enum vrednost iz baze, brez ponovnega poizvedovanja)
in preveri `allowedRoles.includes(req.user.role)`. Brez `req.user` → 403 (ne 401) — ta veja je
praktično nedosegljiva, ker `firebaseAuthMiddleware` vedno teče prej in ob uspehu vedno nastavi
`req.user`.

### 4.3 Kje se avtorizacija dejansko izvaja

Vsaka od **11 route datotek** montira `firebaseAuthMiddleware` na **vsak** endpoint (potrjeno po
vseh route-datotekah: `trainingRoutes.js`, `topicRoutes.js`, `learningObjectiveRoutes.js`,
`questionRoutes.js`, `equivalentQuestionGroupRoutes.js`, `userRoutes.js`, `authRoutes.js`,
`assessmentRoutes.js`, `assessmentAttemptRoutes.js`, `analyticsRoutes.js`, `aiRoutes.js`) — **noben
endpoint v sistemu ni javno dostopen brez veljavnega Firebase tokena.** Matrika vlog po domeni:

| Domena | Vloge |
|---|---|
| Training/Topic/LearningObjective/Question/EquivalentQuestionGroup CRUD | ADMIN, INSTRUCTOR |
| Users (`GET /users`, `PATCH /users/:id/role`) | **ADMIN samo** |
| Assessments (branje/reševanje) | ADMIN, INSTRUCTOR, PARTICIPANT (glej §5 za podrobno per-endpoint filtriranje) |
| Assessments (mutacije, `/results`) | ADMIN, INSTRUCTOR |
| Assessment attempts (start/submit/get) | ADMIN, INSTRUCTOR, PARTICIPANT + `canAccessAttempt` (self ali manager, `assessmentAttemptController.js:46-56`) |
| AI (generacija, review, modeli) | ADMIN, INSTRUCTOR (mutacije nad `AiModel` same ADMIN, `aiRoutes.js:50-52`) |
| Analytics (vseh 11 endpointov) | ADMIN, INSTRUCTOR (nikoli PARTICIPANT) |
| `GET /auth/me` | katerakoli avtenticirana vloga (brez `requireRole`) |

**Trenutno v shemi ni pojma "lastništva"** (npr. `Training.instructorId`) — avtorizacija je
izključno **po vlogi**, ne po tem, kdo je Training/Assessment ustvaril. To je izrecno
dokumentirano kot znana vrzel v `docs/BACKEND-BRIEF.md:274-276, 297-344` (glej §11, §12) — vsak
INSTRUCTOR trenutno vidi/ureja vse trening/vprašanja/preverjanja v sistemu, ne le svoja.

### 4.4 Legacy/druge vloge v kodi ali podatkih

- **`authMiddleware.js`** (`backend/middleware/authMiddleware.js`, celotna datoteka, 23 vrstic) —
  header-based (`x-user-id`/`x-user-email`/`x-user-role`), brez preverjanja podpisa. **Nikjer ni
  uvožen** (grep po vseh `.js` datotekah v `backend/` za `authMiddleware` vrne zadetke samo znotraj
  te datoteke same) — **potrjeno mrtva koda**, ni nikoli montirana v `server.js` ali kateri koli
  route datoteki.
- **"STUDENT" kot ime vloge**: **0 zadetkov** v kodi/shemi/podatkih (grep celotnega repozitorija,
  case-insensitive). Vsi zadetki na niz "student" so bodisi (a) prosto besedilo v AI promptu
  (`aiController.js:376`, "...expected student competency"), (b) vsebina demo-vprašanj/seed
  (`seed.js:440,446,562,650,654,834` — npr. tabela "Students" v SQL vajah), ali (c) namerno
  placeholder e-mail naslovi (`eva.student@projekt3.app` v `frontend-next/src/lib/mock-data.ts` in
  `role-context.tsx:69`; `ana.student@example.com` ipd. v živih seed-podatkih baze — glej §3.5,
  anomalija #3) — noben ni dejanska vrednost `UserRole` enuma. `docs/AUDIT.md:66` (predhodni
  avdit) je to isto že preveril in potrdil.

---

## 5. API POVRŠINA (de facto kontrakt)

Vseh **11 mount-prefixov** iz `backend/server.js:29-39`: `/auth`, `/questions`, `/topics`,
`/learning-objectives`, `/trainings`, `/equivalent-question-groups`, `/assessments`,
`/assessment-attempts`, `/analytics`, `/ai`, `/users`.

### 5.1 Training (`trainingRoutes.js` + `trainingController.js`)

| Metoda+pot | Auth | Telo/params | Odgovor |
|---|---|---|---|
| GET / | ADMIN,INSTRUCTOR | — | `Training[]`, brez include |
| GET /:id | isto | — | `Training`, 404 |
| POST / | isto | `{title,description}` | 201 `Training` |
| PUT /:id | isto | `{title,description}` | `Training`, 404 |
| DELETE /:id | isto | — | 204 (brez body) |

Brez cross-entity validacije; **brez preverbe otrok pred brisanjem** — glej §2.3 (RESTRICT FK) in
§11 (napaka se dvigne kot surov 500, ne 409).

### 5.2 Topic / LearningObjective — enak vzorec kot Training + cross-entity FK preverba

`topicController.js`: `createTopic` (46-93) in `updateTopic` (95-154) preverita, da `trainingId`
obstaja (65-75, 114-126). Bug pattern: `updateTopic` preverja `trainingId` samo `if (trainingId)`
truthy (114) — `trainingId=0` bi tiho preskočil validacijo (v praksi neškodljivo, ker so ID-ji
autoincrement od 1). `name===null` bi povzročil `.trim()` crash → nedopreteksten 500 (129-133).
Vse GET/vrnjeni objekti vključujejo `training`/`topic` (denormaliziran include, ne stolpec).
`learningObjectiveController.js`: `getLearningObjectives` (3-29) sprejme `?topicId=` query param.

### 5.3 Question (`questionController.js`, `questionRoutes.js:15-20`)

Skupni `questionInclude` (3-10): `topic, learningObjective, equivalentGroup,
answerOptions(orderBy orderIndex)` — na **vsakem** Question odgovoru.

- `createQuestion` (43-105): MC validacija (≥2 opcije, ≥1 pravilna, 58-69); "options only for MC"
  inverzna preverba (72-76); `createdById` postavi server (85, ne iz telesa — dobra praksa);
  `orderIndex` opcij izračunan iz array pozicije. **`topicId`/`learningObjectiveId`/
  `equivalentGroupId` se NE validirajo in NE `Number()`-koerčijo** (za razliko od Topic/LO
  controllerjev) — neveljaven ID pade v surov FK-error → 500.
- `updateQuestion` (107-194): MC validacija se **preskoči**, če se `type` spremeni na MC brez
  poslanih `options` v isti zahtevi (142: `if (updatedType==="MULTIPLE_CHOICE" && options)`).
  **Cleanup answerOptions ob spremembi tipa stran od MC** (T5, komentar v kodi 156-159, dejanska
  logika 160-173): `deleteMany:{}` se sproži, če `existing.type==="MULTIPLE_CHOICE" &&
  updatedType!=="MULTIPLE_CHOICE"` in noben nov `options` ni poslan; če `options` JE poslan, se
  vedno naredi full-replace (`deleteMany`+`create`), ne glede na tip.
- `updateQuestionStatus` (218-257, `PATCH /:id/status`): `allowedStatuses =
  ["REVIEW","APPROVED","REJECTED","ARCHIVED"]` (222) — **`DRAFT` in `NEEDS_REVIEW` nista nikoli
  dosegljiva prek tega API-ja** (vprašanje lahko samo ob `create` dobi `DRAFT`, nikoli se vanj ne
  vrne). `reviewedById`/`reviewedAt` se nastavita **samo** za `APPROVED`/`REJECTED` (238-245) — ni
  čiščenja teh polj pri kasnejšem `REVIEW`/`ARCHIVED`; brez avdit-zgodovine (samo zadnji reviewer).
- `deleteQuestion` (196-216): **brez pred-preverbe obstoja** (edini tak primer med vsemi entitetami)
  — manjkajoč `id` vrne generičen 500 "Something went wrong" namesto 404. Uspešen odgovor:
  `{message:"Question deleted"}` 200 (ne 204, za razliko od Training/Topic/LO).

### 5.4 EquivalentQuestionGroup (`equivalentQuestionGroupController.js`, 7 endpointov)

`addQuestionToGroup` (118-170, `POST /:id/questions`) — pravilo "T4" (komentar v kodi 143-145):
vprašanje že v TEJ skupini → idempotenten no-op; v DRUGI skupini → **409**, "remove first". To ni
izrazljivo v Prisma shemi (samo FK, ne workflow-pravilo). `removeQuestionFromGroup` (172-209) po
brisanju **ne preveri**, ali je skupina ostala prazna/singleton — kar pojasni najdene anomalije
(§3.5 #1). Response shape teh dveh endpointov je **surov `Question`** brez `questionInclude`
(nekonsistentno z `questionController.js`).

### 5.5 User (`userController.js`, ADMIN samo)

`VALID_ROLES` (3) je ročna JS-kopija Prisma enuma. `USER_SELECT` eksplicitno **izloči
`externalAuthId`** iz odgovorov (5-11) — polje obstaja v shemi, a se nikjer po imenu ne vrača v
API odgovorih tega controllerja (glede na vso avditirano kodo se `externalAuthId` nikjer ne bere
razen implicitno prek Prisma modela — brez drugih uporab v `backend/controllers/*.js`, kar ga
naredi de-facto neizpostavljenega prek API-ja, čeprav obstaja v podatkih). **Self-demotion guard**
(53-58): admin ne sme spremeniti lastne vloge stran od ADMIN (prepreči izgubo dostopa) — ne
preprečuje pa demote drugega/edinega drugega admina.

### 5.6 Assessment (`assessmentController.js`, 9 endpointov, `assessmentRoutes.js:18-26`)

- `getAssessments` (58-73): ne-manager vidi samo `status=PUBLISHED` (61-65).
- `getAssessment` (95-120): 403 za ne-manager na ne-PUBLISHED (112-114). **Odgovor vključuje
  `answerOptions` z `isCorrect` tudi za PARTICIPANT** (`assessmentDetailInclude`, 5-21, brez
  `select` filtra) — pravilni odgovori so razkriti v payloadu pred reševanjem; frontend to sicer
  strip-a na nivoju komponente/servisa (`sanitize.ts`, `assessmentAttempts.ts:42-56`), a **backend
  sam po sebi to razkrije**.
- `getAssessmentResults` (122-249, manager-only): računa `averageScore`, `averagePercentage`,
  `questionStats[].correctRate/averagePoints` — vse izračunano inline, nič shranjeno.
  **`summary.assignedParticipants` je vedno `null`** (230) — nedokončano/stub polje.
- `validateQuestions` (251-293, deljena guard funkcija za create/update/generate): brez duplikatov,
  `trainingId` obvezen, vsa vprašanja morajo obstajati, **status mora biti `APPROVED`** (277-280),
  in `question.topic.trainingId === assessment.trainingId` (282-289, cross-training zaščita na
  app-nivoju, ne v shemi).
- `createAssessment` (295-350): vedno `status:"DRAFT"` (323) — ni poti do neposrednega `PUBLISHED`
  ob kreaciji.
- `generateAssessment` (352-485): equivalent-group dedup po `id asc`, s "overflow" fallbackom, če
  ni dovolj distinktnih skupin (418-447) — **assessment lahko konča z 2 vprašanjema iz iste
  ekvivalenčne skupine**, če primanjkuje distinktnih skupin (soft preference, ne trda izključitev).
  `type` je fiksno `"QUIZ"` (460), ne glede na kontekst.
- `updateAssessment` (487-587): urejanje samo če `status==="DRAFT"` (513-517); 409, če obstaja
  **kateri koli** `SUBMITTED` poskus (519-523, "belt-and-suspenders" — DRAFT normalno nima
  poskusov).
- `updateAssessmentStatus` (589-620, `PATCH /:id/status`): **brez tranzicijskega grafa** — poljuben
  obstoječi status → poljuben nov status (`DRAFT/PUBLISHED/ARCHIVED`), brez guardov (npr.
  PUBLISHED→DRAFT je dovoljeno). **Brez preverbe "≥1 vprašanje" pred `PUBLISHED`** na tem
  endpointu (edina takšna preverba je ob `create`/`update` z `questions` payloadom).
- `deleteAssessment` (622-642): brez status-guarda; FK `RESTRICT` na `AssessmentAttempt` (§2.3) bo
  vrgel napako, če obstajajo poskusi — ni prestreženo eksplicitno.

### 5.7 AssessmentAttempt / ParticipantAnswer (`assessmentAttemptController.js`, 3 endpointi)

- `startAttempt` (58-107): samo za `status="PUBLISHED"` assessment (82-88). **Brez omejitve "en
  poskus na uporabnika na assessment"** — ni unique constrainta v shemi niti app-level preverbe;
  uporabnik lahko kliče `/start` poljubno-krat (potrjeno v živih podatkih — glej §3.5, userId=4 ima
  4 poskuse na assessmentId=4, id 18/20/21).
- `submitAttempt` (109-273): guard `status!=="IN_PROGRESS"` → 400 (150-152, edini "ne dvakrat"
  guard, na nivoju posameznega poskusa, ne uporabnika). MC ocenjevanje: `isCorrect =
  selectedOption.isCorrect` (212), `pointsAwarded = isCorrect ? points : 0` (213, all-or-nothing,
  brez delnih točk). OPEN/CODE: `isCorrect:null, pointsAwarded:null, needsManualReview:true`
  (238-243) — **`needsManualReview` se nastavi SAMO tukaj v celotni kodni bazi** (potrjeno z grep).
  Atomarno prek `$transaction` (246-267): delete+createMany+update attempta. **Noben endpoint
  nikoli ne postavi `status:"GRADED"`** (glej §3.5, §7, §8).
- `getAttempt` (275-300): `canAccessAttempt` (46-56) — self ali manager. Odgovor doda računski
  `textAnswer` alias (`answerText` preimenovan, 33-36) in `participantId` alias (`userId`, 38-44).

### 5.8 AiModel / AiInteraction (`aiController.js`, `aiModelController.js`, `aiRoutes.js`, 13 endpointov)

Glej §9 za podrobno lifecycle-analizo. Endpointi na kratko:
`POST /ai/question-draft`, `/ai/equivalence-suggestion`, `/ai/equivalent-question` (vsi
ADMIN/INSTRUCTOR, ustvarijo `AiInteraction`); `GET /ai/models` (ADMIN/INSTRUCTOR),
`POST|PATCH|DELETE /ai/models[...]` (**ADMIN samo**); `POST /ai/models/:id/test`, `GET
/ai/ollama/status` (ADMIN/INSTRUCTOR, vedno 200, tudi ob napaki — "report status, don't error"
vzorec); `GET /ai/interactions`, `PATCH /ai/interactions/:id/review` (ADMIN/INSTRUCTOR); `GET|POST
/ai/pre-post-insights` (ADMIN/INSTRUCTOR).

### 5.9 Analytics (`analyticsController.js`, 11 endpointov, `analyticsRoutes.js:22-35`)

Vsi ADMIN/INSTRUCTOR, nikoli PARTICIPANT. Izključno agregacija/branje — brez pisanja. Ključna
izračunana polja (nič shranjeno): `toPercentage` (5-11), `getPointsMap` (98-109),
`buildGroupedAnalytics` (177-209), `buildMcCorrectnessBreakdown` (213-246, **korektnost se računa
samo nad MULTIPLE_CHOICE odgovori**, izrecno v `note` polju odgovora, 724), `computePairedPrePost`
(314-424, pari zadnji SUBMITTED PRE_TEST + POST_TEST poskus na uporabnika), `getLeaderboard`
(778-863, PII samo če `revealed` — server-side re-check vloge kljub že obstoječemu route-gate,
789), `getQuestionOptionDistribution` (982-1061, `discriminationIndex: null` — **eksplicitno
neimplementirano**, stub polje kot `assignedParticipants`).

### 5.10 Denormalizacija / izračunana polja v odgovorih — zbirni seznam

| Endpoint | Polje | Vir |
|---|---|---|
| Vsi Question* | `topic`,`learningObjective`,`equivalentGroup`,`answerOptions` | Prisma `include`, ne stolpci |
| GET /assessments*, /:id | `training`,`questions[].question.answerOptions` | Prisma `include` |
| GET /assessments/:id/results | `summary.averageScore/averagePercentage`, `questionStats[].correctRate/averagePoints`, `attempts[].answersCount` | Izračunano v `assessmentController.js:165-219` |
| GET /assessment-attempts/:id | `textAnswer` (alias `answerText`), `participantId` (alias `userId`) | `assessmentAttemptController.js:33-44` |
| Vsi /analytics/* | percentage/korelacije/pari/leaderboard-rank | Izračunano v `analyticsController.js`, nič trajno shranjeno |
| POST /assessment-attempts/:id/submit odgovor | `score`,`maxScore` na `AssessmentAttempt` | Izračunano v JS med submit-om, shranjeno enkrat (§7/§8) |

---

## 6. FRONTEND (`frontend-next/`)

### 6.1 Strani in pokrivanje (route → glavna funkcionalnost)

Popoln seznam 30 route datotek je bil popisan (dashboard, trainings list/detail, questions
bank/detail/equivalent-groups, assessments list/new/detail/post-test/results, participant
access/solve/result, my-assessments/my-results, analytics + 6 pod-pogledov (leaderboard, trends,
question-analysis, participants list/detail), AI (insights/review/models), admin (users)) — glej
citate spodaj po straneh. Servisi: `src/services/{trainings,topics,learningObjectives,questions,
equivalentGroups,assessments,assessmentAttempts,analytics,ai,aiAuthoring,users,apiClient}.ts`.
Tipi: `src/types/{enums,models}.ts` (glej §6.3, dobesedno prepisano iz teh datotek).

### 6.2 De facto kontrakt po strani (endpoint → brano polje)

- **Trainings list/detail**: `trainingsService.*`, `topicsService.*`, `learningObjectivesService.*`,
  `questionsService.list`, `assessmentsService.list`, `usersService.*`,
  `analyticsService.summary/prePostComparison/byTopic`. Bere polno paleto realnih polj (glej §11
  za pomembno izjemo — `training-view.ts` bridge).
- **Question bank/detail**: `questionsService.*`, `aiAuthoringService.*` — bere `status` za
  gating tranzicij (`app.questions.$id.tsx:498,508,527`), `answerOptions`, AI draft polja
  `title/description/difficulty/type/answerOptions` (skladno z `resultJson` shemo iz backend
  T3-ticketa, glej §9).
- **Equivalent groups**: `equivalentGroupsService.*`, filtrira `q.equivalentGroupId===null` za
  "unassigned" (`app.questions.equivalent-groups.tsx:151-153`).
- **Assessments list**: `assessmentsService.list` — "Submitted"/"Avg" stolpca sta **trdo-kodiran
  `—`**, nikoli iz nobene poizvedbe (`app.assessments.index.tsx:310-311`) — izgleda ožičeno, a ni.
- **Assessment detail**: `assessment.status/type/training/timeLimitMinutes/questions`,
  `canPublish = questions.length>0 && approvedCount===questions.length`
  (`app.assessments.$id.tsx:267`) — **client-side guard, ki ga backend `updateAssessmentStatus` ne
  uveljavlja** (glej §5.6, §11).
- **Assessment results (instructor)**: bere bespoke `AssessmentResults` obliko (ne `Assessment`),
  vključno z `summary.assignedParticipants` eksplicitno obravnavan kot "vedno null"
  (`app.assessments.$id.results.tsx:115-116`).
- **Participant solve/result/access**: `assessmentAttemptsService.*`, `attempt.answers[].
  {isCorrect,needsManualReview,pointsAwarded}`, `assessment.questions[].points`. **`attempt-
  storage.ts` (localStorage shim)** nadomešča manjkajoč "list my attempts" backend endpoint —
  glej §10 (TODO).
- **Analytics dashboard + 6 podpogledov**: bere `AnalyticsSummary`, `PrePostComparison`
  (`pairedUserCount`), `TopicAnalytics[]`, `Leaderboard.revealed` (nikoli lokalne domneve o
  razkritju — dober primer discipline, `app.leaderboard.tsx:55-57`), `ParticipantProfile`
  (`prePost.hasBoth`, `strongAreas/weakAreas`), `QuestionAnalytics.discriminationIndex` (vedno
  null, glej §5.9).
- **AI review/insights/models (admin+instructor)**: `aiService.*`, bere `AiInteraction.action/
  aiModel/requestedBy/sourceQuestionId/generatedQuestionId/reviewStatus`.
- **Users (admin)**: `usersService.list/updateRole`.

### 6.3 Trdo-kodirani enumi, ki jih redesign ne sme tiho podreti

Tipsko-varni (`Record<Enum,...>`, kompajler bi zaznal nov member): `AssessmentStatus`
(`app.assessments.$id.tsx:95-101` idr.), `AssessmentType`, `QuestionType`, `QuestionStatus`
(vključno s tabom za status-tranzicije, `app.questions.index.tsx:44-61`), `AiAction`
(`app.ai-review.tsx:49-58`), `AiReviewStatus`, `UserRole` (`app.users.tsx:40`,
`lib/role-context.tsx:46-50`), `AiProvider`, `TrendGranularity`.

**Šibko tipizirani `Record<string,string>`** (nov enum member bi tiho padel skozi `?? rawValue`,
brez compile-napake — višje tveganje): `QUESTION_STATUS_LABEL` (`app.assessments.$id.tsx:110-116`),
`ASSESSMENT_TYPE_LABEL`, `QUESTION_TYPE_LABEL`, `ASSESSMENT_STATUS_META`/`QUESTION_STATUS_META`
(`app.trainings.$id.tsx:96-121`).

**If/else verige** (funkcionalno enako tveganje, a raztresene po 5+ datotekah neodvisno):
`difficultyLabel()` numerična preslikava `{1,2,3}→Easy/Medium/Hard`, podvojena neodvisno v
`app.questions.$id.tsx:66,640`, `app.questions.index.tsx:40`, `app.trainings.$id.tsx:94`,
`app.question-analysis.tsx:51-52`, `app.assessments.new.tsx:965-967` — redesign, ki spremeni
`difficulty` iz `Int(1-3)` v poimenovan enum ali razširi lestvico, mora vseh 5 mest posodobiti
ročno, ker nobeno ne izhaja iz skupne konstante.

**Frontend-only vrednost brez backend ustreznika**: `app.assessments.new.tsx:543,969-973` —
UI ponuja 4 tipe preverjanja ("Pre-test"/"Post-test"/"Regular test"/"Practice"), a
`mapAssessmentType()` strne "Regular test" IN "Practice" oba na backend `"QUIZ"` — razlika je
realna v UI, a nevidna v bazi.

### 6.4 Kje frontend predpostavlja obliko/nullability, ki je baza ne sme podreti

- `services/assessmentAttempts.ts:44`: `attempt.assessment!` — non-null assert kljub `?` v tipu;
  varno samo zaradi predhodnega guarda eno vrstico prej.
- `app.my-assessments.tsx:74`, `app.assessments.index.tsx:77`: `a.training!` non-null assert,
  varno samo zaradi predhodnega `.filter((a)=>a.training)`.
- `app.assessments.$id.tsx:263,267`: `canPublish` privzema, da je `item.question` vedno
  populiran (opcijsko po tipu) — če bi bila `AssessmentQuestion` osirotela (vprašanje trdo
  izbrisano), bi se `approvedCount` tiho napačno prištel namesto opozorila o pokvarjenih podatkih.
- `assessment.$id.result.tsx:78`: `Number(item.points ?? 0)` — defenzivno obravnava `points` kot
  morda manjkajoč, čeprav je tip `number` (obvezen) — neskladje med tipom in defenzivno kodo.
- `lib/training-view.ts:19-36` + vse strani, ki jo kličejo — glej §6.5 (mock bridge).

### 6.5 Mock podatki, ožičeni v "resnično" izgledajoče strani (kritično za redesign-vidnost)

- **`app.dashboard.tsx`** — celotna glavna stran po loginu (za vse 3 vloge) je zgrajena **izključno**
  iz `src/lib/mock-data.ts` (`TRAININGS, ASSESSMENTS, USERS, AI_MODELS, RECENT_ACTIVITY,
  MY_ASSESSMENTS, QUESTIONS, PROGRESS_OVER_TIME`, uvoz na `app.dashboard.tsx:18-27`). **Nič
  resničnih API klicev** na tej strani (potrjeno z grep). Vsak DB redesign bo tu **nevidno** — stran
  bo še naprej "izgledala narejena" in skrivala regresije.
- **`app.trainings.$id.tsx:65,537`**: `RECENT_ACTIVITY` iz mock-data, prikazan poleg resničnih
  `trainingsService`/`analyticsService` poizvedb na isti strani.
- **`lib/training-view.ts`**: bridge, ki vsakemu resničnemu `Training` doda izmišljene privzete
  vrednosti (`participants:0, instructor:"—", status:"Active", curriculumCoverage:0, avgScore:0`,
  vrstice 24-34) — vsaka kartica treninga na `/app/trainings` prikazuje te privzete vrednosti,
  ne glede na resnično stanje; redesign, ki dejansko doda te podatke v `Training`, mora ta bridge
  ročno odstraniti, sicer bodo novi podatki tiho prekriti s privzetimi.
- **`app.assessments.index.tsx:310-311`**: "Submitted"/"Avg" stolpca — glej §6.2.

---

## 7. ŽIVLJENJSKI CIKLI IN POSLOVNA PRAVILA V KODI

### 7.1 Question.status

`DRAFT` (privzeto ob create, `schema.prisma:55`) → `PATCH /questions/:id/status` z
`{status}` ∈ `{REVIEW,APPROVED,REJECTED,ARCHIVED}` (`questionController.js:222`) — **ni poti nazaj
v `DRAFT` ali v `NEEDS_REVIEW` prek API-ja**; kdorkoli z vlogo ADMIN/INSTRUCTOR (vključno z
avtorjem samega vprašanja — ni ločene "reviewer ≠ author" preverbe) lahko spremeni status.
`reviewedById`/`reviewedAt` se nastavita samo pri `APPROVED`/`REJECTED` (238-245), se ne čistita ob
kasnejših tranzicijah — samo zadnji reviewer je viden, brez zgodovine.

### 7.2 Assessment.status

`DRAFT` vedno ob create (`createAssessment:323`, `generateAssessment` isto) → poljubna tranzicija
prek `PATCH /:id/status` **brez tranzicijskega grafa** (`updateAssessmentStatus:589-620`) — ni
guarda "ne prazno v PUBLISHED", ni guarda proti nazaj-tranzicijam. Urejanje vsebine (vprašanja)
dovoljeno samo v `DRAFT` in samo če ni `SUBMITTED` poskusov (`updateAssessment:513-523`).

### 7.3 AssessmentAttempt.status

`IN_PROGRESS` ob `/start` (samo za `PUBLISHED` assessment, brez omejitve "en poskus na
uporabnika") → `SUBMITTED` prek `/submit` (samo enkrat na poskus, guard na nivoju vrstice ne
uporabnika) → **`GRADED` se v produkcijski kodi nikoli ne doseže** (glej §3.5, edini pisalec je
`seed.js:892`). V praksi torej vsak resnično-oddani poskus ostane trajno v stanju `SUBMITTED`, ne
glede na to, ali so vsa vprašanja avtomatsko ocenjena (vsa MC) ali ne.

### 7.4 AiInteraction.reviewStatus

`PENDING` ob vsakem od 4 ustvarjalnih mest (glej §9) → `ACCEPTED`/`REJECTED` prek `PATCH
/ai/interactions/:id/review`, **samo iz `PENDING`** (409 sicer, `aiController.js:761-765`) — enkraten,
enosmeren prehod; ni endpointa za ponovno odprtje/razveljavitev.

### 7.5 Validacije, ki niso v shemi (zbirni seznam, podroben citat v §5)

MC mora imeti ≥2 opcije in ≥1 pravilno; opcije samo za MC; vprašanja v assessmentu morajo biti
`APPROVED` in iz istega treninga kot assessment; vprašanje je v največ eni ekvivalenčni skupini
hkrati, premik zahteva eksplicitno odstranitev; self-demotion admin guard; assessment urejanje
samo v DRAFT/brez SUBMITTED poskusov.

### 7.6 Score / maxScore — kje in kako

`score` = vsota `pointsAwarded` čez vse oddane odgovore (samo MC prispeva netrivialno, OPEN/CODE
vedno `pointsAwarded=null`, ne prišteje se) — izračunano v JS med `submitAttempt`
(`assessmentAttemptController.js:195-226`), shranjeno enkrat na `AssessmentAttempt.score`.
`maxScore` = vsota `AssessmentQuestion.points` (privzeto 1) za **vsa** vprašanja assessmenta, ne
glede na tip (`:163-166`) — torej OPEN/CODE vprašanja **trajno znižujejo dosežen odstotek**, ker
štejejo v `maxScore`, a nikoli v `score` (ni mehanizma za ročno oceno, glej §8). Nobeno od teh
dveh polj se kasneje ne preračuna (npr. ob ročni oceni OPEN/CODE) — mehanizma za to ni.

---

## 8. OCENJEVANJE

### 8.1 MULTIPLE_CHOICE — samodejno

`selectedOptionId` obvezen, mora biti veljavna opcija tega vprašanja
(`assessmentAttemptController.js:196-210`). `isCorrect = selectedOption.isCorrect` (212) —
neposredno kopirano iz `AnswerOption.isCorrect`. `pointsAwarded = isCorrect ? points : 0` (213) —
**all-or-nothing, brez delnih točk**.

### 8.2 OPEN in CODE — ročno ocenjevanje

Ob submit: `isCorrect:null, pointsAwarded:null, needsManualReview:true`
(`assessmentAttemptController.js:238-243`). **V celotni kodni bazi ne obstaja noben endpoint, UI
ali koda, ki bi kasneje nastavila `isCorrect`/`pointsAwarded` za tak odgovor** (potrjeno z grep za
`needsManualReview` — edini zadetki so ti dve mesti pisanja; brez `PATCH`/`PUT` route za
"grade answer"). To je skladno z `docs/mvp-scope.md:107` ("samodejno ocenjevanje odprtih
odgovorov" je izrecno **izven MVP**) in z `docs/BACKEND-BRIEF.md:518-520` (znan, dokumentiran
manko: "OPEN/CODE ročno ocenjevanje... ločen task"). CODE se **nikjer ne avtomatsko preverja**
(ni sandboxa/izvajanja kode) — obravnava se enako kot OPEN (isti kodni blok, brez ločitve po tipu
razen shranjevanja surovega besedila).

### 8.3 Kje se označi "čaka pregled"

`ParticipantAnswer.needsManualReview = true` (edino ta zastavica; ni ločenega
"assessment/attempt čaka pregled" polja na `AssessmentAttempt` ali `Assessment` nivoju — informacija
je razpršena po posameznih odgovorih). Frontend jo bere kot "Pending manual review" oznako
(potrjeno v `AUDIT-DEV-B.md:55`, G8-preverba: OPEN/CODE nikoli prikazan kot "Incorrect").

---

## 9. AI ADVISORY VEDENJE

### 9.1 Kje in kako nastane `AiInteraction` (4 mesta ustvarjanja, vsa `reviewStatus:"PENDING"`)

1. `generateQuestionDraft` (`aiController.js:397-488`) — `action:"GENERATE_QUESTION"`,
   `resultJson` = strukturiran osnutek (`{title,description,difficulty,type,answerOptions}`,
   parsiran/validiran iz Ollama JSON izhoda prek `parseStructuredDraft`/`buildStructuredQuestion`,
   61-98, 444-461), `resultText` = surov tekst modela (transparentnost). Ustvarjeno: 463-473.
2. `suggestQuestionEquivalence` (490-606) — `action:"CHECK_EQUIVALENCE"`, primerja **dve obstoječi**
   vprašanji, `resultText` = surov narativni tekst (**ni JSON-parsiran**, za razliko od ostalih
   akcij), `sourceQuestionId` nastavljen; `questionBId` **se nikjer ne persistira** (samo v HTTP
   odgovoru).
3. `generateEquivalentQuestion` (610-723) — `action:"GENERATE_EQUIVALENT_QUESTION"`, generira **nov**
   ekvivalent iz `sourceQuestionId`, deducira `topicId/learningObjectiveId/difficulty/type` iz
   izvora (680-696).
4. `getPrePostInsights` (998-1090) — `action:"REVIEW_TEST"`, `resultJson` = pre/post primerjava
   (deljena `computePrePostComparison` funkcija z `/analytics/pre-post-comparison`), `resultText` =
   AI narativ (lahko `null`, če Ollama-klic ne uspe — napaka se poroča kot
   `narrativeUnavailableReason`, ne 5xx).

### 9.2 Potrditev: noben AI izhod se ne auto-objavi/oceni

- `reviewAiInteraction` (`aiController.js:725-902`, `PATCH /ai/interactions/:id/review`) sprejme
  samo `{reviewStatus: "ACCEPTED"|"REJECTED"}` (729, 737-741) — `"PENDING"` ni dovoljena ciljna
  vrednost. Guard: trenutni status mora biti `PENDING`, sicer 409 (761-765).
- Repo-wide grep za pisanje `reviewStatus` izven `PENDING` privzete vrednosti pokaže **samo** to
  eno mesto (plus `seed.js` fixture podatke, 658/679/703 — ne produkcijska pot).
- Repo-wide grep za `status:"APPROVED"` na `Question` pokaže **samo** `questionController.js:242`
  (`updateQuestionStatus`, ločen, človeško-sprožen endpoint) — **noben AI-kodni pot nikoli ne
  nastavi `Question.status`**; novo vprašanje iz sprejetega AI-ekvivalenta je vedno trdo-kodirano
  `status:"DRAFT"` (`aiController.js:840`), zahteva ločen `PATCH /questions/:id/status` za
  `APPROVED`.
- **Zaključek (podprt s kodo, ne z domnevo): noben kodni pot ne auto-potrdi `AiInteraction` ali
  auto-odobri `Question`; oboje zahteva eksplicitno človeško dejanje prek vlogo-zaščitenega
  endpointa.** Sklada se z `docs/mvp-scope.md:89-96` in `CLAUDE.md` pravili.

### 9.3 Vezava AI izhoda na vprašanja + review flow

Samo `GENERATE_EQUIVALENT_QUESTION` ima poseben "accept & create" tok (785-878, znotraj
`$transaction`, 813-867): določi/ustvari `EquivalentQuestionGroup` (818-828), ustvari `Question`
(vedno `status:"DRAFT"`, `createdById = reviewerId`, ne AI ne prvotni requester), poveže
`AiInteraction.generatedQuestionId`. **`GENERATE_QUESTION` sprejem NE ustvari `Question` vrstice
nikjer** — to je potrjena vrzel (glej §3.5, anomalija #2: 1 živ primer natanko tega). `Ollama`
integracija: `OLLAMA_BASE_URL`, `OLLAMA_TIMEOUT_MS` (privzeto 120000ms, `lib/ollama.js:9`,
`config/ai.js`); ne-Ollama ponudniki (`OPENAI`,`DEEPSEEK`) so v konfiguraciji/shemi/seedu, a
`resolveGenerationModel` (`aiController.js:264-334`) jih izrecno zavrne za generacijo (400/501) —
**samo Ollama je dejansko ožičen**, skladno s `CLAUDE.md` pravilom ("generacija teče samo proti
aktivnemu lokalnemu Ollama modelu").

---

## 10. ZNANI WORKAROUNDI, TEHNIČNI DOLG, MRTVA KODA

### 10.1 TODO/FIXME/HACK (repo-wide grep, `backend/`+`frontend-next/`)

- `backend/config/ai.js:74` — `// TODO: Later AI endpoint issues should select the active AiModel
  from the database.` — deluje zastarelo, ker `resolveGenerationModel` v `aiController.js` že
  dela DB-vodeno resolucijo modela (tako override kot privzeto).
- `frontend-next/src/lib/attempt-storage.ts:9` — `// TODO(hardening track): add GET
  /assessment-attempts (mine) on the backend...` — dokumentira konkreten workaround: ker ne
  obstaja backend "moji poskusi" endpoint, se ID-ji poskusov obstojijo v localStorage.
  Podkrepljeno tudi v `frontend-next/SERVICES.md:141` in `ARCHITECTURE.md:453`.
- `frontend-next/src/routes/app.questions.$id.tsx:974` — `TODO(Dev B): "Generate equivalent
  question"...` — zastarel planning-komentar (endpoint je medtem implementiran).

Brez FIXME/HACK/XXX/@deprecated zadetkov v resnični kodi (samo v package-lock hash-ih, kar so
lažni pozitivi).

### 10.2 Mrtva koda

- **`backend/middleware/authMiddleware.js`** — glej §4.4, popolnoma neuporabljen legacy
  header-based auth (varnostno tvegan, če bi ga kdo po pomoti ponovno uvozil).
- **`AssessmentBlueprint`** (model + `assessmentBlueprintController`-ekvivalenta **ni**) — **mrtva
  shema**: ni route datoteke, ni controllerja (grep po `backend/routes`+`backend/controllers` za
  `[Bb]lueprint` vrne 0 zadetkov). Edine reference: `prisma/schema.prisma:144-154`,
  `prisma/seed.js` (`findOrCreateAssessmentBlueprint`, 1 seed-vrstica), migracije, `schema.sql`,
  `ERD.svg`. Tabela obstaja v živi bazi z **2 vrsticama** (§3.1) — a nobenega API-ja, ki bi jo
  bral/pisal. Frontend omenja besedo "blueprint" samo kot UI-copy/marketing izraz za
  auto-generacijo preverjanj (`app.trainings.$id.tsx`, `app.assessments.new.tsx` idr.), ne kot
  klic na to entiteto — ni `assessmentBlueprintsService` v `frontend-next/src/services`.
- **`AiAction.EDIT_QUESTION`, `AiAction.GENERATE_SYNTHETIC_DATA`** — v enumu in v backend
  allow-listi (`aiController.js:8,13`), a nikoli ustvarjena v produkcijski kodi (0 v živih
  podatkih, §3.2).
- **6 shadcn/ui komponent v `frontend-next/src/components/ui/`** (`menubar, context-menu,
  input-otp, carousel, command, drawer`) — nikjer uvožene drugje v `src/` (grep 0 zadetkov) —
  vlečejo za sabo 6 sicer neuporabljenih odvisnosti (`@radix-ui/react-menubar`,
  `@radix-ui/react-context-menu`, `input-otp`, `embla-carousel-react`, `cmdk`, `vaul`,
  `package.json:22,27,48,50,52,64`).
- Dvojna vzporedna AI-servisna plast: `frontend-next/src/services/ai.ts` in `aiAuthoring.ts` imata
  prekrivajoče se metode proti istim endpointom (`listModels`, `ollamaStatus`, `reviewInteraction`)
  z **ločeno** definiranimi TS tipi (`AiModelSummary`, `OllamaStatus`, `ReviewInteractionResult`) —
  ni deljeno, tveganje razhajanja.

### 10.3 Delno/nedokončano (stub polja)

- `AssessmentResults.summary.assignedParticipants` — vedno `null`, nikoli izračunano
  (`assessmentController.js:230`, potrjeno tudi v frontend tipu `models.ts:205` s komentarjem).
- `QuestionAnalytics/QuestionOptionDistribution.discriminationIndex` — vedno `null`, izrecno
  neimplementirano (`analyticsController.js:980-981,1051`).
- `AttemptStatus.GRADED` — definiran v shemi, brez kode, ki bi ga dosegla (§3.5, §7.3).

### 10.4 `backend/prisma/seed.js` — vsebina (za kontekst, ne za redesign samega)

Idempotentno seedanje: 3 osnovni demo-uporabniki (`admin@example.com`, `instructor@example.com`,
`participant@example.com`, hardcoded `externalAuthId`), 1 Training ("Osnove informatike"), 3
Topic, 2 LearningObjective, 1 EquivalentQuestionGroup, 8 Question (vsa `APPROVED`, brez
DRAFT/REVIEW/REJECTED primerov v seedu), 3 AiModel (po 1 na ponudnika — glej §11 za neskladje s
tem, kaj je dejansko ožičeno), 3 AiInteraction demo-sledi, 1 AssessmentBlueprint (v mrtvo tabelo),
1 Assessment ("Demo predtest"), 1 AssessmentAttempt (`GRADED`, edini kodni pisalec tega statusa).
**Živa baza vsebuje bistveno več** (79 vprašanj, 6 treningov, 5 assessmentov, 9 uporabnikov, 17
skupin) — razlika je nastala z dejansko uporabo aplikacije (in v enem dokumentiranem primeru, z
mehanizmom, ki ga v repozitoriju ni mogoče najti — glej §3.5, anomalija #3).

---

## 11. RAZKORAKI IN TVEGANJA (opisno, brez rešitev)

1. **Avtorizacija je samo po vlogi, ne po lastništvu.** Vsak INSTRUCTOR vidi/ureja vse
   Training/Topic/Question/Assessment v sistemu, ker shema nima nobenega "lastnik" atributa
   (`Training.instructorId` ne obstaja). To je izrecno, obsežno dokumentirano kot naslednji korak v
   `docs/BACKEND-BRIEF.md:257-522` (celoten "Chat C" predajni brief obravnava natanko to vrzel,
   vključno s priporočenim sidrom `Training.instructorId`, 404-vs-403 konvencijo, "question bank"
   scoping vprašanjem in cross-training tveganjem) — dokument je **nepotrjen, neimplementiran
   predlog**, ne obstoječe stanje; NI del trenutne kode.
2. **FK `RESTRICT` brez prijaznega error-handlinga.** Training/Topic/LearningObjective/Assessment
   imajo eksplicitni `ON DELETE RESTRICT` proti svojim staršem (§2.3), a noben od ustreznih
   `delete*` controllerjev preveri otroke vnaprej — brisanje s starši obstoječimi otroki vrne surovo
   Prisma FK-napako kot generičen 500, namesto 409/400 (npr. `trainingController.js` delete,
   `topicController.js` delete, `learningObjectiveController.js` delete,
   `assessmentController.js:622-642` delete).
3. **`deleteQuestion` nekonsistenten z ostalimi delete-i**: brez pred-preverbe obstoja (edini tak
   primer), manjkajoč id → 500 namesto 404; uspešen odgovor `{message}` 200 namesto `204`
   (`questionController.js:196-216`) — enako `equivalentQuestionGroupController.js` delete (200,
   ne 204). Splošneje: delete-odgovori niso enotni v celotnem API-ju (`204` za
   Training/Topic/LearningObjective, `{message}` 200 za Question/EquivalentQuestionGroup) —
   dokumentirano tudi v `frontend-next/src/types/models.ts:9-12` kot znan de-facto kontrakt, ki ga
   mora frontend ročno obravnavati na obeh straneh.
4. **`createQuestion`/`updateQuestion` ne validirata/koerčijo FK-jev** (`topicId`,
   `learningObjectiveId`, `equivalentGroupId`) za razliko od `Topic`/`LearningObjective`
   controllerjev, ki to dosledno delajo — neveljaven ID pade v surovo FK-napako (500) namesto
   čist 400/404 (`questionController.js:43-105,107-194`).
5. **`AssessmentAttempt` brez omejitve "en poskus na uporabnika na assessment"** — ni unique
   constrainta v shemi, ni app-level preverbe pri `startAttempt`
   (`assessmentAttemptController.js:58-107`) — potrjeno v živih podatkih (userId=4 ima 4 poskuse na
   istem assessmentu, §3.5).
6. **`AttemptStatus.GRADED` nedosegljiv prek app-flowa** — vsak resnično oddani poskus ostane
   trajno `SUBMITTED`, tudi če je 100% avto-ocenjen (vse MC) — glej §3.5, §7.3, §8. To pomeni, da
   trenutna shema modelira razliko med "oddano" in "ocenjeno", ki je v praksi nikoli ne uporabi.
7. **OPEN/CODE odgovori trajno znižujejo `maxScore`-relativni odstotek brez možnosti popravka** —
   ni ročnega ocenjevalnega mehanizma (§8.2); `score`/`maxScore` na `AssessmentAttempt` se po
   `submit`-u nikoli ne preračunata.
8. **Answer-leakage**: `GET /assessments`, `GET /assessments/:id` vrneta `answerOptions.isCorrect`
   tudi udeležencu pred reševanjem (`assessmentController.js:5-21`, `assessmentDetailInclude` brez
   `select`-filtra) — zaščiteno samo na frontend nivoju (`lib/sanitize.ts`), ne na backend nivoju.
   Dokumentirano tudi kot znan "leak" v `frontend-next/src/types/models.ts:7-8,72-73`.
9. **`EquivalentQuestionGroup` lahko postane prazna/singleton** — `removeQuestionFromGroup`
   (`equivalentQuestionGroupController.js:172-209`) ne preveri stanja skupine po odstranitvi;
   potrjeno v živih podatkih (5/17 skupin ima <2 člane, §3.5). Pravilo "ali je to dovoljeno" ni
   nikjer eksplicitno odločeno v kodi (odprto vprašanje, tudi navedeno v
   `docs/BACKEND-BRIEF.md:190`).
10. **AI `GENERATE_QUESTION` sprejem ne ustvari `Question`** — edina AI-akcija s celotnim
    "accept→create" tokom je `GENERATE_EQUIVALENT_QUESTION` (§9.3); sprejem navadnega osnutka
    (`GENERATE_QUESTION`) samo obrne `AiInteraction.reviewStatus`, brez posledic na `Question`
    tabeli — potrjena živa neskladnost (§3.5, anomalija #2).
11. **`AiModel.isActive` ne pomeni "dejansko uporaben"** — OPENAI/DEEPSEEK modela sta `isActive:
    true` v podatkih, a `resolveGenerationModel` ju zavrne za generacijo, ker ni implementacije
    (§3.2, §9.3, `config/ai.js:74` TODO). Config/shema/seed modelirajo 3-ponudniški sistem; deluje
    samo 1 (Ollama).
12. **Windows-specifičen `lower_case_table_names=1`** — trenutna dev-baza fizično shranjuje imena
    tabel z malimi črkami (§2.5, §2.6); na Linux/Docker MySQL z `lower_case_table_names=0`
    (pogosta produkcijska nastavitev) bi bila imena tabel case-sensitive, kar je relevantno za
    prenos okolja. **NI PREVERJENO**, kakšna nastavitev velja na morebitnem produkcijskem/CI okolju.
13. **Mock-podatki, ožičeni v produkcijsko-izgledajoče strani** (§6.5) — `app.dashboard.tsx` (v
    celoti), `training-view.ts` bridge — DB redesign teh strani ne bo "aktiviral" avtomatsko; ostale
    bodo tiho kazale placeholder/fake podatke, dokler jih nekdo ročno ne prevežeja.
14. **Poizvedbeni vzorci / N+1 / transakcije**: `equivalentQuestionGroupController.js`
    `addQuestionToGroup`/`removeQuestionFromGroup` (159-164, 198-203) delata read-nato-write brez
    `$transaction` — TOCTOU okno med preverbo članstva in dejanskim update-om pri sočasnih zahtevah
    (§5.4). `startAttempt` (`assessmentAttemptController.js:71-80,94-101`) bere assessment+user
    ločeno od kasnejšega create-a — majhno, a nezaščiteno okno, da bi se assessment lahko
    "unpublish"-al med preverbo in ustvarjanjem poskusa. Nasprotno, `submitAttempt` (246-267) in
    AI equivalent-accept flow (813-867) **pravilno** uporabljata `$transaction` za resnično
    več-koračne zapise — ni splošno manjkajoča praksa, le ti dve mesti.
15. **Denormalizirani odgovori (Prisma `include`) povsod, brez `select`-filtriranja glede na
    vlogo** (§5.10) — poleg answer-leakage (#8) to pomeni, da vsak dodaten stolpec, dodan modelu v
    redesignu, avtomatsko "priteče" v obstoječe odgovore, če ni eksplicitno izključen — implicitna
    povezava med shemo in API kontraktom, ne eksplicitna (ni DTO/serializer plasti).

---

## 12. KAJ MORA NOVA BAZA PODPRETI (funkcionalni povzetek, brez predloga sheme)

- **Entitete in relacije, kot obstajajo danes** (§2): User, Training, Topic, LearningObjective,
  Question, AnswerOption, EquivalentQuestionGroup, Assessment, AssessmentQuestion,
  AssessmentAttempt, ParticipantAnswer, AiModel, AiInteraction — vključno z vsemi trenutnimi
  FK-smermi in ON DELETE akcijami, razen kjer se redesign namenoma odloči za drugačno pravilo
  (glej §11 tveganja kot kandidate za namerno spremembo, ne kot naključno regresijo).
- **Vsi obstoječi enum-i z vsemi definiranimi vrednostmi** (§2.2), tudi tiste, ki se v podatkih še
  ne pojavljajo (`NEEDS_REVIEW`, `REVIEW`, `REJECTED`, `ARCHIVED`, `QUIZ`, `OTHER`,
  `EDIT_QUESTION`, `GENERATE_SYNTHETIC_DATA`, `GRADED`) — frontend jih tipsko pričakuje (§6.3) tudi
  če jih trenutno nihče ne proizvaja.
- **De facto API kontrakt** (§5, §6): oblika vsakega endpointovega odgovora, kot ga frontend danes
  bere polje-za-poljem — vključno z aliasi (`textAnswer`, `participantId`), denormaliziranimi
  include-i (`topic`, `training`, `answerOptions`, ...), in nekonsistentnimi delete-odgovori (204
  vs. `{message}` 200), ki jih frontend že eksplicitno obravnava kot dvojni primer
  (`types/models.ts:9-12`).
- **Vse poslovne validacije, ki danes živijo samo v kodi, ne v shemi** (§7.5): MC-opcijska pravila,
  "assessment vprašanja morajo biti APPROVED + isti training", "vprašanje v največ eni ekvivalenčni
  skupini", self-demotion admin guard, DRAFT-only urejanje assessmenta.
- **AI advisory garancijo**: vsak AI izhod ostane `PENDING`, dokler človek eksplicitno ne
  `ACCEPT`/`REJECT`-a; noben AI-kodni pot ne sme (in danes ne) neposredno postaviti
  `Question.status=APPROVED` ali `Assessment.status=PUBLISHED` (§9.2) — to je trdo pravilo iz
  `CLAUDE.md`/`docs/mvp-scope.md`, ne le trenutna implementacijska podrobnost.
  novi model AiInteraction naj ohrani polja, ki jih review-tok danes uporablja:
  `sourceQuestionId`, `generatedQuestionId`, `resultJson`, `reviewStatus`, `reviewedById/At`.
- **Ocenjevalni model**: MC avto-ocena (all-or-nothing), OPEN/CODE kot "needsManualReview" stanje
  brez trenutno delujočega ročnega ocenjevanja (a s poljem, ki to *pričakuje* — `needsManualReview`,
  `isCorrect: null`, `pointsAwarded: null`) — redesign naj eksplicitno odloči, ali to stanje ostane
  "permanentno nedokončano" ali dobi resnično zaključitev.
  `score`/`maxScore` izračun kot danes: `maxScore` šteje VSA vprašanja (tudi neocenjena), `score`
  samo dejansko prisojene točke.
  Denna: attempt-status prostor `IN_PROGRESS → SUBMITTED → GRADED`, tudi če je `GRADED` danes
  nedosežen — frontend tipi (`AttemptStatus`) ga že vključujejo.
- **Analitične agregacije, ki jih danes izračunava koda nad surovimi podatki** (§5.9): morajo
  ostati izračunljive iz nove sheme (per-topic/per-LO/per-difficulty odstotki, pareno pre/post,
  leaderboard z opcijskim PII-razkritjem, participant profil, option-distribution) — brez, da bi
  jih bilo treba shranjevati kot nove trajne stolpce, RAZEN če redesign namenoma uvede
  materializirane agregate.
- **`attempt-storage.ts` (client-side shim) nadomešča manjkajoč "moji poskusi" seznam** —
  redesign/backend naj eksplicitno odloči, ali doda pravi `GET /assessment-attempts?mine=true`
  (dokumentiran TODO, §10.1), kar bi client-side shim naredilo odveč.
- **Firebase-identiteta → DB User pot** (po `firebaseUid`, fallback `email`, avto-provision kot
  `PARTICIPANT`) mora ostati podprta v novi shemi (`User.firebaseUid`, `User.email` unique,
  `User.externalAuthId` kot legacy/seed-pot).

---

## 13. DODATNA PREVERBA: PRE/POST POVEZAVA, GAIN-SCORE, "SKUPINE" IN PORAVNAVA VPRAŠANJ

Na izrecno zahtevo dodatno preverjeno (read-only, isti viri kot zgoraj): koda v
`backend/controllers/analyticsController.js`, `backend/controllers/aiController.js`,
`frontend-next/src/routes/app.assessments.$id.post-test.tsx`, `frontend-next/src/services/ai.ts`,
`backend/prisma/seed.js` (`AssessmentBlueprint.configJson`).

### 13.1 Povezava PRE_TEST ↔ POST_TEST — ni persistirana nikjer; obstaja samo kot query-time pravilo

**V shemi ne obstaja noben stolpec/tabela, ki bi eksplicitno povezal konkreten pre-test assessment
s konkretnim post-test assessmentom.** `Assessment` nima npr. `pairedAssessmentId` ali podobnega
polja (`schema.prisma:129-142`); `AssessmentBlueprint.configJson` (edini JSON-blob v shemi, ki bi
teoretično lahko nosil tako povezavo) v resnici vsebuje samo distribucijski "recept" za
avto-generacijo ENEGA preverjanja — porazdelitev po `topics[]`/`learningObjectives[]`/`difficulty`
znotraj enega `trainingId`, brez kakršnekoli reference na drug `Assessment` (dejanska vsebina
seed-primera, `backend/prisma/seed.js:717-754`: `{topics:[{topicId,questionCount}],
learningObjectives:[{learningObjectiveId,questionCount}], difficulty:{easy,medium,hard}}`) — poleg
tega je `AssessmentBlueprint` sicer **mrtva shema** brez ijednega controllerja/routa (glej §10.2),
torej ta blob se sploh ne uporablja v teku aplikacije.

Namesto persistirane povezave obstaja **query-time (runtime) pravilo**, izvedeno na dveh mestih z
identično logiko (`computePairedPrePost`, deljena funkcija):

- `backend/controllers/analyticsController.js:307-415` (`computePairedPrePost`) in
  `:421-424` (`computePrePostComparison`, tanek wrapper) — uporabljena s strani
  `GET /analytics/pre-post-comparison` (`:426-441`), `GET /analytics/participant-improvements`
  (`:733-773`) in `GET /analytics/trends` (delno, glej §13.4).
- `backend/controllers/aiController.js:998-1015` (`getPrePostInsights`, `GET|POST
  /ai/pre-post-insights`) — **uvozi in kliče isto `computePrePostComparison` funkcijo** iz
  `analyticsController.js` (deljena implementacija, ne podvojena logika).

Natančen algoritem (`computePairedPrePost`, `analyticsController.js:314-415`):
1. Filtrira `AssessmentAttempt` po `assessment.type IN (PRE_TEST, POST_TEST)`, opcijsko zoženo na
   `trainingId` in/ali na eksplicitne `preAssessmentId`/`postAssessmentId` query-parametre
   (`:319-335`) — **ti ID-ji so vhodni filter parametri posamezne HTTP zahteve, ne shranjena
   relacija** — klicatelj (frontend) jih mora vsakič znova posredovati, sistem si "para" ne
   zapomni.
2. Za vsakega `userId` vzame **zadnji oddani (`submittedAt` najkasnejši) poskus vsakega tipa**
   posebej (`:337-377`, `orderBy: submittedAt asc`, zadnji zapis prepiše prejšnjega v `Map`).
3. Uporabnik je "paren" samo, če ima **oba** — zadnji PRE_TEST in zadnji POST_TEST poskus, ki oba
   ustrezata filtru (`:381-390`).
4. **Poravnava je torej izključno po `(trainingId, userId)`, ne po specifičnem paru assessmentov**
   — če ima training več kot en PRE_TEST ali več kot en POST_TEST assessment, se brez eksplicitnih
   `preAssessmentId`/`postAssessmentId` filtrov vzame kar "zadnji od vsakega tipa", ne glede na to,
   kateri specifični pre je "namenjen" kateremu specifičnemu post-u.

**Post-test wizard** (`frontend-next/src/routes/app.assessments.$id.post-test.tsx`) omogoča
inštruktorju, da v UI **izbere** izvorni pre-test (`selectedPreId`/`selectedPre`, vrstice 158-166) —
a ta izbira je **izključno lokalno stanje komponente**, uporabljeno samo za prikaz/predizpolnitev
formularja (naslov, `trainingId`, seznam vprašanj za primerjavo variant — glej §13.4). Dejanski
klic ustvarjanja (`generateMutation`, vrstice 266-298) pošlje na `POST /assessments/generate`
**samo** `{title, description, trainingId, topicId?, learningObjectiveId?, difficulty?, count}`
(vrstice 280-289) — **`selectedPre.id` se nikoli ne pošlje backendu in se nikamor ne shrani.**
Backend (`assessmentController.js:352-485`, `generateAssessment`) o izbranem pre-testu torej ne ve
ničesar; izbira vprašanj temelji izključno na `trainingId`+opcijskih filtrih nad splošnim naborom
`APPROVED` vprašanj tega treninga (z dedup po `equivalentGroupId`, glej §5.6) — **ni nobenega
mehanizma, ki bi backendu zagotovil, da post-test dejansko vsebuje "ekvivalente" izbranega
pre-testa.** Edina sled, da je bil post-test "namenjen" določenemu treningu, je skupni
`trainingId` in ročno nastavljen `type:"POST_TEST"` (ločen `PUT /assessments/:id` klic takoj po
generaciji, vrstice 291-295) — nič več.

**Zaključek: PRE_TEST ↔ POST_TEST povezava danes obstaja samo kot (a) skupni `trainingId` +
`type` enum na dveh ločenih `Assessment` vrsticah, in (b) query-time "zadnji poskus vsakega tipa
na uporabnika" pravilo v analitiki. Ni FK-ja, ni shranjenega para, ni nobenega "ta post-test je
naslednik tega pre-testa" zapisa kjerkoli v shemi ali podatkih.**

### 13.2 Gain-score / izračun napredka (post − pre) — obstaja, na treh mestih, vedno kot razlika odstotkov

Da — obstaja, in sicer dosledno kot **`postPercentage − prePercentage` (odstotne točke, ne
normaliziran gain kot npr. `(post-pre)/(100-pre)`)**:

- **Skupno/agregatno** (povprečje čez pare): `improvement: roundToTwo(postAverage - preAverage)`
  — `analyticsController.js:413` (znotraj `computePairedPrePost`), izpostavljeno na
  `GET /analytics/pre-post-comparison` in `GET /ai/pre-post-insights` (skupni `comparison.improvement`).
- **Na uporabnika** (per-pair): `improvement: roundToTwo(slot.post - slot.pre)` —
  `analyticsController.js:387`, vrnjeno v `pairs[]` znotraj iste funkcije in izpostavljeno na
  `GET /analytics/participant-improvements` (`:733-773`, `participants[].improvement`, uporabljeno
  za razvrščanje `sort((a,b)=>b.improvement-a.improvement)`, `:759`).
- **Na posameznem udeležencu (profil)**: `improvement: hasBoth ? roundToTwo(postPct - prePct) :
  null` — `analyticsController.js:706`, znotraj `getParticipantProfile`
  (`GET /analytics/participants/:userId`), `null` če uporabnik nima obeh (pre in post) poskusov.

Frontend bere `improvement` na vseh treh mestih brez dodatnega preračuna (npr.
`app.participants.$userId.tsx`, `app.trends.tsx`, `app.analytics.tsx`,
`app.trainings.$id.tsx:1051-1067`, `app.ai-insights.tsx`) — nikjer v frontendu ni najdenega
drugačnega/dodatnega izračuna napredka (ni normaliziranega "learning gain", ni z-score, ni
statističnega testa značilnosti razlike).

### 13.3 "Skupina"/"class" udeležencev za analitiko — ne obstaja kot entiteta; edini približek je "vsi v tem treningu/assessmentu"

**V shemi ni nobenega modela kohorte/razreda/skupine udeležencev** (grep za `cohort|classId|
participantGroup|studentGroup|enrollment` v `backend/` — 0 zadetkov razen naključnih
`class-variance-authority` npm-paketov in besede "class" v seed-vsebini vprašanj o UML diagramih,
`seed.js:440,472-473,591` — nič od tega je entiteta). Ni tabele `Enrollment`, ni polja, ki bi
udeleženca vezalo na specifično "skupino" ali "generacijo" znotraj treninga.

Edini obstoječi približek "skupine" je **implicitno "vsi uporabniki, ki so oddali poskus za
assessment(e) tega `trainingId`"** — vsak analitični endpoint (`getAnalyticsSummary`,
`getPrePostComparison`, `getLeaderboard`, `getTrends`, `getParticipantImprovements`, ...) sprejme
**opcijski** `trainingId`/`assessmentId`/`participantId` query-filter
(`parseAnalyticsFilters`, `analyticsController.js:49-57`) in agregira nad vsemi
`ParticipantAnswer`/`AssessmentAttempt`, ki temu filtru ustrezajo — to je ad-hoc filter ob vsakem
klicu, ne persistirana skupina. Beseda "cohort" se v frontendu pojavlja **samo kot komentar/UI-copy**
(ne kot koda/entiteta): `frontend-next/src/services/ai.ts:122` — komentar "Cohort-level averages
over all submitted PRE_TEST / POST_TEST attempts"; `app.ai-insights.tsx:26` — komentar "cohort
pre/post numbers"; `app.system-analytics.tsx:116` in `app.trends.tsx:218` — UI-label "cohort
average" na grafu. V vseh primerih "cohort" pomeni **"vsi udeleženci v (filtriranem) treningu/
assessmentu"**, ne ločena, imenovana ali persistirana skupina uporabnikov.

**Zaključek: "class"/skupina ni podatkovni koncept — je zgolj besedišče za "trenutni filter
(training/assessment)" v UI in komentarjih.** Če bo redesign uvedel resnične kohorte/razrede
(npr. za ločevanje več generacij istega treninga), to je **nova zahteva**, ne obstoječa
funkcionalnost, ki bi jo bilo treba ohraniti.

### 13.4 Poravnava/primerjava vprašanj med dvema assessmentoma — obstaja samo kot client-side UI pripomoček v post-test wizardu, prek `EquivalentQuestionGroup`; ni uveljavljena na backendu niti v analitiki

- **V analitiki (`analyticsController.js`) ni nobene per-question poravnave med pre in post
  assessmentom.** `getTrends` (`:890-960`) in `computePairedPrePost` obravnavata vsak poskus kot
  celoto (skupni `score/maxScore` odstotek) — nikjer se ne primerja "vprašanje X iz pre-testa" z
  "vprašanjem Y iz post-testa" na ravni posameznega odgovora. `getWorstQuestions`/`getQuestionAnalytics`
  agregirata po posameznem vprašanju (globalno, znotraj morebitnega filtra), ne po pre/post parih
  vprašanj.
- **Edino mesto v celotni kodni bazi, kjer se vprašanja dveh assessmentov dejansko poravnajo, je
  frontend post-test wizard** (`app.assessments.$id.post-test.tsx:190-224`), in sicer izključno
  prek obstoječega `Question.equivalentGroupId`:
  - `preQuestions` (190-195) = vprašanja izbranega pre-testa.
  - `groupedVariants` (196-205) = vsa `APPROVED` vprašanja tega treninga, združena po
    `equivalentGroupId`.
  - `variantCandidatesByQuestionId` (206-220): za vsako pre-test vprašanje poišče **drugo**
    (`item.id !== question.id`) `APPROVED` vprašanje **v isti `equivalentGroupId` skupini** —
    to JE poravnava, a temelji izključno na tem, ali je nekdo vprašanja predhodno ročno (ali prek
    AI "generate equivalent" toka, §9.3) združil v isto `EquivalentQuestionGroup`; ni algoritma, ki
    bi vprašanja primerjal po vsebini/semantiki na tem mestu.
  - `missingVariantQuestions` (221-224): pre-test vprašanja **brez** najdenega variant-kandidata —
    prikazano inštruktorju kot review-seznam (`:762-780`) in uporabljeno kot gate-pogoj
    (`ok: missingVariantQuestions.every(q => reviewed[q.id]==="approved")`, vrstica 430) preden
    lahko nadaljuje čez korak wizarda.
  - **Ključna omejitev: ta poravnava se NE prenese v dejanski `POST /assessments/generate` klic**
    (glej §13.1) — backend izbira vprašanja neodvisno, po `topicId/learningObjectiveId/difficulty`
    filtrih nad celotnim naborom `APPROVED` vprašanj treninga, ne po seznamu "poravnanih variant"
    iz UI-ja. Wizard torej **prikaže** poravnavo (in od inštruktorja zahteva, da jo vizualno
    potrdi/pregleda), a je **ne uveljavi** kot omejitev pri dejanski generaciji post-testa — teoretično
    se lahko zgodi, da generirani post-test vsebuje vprašanja, ki niso enaka prikazanim
    "variant candidates".
- Sorodno (že dokumentirano v §9.3): `POST /ai/equivalent-question`
  (`aiController.js:610-723`, `action=GENERATE_EQUIVALENT_QUESTION`) je backend endpoint, ki iz
  ENEGA `sourceQuestionId` z AI ustvari en nov ekvivalent (deducira `topicId/learningObjectiveId/
  difficulty/type` iz izvora) — to je edini backend-mehanizem za "poravnavo" dveh vprašanj (izvor
  ↔ nov ekvivalent), a deluje **na ravni posameznega vprašanja**, ne na ravni "primerjaj vsa
  vprašanja assessmenta A z assessmentom B". Ni endpointa, ki bi sprejel dva `assessmentId` in
  vrnil poravnavo/mapiranje vprašanje-za-vprašanje med njima.

### 13.5 Povzetek (za §12 "kaj mora nova baza podpreti")

Trenutno stanje, ki ga je treba pri redesignu zavestno nasloviti (ne le "ohraniti", ker gre za
znano vrzel, ne uveljavljeno funkcionalnost):
- Ni persistirane pre↔post povezave med konkretnima assessmentoma — če jo redesign uvede
  (npr. `Assessment.pairedWithAssessmentId` ali ločena `AssessmentPair` tabela), gre za **novo**
  funkcionalnost, ne za formalizacijo obstoječe.
  Če redesign te povezave NE uvede, mora ohraniti trenutno "zadnji-poskus-na-uporabnika-na-tip"
  query-time pravilo (`computePairedPrePost`), ker nanj visijo trije obstoječi endpointi
  (§13.1) in vsaj 5 frontend strani.
- Gain-score (`post% - pre%`) je obstoječa, uveljavljena funkcionalnost na 3 nivojih (agregat, par,
  posameznik) — redesign jo mora znati reproducirati iz surovih `AssessmentAttempt.score/maxScore`
  + `Assessment.type`, brez novega trajnega stolpca (razen če se namenoma uvede materializiran
  gain-stolpec).
- "Skupina/class" ni obstoječa entiteta — ni je treba "ohranjati"; če jo naročnik želi, je to nova
  zahteva, trenutno nadomeščena z ad-hoc `trainingId`/`assessmentId` filtri.
- Poravnava vprašanj med pre/post prek `EquivalentQuestionGroup` je obstoječa, a **samo
  UI-svetovalna** (post-test wizard), **ne backend-uveljavljena** — redesign mora eksplicitno
  odločiti, ali naj postane prava omejitev pri generaciji post-testa (danes ni), ali naj ostane
  zgolj priporočilo inštruktorju.

---

## ODPRTA VPRAŠANJA / NEGOTOVOSTI

1. **Izvor 12 od 13 `GRADED` `AssessmentAttempt` vrstic (in pripadajočih `User` id 5-9, `Training`
   id 5 "Introduction to Databases", `Assessment` id 3-4) ni bil najden nikjer v repozitoriju**
   (delovna kopija ali git zgodovina). Kako preveriti naprej: vprašati ekipo/razvijalce, ali je bil
   kdaj zagnan ad-hoc skript ali ročni vnos prek Prisma Studio/direktnega SQL-a za pripravo
   demo/testnih podatkov za analitiko; preveriti lokalno shell-zgodovino ali CI-loge, če obstajajo,
   iz obdobja okoli `2026-06-05T09:35:46-47Z` (natančen timestamp iz `AssessmentAttempt.createdAt`).
2. **Ali se `admin@example.com` in `instructor@example.com` (brez `firebaseUid`, §3.5) dejansko
   še prijavljata v prakso**, in če da, po kateri poti (glede na to, da `authMiddleware.js` je
   mrtev in `firebaseAuthMiddleware.js` zahteva pravi Firebase token) — **NI PREVERJENO**;
   preveriti prek `SELECT * FROM AiInteraction WHERE requestedById IN (1,2)` /
   `AssessmentAttempt`/`Question.createdById` časovnih žigov v primerjavi z `User.firebaseUid IS
   NULL`, ali vprašati, kako se ta dva demo-računa danes uporabljata (morda samo za seed/testing,
   ne za resnično prijavo).
3. **Ali je `EquivalentQuestionGroup` s <2 člani (§3.5, anomalija #1) namerno dovoljeno stanje ali
   bug** — koda tega ne odloči eksplicitno (glej odprto vprašanje T4 v
   `docs/BACKEND-BRIEF.md:190`). Preveriti: vprašati produktnega lastnika/inštruktorje, ali je
   prazna/singleton ekvivalenčna skupina smiselna v UI (`app.questions.equivalent-groups.tsx`
   trenutno prikazuje take skupine brez posebnega opozorila — **NI PREVERJENO** v tem auditu, ali
   frontend to kako posebej označi).
4. **Ali obstaja produkcijsko/CI okolje z drugačnim `lower_case_table_names`** (§2.5, §11#12) —
   preverjeno je bilo samo lokalno Windows dev okolje. Preveriti: `SELECT @@lower_case_table_names;`
   na dejanskem produkcijskem/staging MySQL strežniku, če obstaja.
5. **Natančen namen/uporaba `User.externalAuthId`** — obstaja v shemi in seed podatkih
   (`demo-*-auth-id` vzorec), a se v nobenem od avditiranih controllerjev ne bere/piše po imenu
   razen prek Prisma modela samega (edino `userController.js`'s `USER_SELECT` ga eksplicitno
   **izloči** iz odgovorov). **NI PREVERJENO**, ali je to nameravan "prihodnji"/rezervni
   avtentikacijski mehanizem, ali povsem opuščen ostanek zgodnejše auth-implementacije — priporočen
   grep/vprašanje razvijalcem o zgodovini te kolone (morda je vidna v zgodnejših commitih/PR-jih).
6. **Realistične zahteve po dolžini besedilnih polj** (§3.4) — trenutni podatki so demo/testni
   obsega (79 vprašanj, max 107 znakov opisa) in ne odražajo nujno realne produkcijske
   obremenitve/dolžine vsebine, ki jo bo redesign moral podpreti. **NI PREVERJENO** brez dodatnega
   vnosa s strani produktnega lastnika o pričakovanih realnih dolžinah vprašanj/odgovorov.
7. **`docs/BACKEND-BRIEF.md`, `AUDIT-DEV-B.md`, `docs/AUDIT.md`, `docs/PRE-SPLIT-AUDIT.md`,
   `docs/AUDIT-DEV-A.md`** so obstoječi (delno negit-committani) dokumenti v repozitoriju, ki
   vsebujejo **predloge/priporočila za prihodnje spremembe** (npr. `Training.instructorId`
   lastništvo) — ti NISO del trenutnega, delujočega stanja kode/baze, in v tem auditu so bili
   uporabljeni izključno kot **kontekst za znana odprta vprašanja** (§11#1, §11#9), ne kot vir
   dejstev o trenutnem stanju. Preveriti pred redesignom, kateri od teh predlogov je ekipa že
   sprejela/zavrnila (ni razvidno iz same kode, ali je `feat/backend-instructor-ownership` branch
   iz `docs/BACKEND-BRIEF.md:469` sploh kdaj nastal ali bil mergean — **NI PREVERJENO**, trenutna
   veja je `feat/ai-authoring-followup`, ki tega ne vsebuje).
