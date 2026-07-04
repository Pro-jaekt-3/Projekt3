Chat A
# Backend Brief — AI Authoring (PROJEKT3)

Namen: ta dokument je samostojen handoff za backend chat. Iz njega se naredi krovni
brief + posamezni tickets. Vsebuje ves potreben kontekst — bralcu ni treba poznati
preostalega projekta.

---

## 1. Kontekst

AI-podprt sistem za sestavljanje/izvajanje/analizo preverjanj znanja (informatika).

- **Stack backend:** Express + Prisma + MySQL.
- **Vloge:** `ADMIN`, `INSTRUCTOR`, `PARTICIPANT` (nikoli STUDENT). AI funkcije so za
  instructor/admin.
- **AI provider:** lokalni Ollama (`provider=OLLAMA`); modeli seedani
  (`qwen3:8b` privzeti, `gpt-oss:20b`, `llama3.1:8b`, `mistral-nemo:12b`, `gemma3n:e4b`).
- **Načelo:** vsak AI izhod je **svetovalni**. Instructor ga mora pregledati
  (Accept/Reject) preden se uporabi. Vsak AI klic se persistira kot `AiInteraction`
  z `reviewStatus=PENDING`.

### Relevantna shema (Prisma)

- `AiInteraction { id, aiModelId, requestedById, action(AiAction), prompt:LongText,
  resultText?:LongText, resultJson?:Json, sourceQuestionId?, generatedQuestionId?,
  reviewStatus(PENDING|ACCEPTED|REJECTED), reviewedById?, reviewedAt?, createdAt, updatedAt }`
- `AiAction = { GENERATE_QUESTION, EDIT_QUESTION, GENERATE_EQUIVALENT_QUESTION,
  CHECK_EQUIVALENCE, CHECK_QUESTION_QUALITY, REVIEW_TEST, GENERATE_SYNTHETIC_DATA }`
  → vrednost `GENERATE_EQUIVALENT_QUESTION` **že obstaja, a je noben endpoint ne uporablja**.
- `AiModel { id, provider, modelName, displayName?, baseUrl?, isLocal, isActive, ... }`
- `Question { id, title, description, difficulty:Int, type(QuestionType), status(QuestionStatus),
  topicId, learningObjectiveId?, equivalentGroupId?, answerOptions[] }`
- `QuestionType = { OPEN, MULTIPLE_CHOICE, CODE }`
- `AnswerOption { id, questionId, text, isCorrect, orderIndex }` — `@@unique([questionId, orderIndex])`
- `EquivalentQuestionGroup { id, name, description?, questions[] }`;
  `Question.equivalentGroupId` → `onDelete: SetNull`.
  **Posledica: vprašanje je lahko v NAJVEČ ENI skupini hkrati.**

### Že obstoječi AI endpointi (potrjeno, NE ustvarjati znova)

- `POST /ai/question-draft` — generira osnutek vprašanja (trenutno **prost tekst**).
- `POST /ai/equivalence-suggestion` — **primerja DVE OBSTOJEČI vprašanji** (`CHECK_EQUIVALENCE`).
- `GET /ai/models`
- `GET /ai/ollama/status`
- `POST /ai/models/:id/test`
- `PATCH /ai/interactions/:id/review` — Accept/Reject (`ACCEPTED`/`REJECTED`).
  **Že dela in ga frontend uporablja — ne spreminjati, razen potrditve idempotence (glej T4/T6).**

### Pogodba, na katero se frontend že zanaša

- Vsak generate/suggest klic **mora vrniti `aiInteractionId`** (= `AiInteraction.id`).
  Frontend ga uporabi za naknadni `PATCH /ai/interactions/:id/review`. Vsak NOV endpoint
  mora prav tako vrniti `aiInteractionId`.
- `question-draft` trenutno sprejema **tekstovne** vhode (topic *name*, objective *title*,
  difficulty mapiran v `easy|medium|hard`), ne id-jev. Spremembe naj bodo backward-kompatibilne
  ali eksplicitno označene kot breaking + s frontend follow-upom.

---

## 2. Cross-cutting zahteve (veljajo za vse ticket-e)

- Vsak AI klic persistira `AiInteraction` (action, prompt, `resultText` in/ali `resultJson`,
  `aiModelId`, `requestedById`, `reviewStatus=PENDING`). Endpoint vrne `aiInteractionId`.
- AI ostane svetovalni; nič se ne objavi/aktivira brez Accept prek review endpointa.
- Samo lokalni Ollama modeli (`isActive && isLocal`) za demo. Spoštuj obstoječo provider
  konfiguracijo.
- **Additivno > breaking.** Ne lomi obstoječih endpointov; obstoječe vedenje ostane privzeto.
- Avtorizacija: AI write endpointi samo INSTRUCTOR/ADMIN (kot obstoječi).
- Napake: jasni HTTP statusi + `{error}` telo (obstoječi vzorec).

---

## 3. Tickets

> Predlagan vrstni red: **T1 → T3 → T2 → T4 → T5**. T3 definira strukturo, ki jo T2 ponovno
> uporabi; T1 je neodvisen in majhen; T4 je predpogoj za varen Accept&link; T5 je neodvisen LOW.

---

### T1 — Model override na generacijskih endpointih `[MEDIUM]`

**Problem.** `GET /ai/models` vrne aktivne lokalne modele; frontend ima dropdown, a
`POST /ai/question-draft` (in `/ai/equivalence-suggestion`) **ignorirata izbiro** in vedno
poženeta privzeti lokalni model. Izbira modela tako nima učinka.

**Zahteva.**
- `question-draft` (in po želji `equivalence-suggestion` ter nova endpointa iz T2/T3)
  sprejmejo **opcijski** `aiModelId` (priporočeno; alternativa `model` string).
- Validacija: model mora obstajati, biti `isActive && isLocal`. Neveljaven/inaktiven → `400`
  z jasnim sporočilom. Izpuščen → privzeti lokalni model (obstoječe vedenje).
- Persistiraj dejansko uporabljen model v `AiInteraction.aiModelId` (FK že obstaja).
- Response naj vrne, kateri model je bil uporabljen.

**Acceptance.**
- Veljaven aktiven lokalni `aiModelId` → generira točno ta model.
- Neveljaven/inaktiven → `400`. Izpuščen → privzeti.
- `AiInteraction.aiModelId` beleži dejansko uporabljen model.
- Obstoječi klici brez `aiModelId` delujejo nespremenjeno.

**Frontend follow-up (ni v tem ticketu):** v `aiAuthoring.ts` dodaj `aiModelId` v payload;
dropdown postane funkcionalen (trenutno označen kot informativen).

---

### T3 — Strukturiran (JSON) output za generiranje vprašanj `[HIGH]`

**Problem.** `question-draft` vrne **prost tekst**. Frontend ga lahko vstavi le v
`description`; ne more napolniti `title`, `type`, `difficulty` ali (za MCQ) `answerOptions`.
To blokira jedrno vizijo: »instructor izbere tip → AI ustvari celo vprašanje«.
(Frontend avdit F-2.)

**Zahteva.**
- `question-draft` (in nova generacija iz T2) vrne **strukturiran objekt** v `resultJson`:
  ```json
  {
    "title": "string",
    "description": "string",
    "difficulty": 1,
    "type": "OPEN | MULTIPLE_CHOICE | CODE",
    "answerOptions": [
      { "text": "string", "isCorrect": true, "orderIndex": 0 }
    ]
  }
  ```
- `answerOptions` **samo** za `type=MULTIPLE_CHOICE`; takrat **≥2 opciji in ≥1 pravilna**.
  Za `OPEN`/`CODE` `answerOptions` izpuščen/prazen.
- `difficulty` v veljavnem Int razponu (uskladi z obstoječo definicijo; frontend trenutno
  mapira `easy|medium|hard`).
- Model promptaj naj vrne **strogo JSON**; backend parsira + validira. Ob neuspelem parse:
  poskus repair ALI `422`/`502` z jasnim sporočilom (ne tiho vrniti smeti).
- Ohrani tudi surovi tekst v `resultText` (transparentnost); strukturiran v `resultJson`.
- **Backward compat:** ohrani `suggestion`/tekst polje, ki ga frontend trenutno bere, ALI
  označi kot breaking in uskladi s frontend follow-upom.

**Acceptance.**
- Za dan topic+tip vrne veljavna strukturirana polja.
- MCQ → veljavne opcije (≥2/≥1 pravilna); ne-MCQ → brez opcij.
- Neveljaven JSON modela obravnavan kontrolirano (brez 500 s surovo vsebino).

**Frontend follow-up (ni v tem ticketu):** `aiAuthoring.ts` + `AIAssistantPanel` poberejo
`resultJson` in prefillajo title/type/difficulty/options (reši F-2).

---

### T2 — Generiranje NOVEGA ekvivalentnega vprašanja `[HIGH]`

**Problem.** `equivalence-suggestion` samo **primerja** dve obstoječi vprašanji
(`CHECK_EQUIVALENCE`). Produkt potrebuje: iz danega vprašanja **generirati NOV ekvivalent**
(za post-test iz pre-testa). Enum `GENERATE_EQUIVALENT_QUESTION` obstaja, a brez endpointa.

**Zahteva.**
- Nov endpoint, npr. `POST /ai/equivalent-question` (ime po dogovoru).
- Vhod: `sourceQuestionId` (+ opcijsko `instructions`, `aiModelId` iz T1).
- Izhod: strukturiran osnutek novega ekvivalenta (**ista shema kot T3**) + `aiInteractionId`.
  Privzeto deduciraj `topicId`/`learningObjectiveId`/`difficulty`/`type` iz izvornega vprašanja.
- Persistiraj `AiInteraction` z `action=GENERATE_EQUIVALENT_QUESTION`, `sourceQuestionId`
  nastavljen; `generatedQuestionId` nastavljen ko/če se vprašanje shrani.
- Tok Accept: prek obstoječega `PATCH /ai/interactions/:id/review` → `ACCEPTED`; vprašanje se
  shrani (prek obstoječega `createQuestion` ali znotraj endpointa — dogovori) in se lahko
  poveže v **isto** `EquivalentQuestionGroup` kot izvor (glej T4 za semantiko).
- **OBVEZNO OHRANITI:** obstoječi `CHECK_EQUIVALENCE` (primerjava dveh obstoječih) **ostane
  nedotaknjen** — potrebujemo oba toka (primerjava IN generiranje).

**Acceptance.**
- Endpoint vrne strukturiran ekvivalent + `aiInteractionId`.
- `CHECK_EQUIVALENCE` še vedno dela ločeno.
- Generirano vprašanje privzeto deli topic/objective/difficulty/type z izvorom.
- `AiInteraction.action=GENERATE_EQUIVALENT_QUESTION`, povezave (`sourceQuestionId`,
  `generatedQuestionId`) pravilne.

**Frontend follow-up (ni v tem ticketu):** Dev B post-test wizard izpostavi »generate
equivalent« prek tega endpointa (handoff že dokumentiran).

---

### T4 — Semantika članstva v ekvivalenčni skupini `[MEDIUM]`

**Problem.** `Question.equivalentGroupId` je en FK → vprašanje je v največ eni skupini.
Accept&link kliče dodajanje vprašanja v skupino, a vedenje, ko vprašanje **že pripada drugi
skupini**, ni definirano (frontend avdit nepotrjeno).

**Zahteva.**
- Definiraj in dokumentiraj vedenje group-add endpointa, ko vprašanje že ima
  `equivalentGroupId`: izberi eno —
  (a) **premakni** (overwrite) z jasnim response, ali
  (b) **zavrni** `409` z razlogom, ali
  (c) `force` parameter.
- Vrni jasen status; brez tihe izgube podatkov.
- Potrdi pravila za velikost skupine: ali je dovoljena singleton skupina (<2 vprašanja)?

**Acceptance.**
- Deterministično, dokumentirano vedenje.
- Jasna napaka ali uspeh; nič tihih prepisov.

---

### T5 — Počisti osirotele `answerOption` ob spremembi tipa iz MCQ `[LOW]`

**Problem.** Ob `updateQuestion`, ko se tip spremeni `MULTIPLE_CHOICE` → `OPEN`/`CODE`,
se `answerOptions` blok preskoči (options `undefined`), zato stare `AnswerOption` vrstice
ostanejo osirotele v bazi (UI jih skrije, a so šum). (Prvi DEV A avdit, OPEN.)

**Zahteva.**
- Ob posodobitvi vprašanja na ne-MCQ tip **izbriši** obstoječe `answerOptions` tega vprašanja.
- (Frontend ne more poslati praznih opcij — backend jih zavrne s `400` — zato je čiščenje
  na backendu pravilna rešitev.)

**Acceptance.**
- Po `MCQ → OPEN` posodobitvi ne ostane nobena `answerOption` vrstica za to vprašanje.

---

### T6 (opcijsko, potrditev) — Idempotenca review endpointa `[LOW]`

`PATCH /ai/interactions/:id/review` že obstaja. Potrdi/dokumentiraj vedenje ob ponovnem
reviewu (npr. že `ACCEPTED` → ponovni `ACCEPTED`/`REJECTED`): idempotentno ali `409`?
Frontend avdit tega ni mogel runtime preveriti. Brez kode, če je vedenje že definirano —
le potrditev.

---

## 4. Kar NI backend (da backend chat ne lovi napačnega obsega)

- **Popravek frozen dokumenta** `types/models.ts` (napačne delete return kode: trdi
  `{message}` 200 za topics/LO, dejansko je **204**) — to je **frontend/lead track**, ne backend.
- **Post-test picker UI** (instructor izbere pre-test vprašanja → »generate equivalent«) —
  **Dev B frontend**. Backend zanj le dostavi T2 endpoint.
- **F-1** (frontend: `listModels` napaka prikazana kot »no active local model«) — čisti
  frontend follow-up.

---

## 5. Povzetek frontend follow-upov, ki jih sprožijo ti backend tickets

(Za sledenje — ne backend delo, a brez teh AI authoring zanka ni sklenjena.)

- Po **T3**: `aiAuthoring.ts` + panel poberejo `resultJson` → prefill title/type/difficulty/options (F-2).
- Po **T1**: payload dobi `aiModelId` → dropdown funkcionalen.
- Po **T2**: Dev B post-test wizard izpostavi generiranje ekvivalenta.
- Neodvisno: F-1, F-3, F-4 (error/empty stanja) v naslednjem AI-frontend PR.


---------------------------------------------------
Chat C
# PREDAJNI BRIEF — BACKEND TRACK: INSTRUCTOR-OWNERSHIP (APP-WIDE) + ZAKLJUČEK FAZE 3

Namenjeno backend koordinacijskemu chatu. Ta dokument je samozadosten: vsebuje trenutno
stanje maina, trdne omejitve, glavno nalogo (lastništvo instructorja čez celo aplikacijo,
ne le analitiko), potrebne odločitve z mojimi priporočili, obseg po domenah, migracijo/seed,
in obvezno zaključno verifikacijo. Backend chat naj iz tega napiše svoje Claude Code prompte
(NE jaz). Vse poti/oblike, ki niso 100 % potrjene tukaj, naj backend chat **verify-a proti
dejanski kodi** (routes + controllers + schema.prisma) pred implementacijo.

---

## 0) KONTEKST IN STANJE MAINA

PROJEKT3: React+TS+Vite frontend (`frontend-next/`), Node/Express/Prisma/MySQL backend,
Firebase Auth (token → DB user po emailu), vloge ADMIN / INSTRUCTOR / PARTICIPANT.

Na mainu je ZDAJ zmergano in vezano:

- **Backend task 1 (hardening):** AI models mgmt, Ollama status, AI interactions review queue,
  advisory pre/post insights, admin users list + change role. `computePrePostComparison`
  ekstrahiran in deljen med `/analytics/pre-post-comparison` in `/ai/pre-post-insights`.
- **Backend task 2 (napredna analitika):** `/analytics/summary`, `participants/:userId`,
  `participant-improvements`, `leaderboard` (reveal + role), `trends`,
  `questions/:id/option-distribution`; globalni filtri (`parseAnalyticsFilters`) čez breakdowne;
  pre/post popravljen na **parno semantiko + `pairedUserCount`**; leaderboard brez PII privzeto.
- **Frontend Faza 1–3:** vse analitične in AI/Admin strani so VEZANE na trenutne oblike
  odgovorov. **Te oblike so de facto zamrznjen kontrakt** (glej §1).

Pomembna ugotovitev iz dela na frontendu: analitika trenutno avtorizira **samo po vlogi**
(INSTRUCTOR+ADMIN), NE po lastništvu. Vzrok je v podatkovnem modelu — glej §3.

---

## 1) TRDNA OMEJITEV — NE ZLOMI OBSTOJEČIH KONTRAKTOV (FRONTEND VISI NA NJIH)

- **Backend-only.** NE diraj `frontend-next/`, NE diraj `frontend/` (legacy), NE diraj `.env`.
- **NE odstranjuj in NE preimenuj obstoječih polj** v nobenem odgovoru. Lastništvo/scoping
  spremeni **KATERE vrstice** se vrnejo, NE oblike odgovora. Dodajanje **opcijskih** polj ali
  **opcijskih** query parametrov je dovoljeno (backward-compatible).
- **Ohrani obstoječe semantike:** štejejo SAMO `SUBMITTED` poskusi; pravilnost / močna-šibka
  področja SAMO nad MC vprašanji (OPEN/CODE niso auto-ocenjeni); empty-state vedno čist
  (brez 500 / NaN); pre/post = parno + `pairedUserCount`; leaderboard brez PII privzeto.
- **Avtentikacija ostane:** `firebaseAuthMiddleware` + `requireRole(...)`. Lastništvo se
  doda **NAD** obstoječe role-preverjanje, ne namesto njega.

Seznam endpointov, katerih **oblike** so zamrznjene (frontend jih bere): vsi `/analytics/*`,
vsi `/ai/*`, `/users` + `PATCH /users/:id/role`, ter Trainings/Topics/Learning-Objectives/
Questions/Assessments CRUD. Backend chat naj iz route datotek izlušči **celoten** inventar.

---

## 2) GLAVNA NALOGA (kaj naročnik želi)

> Instructor sme dostopati **samo do svojih assessmentov in pripadajočih virov — ne le v
> analitiki, ampak povsod**. ADMIN vidi vse. PARTICIPANT ostane nespremenjen.

To je avtorizacijska + data-model sprememba čez celo aplikacijo. Trenutno je NEMOGOČA, ker
model nima lastništva (§3). Naloga je: dodati lastništvo, ga uveljaviti server-side na vseh
relevantnih endpointih, in to dokazati s seed podatki.

**Zakaj server-side (in ne na frontendu):** to je avtorizacijska meja. Filtriranje na klientu
bi tuje podatke vseeno poslalo po mreži (isto načelo kot leaderboard PII). Uveljavitev MORA
biti v backend queryjih.

---

## 3) PODATKOVNI MODEL — PROBLEM IN PRIPOROČENA REŠITEV

### Stanje danes (iz schema.prisma)
- `Training` — **NIMA lastnika** (ni `instructorId`/`ownerId`).
- `Assessment` — **NIMA lastnika** (ni `createdById`/`ownerId`); ima `trainingId`, `type`, `status`.
- `Topic` → `Training` (`trainingId`); `LearningObjective` → `Topic` (`topicId`).
- `Question` — **ima** `createdById` + `reviewedById`; veže se na `Topic` (→ `Training`) in opcijsko `LearningObjective`.
- `AssessmentQuestion` (join Assessment↔Question), `AssessmentBlueprint` → Training,
  `AssessmentAttempt` → Assessment+User, `ParticipantAnswer` → attempt+question+option.
- `AiInteraction` — `requestedById`, opcijsko `sourceQuestionId`/`generatedQuestionId`.

### Priporočilo: en sidrni lastniški atribut — `Training.instructorId`
Vse pomembno se transitivno veriži na Training, zato eno sidro pokrije skoraj vse:

| Vir | Pot do lastnika |
|---|---|
| Training | `instructorId` (direktno) |
| Topic | `training.instructorId` |
| LearningObjective | `topic.training.instructorId` |
| Question | `topic.training.instructorId` |
| Assessment | `training.instructorId` |
| AssessmentBlueprint | `training.instructorId` |
| AssessmentQuestion | `assessment.training.instructorId` |
| AssessmentAttempt | `assessment.training.instructorId` |
| ParticipantAnswer | `attempt.assessment.training.instructorId` |

`Question.createdById` ostane kot **avtorstvo/audit**, ne kot primarna dostopna meja (sicer
trčiš v "question bank" delitev — glej §5).

Opcijsko (ne nujno za MVP): dodatni `Assessment.createdById` za finejši audit, a dostopna
odločitev naj kljub temu izhaja iz Training-lastništva, da ostane konsistentno.

---

## 4) ODLOČITVE, KI JIH MORA BACKEND SPREJETI (z mojimi priporočili)

Backend chat naj te **eksplicitno izbere in DOKUMENTIRA**; ne ugibaj tiho.

1. **Sidro lastništva:** `Training.instructorId` (priporočeno) vs `Assessment.createdById`
   vs oboje. → priporočam Training-level kot primarno.
2. **Soavtorstvo (več instructorjev na training):** za MVP en `instructorId` FK; če je
   co-teaching realna zahteva, raje join tabela `TrainingInstructor` (m2m). → priporočam
   en FK za zdaj, m2m kot zabeležena prihodnja opcija.
3. **Obnašanje ob "ni lastnik":** `404` vs `403` vs prazno.
   → priporočam: **collection/list endpointi → vrnejo SAMO lastne (prazno če nič)**;
   **detail/:id in mutacije na tujem viru → `404`** (manj leaka o obstoju kot `403`).
   Izberi eno konvencijo in jo uporabi DOSLEDNO.
4. **Ustvarjanje:** `POST /trainings` → `instructorId` se samodejno nastavi na zahtevajočega
   (če je INSTRUCTOR; ADMIN lahko po želji nastavi koga drugega). Pod-viri (`POST /topics`,
   `/assessments`, `/questions`, …) → preveri, da zahtevajoči **lastuje parent Training**,
   sicer `404/403`.
5. **Legacy/unowned podatki:** kaj z obstoječimi trainingi brez lastnika po migraciji?
   → priporočam: backfill v seedu (§6); za morebitne `null` lastnike velja "vidno samo ADMIN".
6. **PARTICIPANT:** nespremenjen. Lastništvo ne omejuje udeležencev. (Opomba: kako participant
   sploh izbira assessmente — model nima enrollmenta; trenutno verjetno vsi `PUBLISHED`. To je
   **ločena tema, IZVEN tega taska**, razen če naročnik izrecno zahteva enrollment.)
7. **AI interactions lastništvo:** veži na `requestedById` (kdo je zahteval) IN/ALI na training
   izvornega vprašanja (`sourceQuestion.topic.training.instructorId`). → priporočam: INSTRUCTOR
   vidi svoje (`requestedById == self`) + tiste nad svojimi vprašanji; ADMIN vidi vse.
8. **`/users` + `PATCH /users/:id/role`:** ostaneta **ADMIN-only**, brez sprememb.

---

## 5) POSEBEJ TEŽKO — "QUESTION BANK" IN CROSS-TRAINING (obvezno razreši eksplicitno)

Use-case diagram omenja **"question bank"** in **equivalent question groups** + AI generiranje
ekvivalentnih vprašanj. To odpre dve tveganji, ki ju Training-lastništvo samo po sebi ne reši:

- **(A) Deljen bazen vprašanj?** Ker `Question → Topic → Training`, so vprašanja že
  particionirana po Trainingu. Če sprejmeš Training-lastništvo, INSTRUCTOR po defaultu vidi
  SAMO vprašanja pod svojimi trainingi. To je konsistentno — a če je bil namen **globalni
  deljeni bank**, scoping to razbije. → **ODLOČI:** je question bank training-scoped
  (priporočeno, ker sledi modelu) ali globalno deljen? Dokumentiraj.
- **(B) Cross-training assessment questions:** `AssessmentQuestion` tehnično dovoli, da
  assessment v Training X vključi `Question` iz Training Y (shema tega ne preprečuje). Pri
  scopingu to povzroči nedoslednost (instructor vidi tuje vprašanje prek svojega assessmenta,
  ali pa per-question analitika 404-a). → **ODLOČI:** ali backend pri dodajanju vprašanja v
  assessment **vsili isti Training**? Priporočam: da (validacija ob `POST` assessment-question),
  ali vsaj eksplicitno dokumentiraj dovoljeno obnašanje.
- **(C) Equivalent groups čez traininge:** če skupina vsebuje vprašanja iz več trainingov,
  določi, kako se vidnost izračuna (priporočam: instructor vidi člane skupine, ki so pod
  njegovimi trainingi; ADMIN vse). Dokumentiraj.

---

## 6) MIGRACIJA + SEED

- **Migracija:** dodaj `Training.instructorId` (FK → User). Predlog: dodaj kot **nullable**,
  backfill v istem koraku, nato po želji ohrani nullable s pravilom "null = admin-only" (varneje
  za obstoječe podatke kot prisilni NOT NULL). Po potrebi `Assessment.createdById` (opcijsko).
  Ne odstranjuj/preimenuj obstoječih stolpcev.
- **Seed (idempotenten, kot obstoječi):** dodeli lastništvo demo trainingom. **NUJNO:** seed
  trenutno pozna SAMO enega instructorja (`instructor@example.com`). Za dokaz scopinga **dodaj
  drugega instructorja** (npr. `instructor2@example.com`) in mu dodeli vsaj en training, ki
  NI od prvega. Brez tega scopinga ni mogoče dokazati (oba bi videla vse).
- Cilj: po seedu velja "instructor1 vidi training A, NE vidi training B (od instructor2)".

---

## 7) AUTH MEHANIZEM (kako uveljaviti)

- Dodaj ponovno uporaben helper, npr. `getOwnedTrainingIds(user)` (ADMIN → vsi; INSTRUCTOR →
  `where instructorId = user.id`) in `assertOwnsResource(user, resource)` (vrže 404/403 po
  izbrani konvenciji). NE razprši ad-hoc logike po vsakem controllerju.
- Vse list queryje scope-aj z `where trainingId in (ownedTrainingIds)` (oz. transitivno prek
  relacij). Vse `:id` lookupe in mutacije zaščiti z `assertOwnsResource`.
- ADMIN pot mora ostati polna (bypass scopinga, a NE bypass `requireRole`).
- Layer NAD obstoječim `requireRole`, ne zamenjava.

---

## 8) OBSEG — ENDPOINTI ZA SCOPING (po domenah; backend chat potrdi inventar proti routes)

**Trainings**
- `GET /trainings` → samo lastni (ADMIN vsi).
- `GET /trainings/:id`, `PUT`, `DELETE` → assertOwns; tuj → 404.
- `POST /trainings` → instructorId = requester (ali ADMIN izbere).

**Topics / Learning Objectives**
- list (`GET /topics`, `/learning-objectives`, `?topicId=`, `?trainingId=`) → samo pod lastnimi trainingi.
- `:id` + mutacije → assertOwns prek parent training; `POST` → preveri parent ownership.

**Questions (question bank)**
- `GET /questions`, `GET /questions/:id`, `POST`, `PUT`, `DELETE` → scope po §5 odločitvi
  (priporočeno: pod lastnimi trainingi prek `topic.training`). Upoštevaj equivalent-group robni primer.

**Assessments (potrdi točne poti — niso v README, a obstajajo)**
- list/detail/CRUD + publish + add/remove questions (`AssessmentQuestion`) → assertOwns prek training;
  pri dodajanju vprašanja v assessment uveljavi §5(B).
- `AssessmentBlueprint` → enako prek training.

**Attempts / grading (instructorska stran)**
- Instructorski pogled na poskuse/odgovore → samo za assessmente pod lastnimi trainingi.
- Participantova lastna pot (oddaja/branje lastnih poskusov) → NESPREMENJENA.

**AI** (`/ai/interactions`, `/ai/models`, `/ai/ollama/status`, `/ai/question-draft`,
`/ai/equivalence-suggestion`, `/ai/pre-post-insights`, `PATCH /ai/interactions/:id/review`)
- `/ai/interactions` (review queue) → scope po §4(7).
- `/ai/models`, `/ai/ollama/status` → ostaneta po obstoječi vlogi (mgmt; ni "lastnino" instructorja);
  potrdi, ali naj ostaneta vidna vsem INSTRUCTOR ali postaneta ADMIN-only — **odloči/dokumentiraj**,
  privzeto pusti kot je (ne ruši frontenda).
- AI advisory pravilo OSTANE: nič se ne auto-applya.

**Analytics — subsumira prejšnji analytics-only ticket; uveljavi scope DOSLEDNO čez:**
`/analytics/summary` + vsi breakdowni (`by-topic`, `by-learning-objective`, `by-difficulty`,
`worst-questions`, `questions`), `pre-post-comparison` (+ deljeni `computePrePostComparison` →
tudi `/ai/pre-post-insights`), `participants/:userId` (instructor sme videti le udeleženca, ki je
reševal NJEGOV assessment; sicer 404), `participant-improvements`, `leaderboard` (scope na lastne
trainings/assessmente; PII pravilo OSTANE), `trends`, `questions/:id/option-distribution`
(instructor le za vprašanja v lastnih assessmentih; sicer 404).

**Users** — `GET /users`, `PATCH /users/:id/role` → ostaneta ADMIN-only, brez sprememb.

---

## 9) VRSTNI RED DELA + GIT

- Svoj branch iz posodobljenega main (npr. `feat/backend-instructor-ownership`), backend-only.
- **Najprej** model + migracija + seed + ownership helperji; **šele nato** uveljavitev po domenah.
  Razlog: vse domene visijo na istem sidru — najprej temelj, da se ne premika pod nogami.
- Smiselno razdeli na zaporedne commite/PR-je po domenah (model+helper → trainings/topics/LO →
  questions → assessments/attempts → AI → analytics), vsak commit naj se prevede sam zase.
- **GIT: NE commitaj in NE pushaj sam.** Na koncu IZPIŠI v kodni blok točne git ukaze
  (`git add` poimensko za backend datoteke, en conventional-commit, ločen push), ki jih
  uporabnik zažene sam. Priporoči commit/push timing.

---

## 10) OBVEZNA ZAKLJUČNA VERIFIKACIJA (vrni poročilo)

- **Per domena/endpoint:** potrdi, da INSTRUCTOR dobi SAMO lastno in ADMIN dobi vse, z
  **konkretnim seed primerom** (npr. instructor1 vidi training A, NE training B od instructor2).
- Potrdi, da NOBENO obstoječe polje ni odstranjeno/preimenovano (frontend kontrakt cel).
- Navedi sprejete odločitve (§4 in §5): sidro lastništva, 404-vs-403 konvencija, question-bank
  scope, cross-training pravilo, AI-interactions scope, legacy/null pravilo.
- Potrdi, da pre/post (parno + `pairedUserCount`) in leaderboard (brez PII privzeto) še veljata
  POD scopingom.
- Potrdi backfill + drugega instructorja v seedu.
- Zaključi z jasno izjavo:
  **"Instructor-ownership uveljavljen čez vse navedene domene: DA/NE (+ vrzeli)."**
- Navedi **frontend posledice nazaj** (glej §11), da jih predam frontend chatu.

---

## 11) FRONTEND POSLEDICA (nazaj na frontend track)

Minimalna in ne-rušilna: frontend se veže na to, kar backend vrne, zato scope-ani podatki ne
zahtevajo rebinda. Možna sta dva drobna follow-upa, ki ju backend chat naj **eksplicitno
javi**, da jih frontend track obravnava:

1. **404 na tuj vir:** če izbereš 404-konvencijo, detail strani (per-user profil,
   per-question analiza, training/assessment detail) lahko dobijo 404 za tuj vir. Frontend že
   ima not-found EmptyState na analitičnih profilih, a ostale domene (trainings/questions
   detail) bo morda treba preveriti za čisto 404-obravnavo.
2. **Bolj prazni seznami:** instructorski seznami bodo krajši (le lastno) — empty-state pokritost
   na ne-analitičnih straneh naj se preveri.

Brez teh dveh ni potrebnega frontend dela.

---

## 12) ZNANA DOLG / IZVEN TEGA TASKA (zabeleženo, ne nujno zdaj)

- **3 predobstoječe frontend tsc napake** v `app.dashboard.tsx` (×2) in `app.trainings.$id.tsx`
  (hardkodirane `/app/assessments/a1/...` mock poti). To je **frontend** dolg tuje domene, NE
  backend — pripada chatu/lastniku tistih strani; ne reševati v tem backend tasku.
- **OPEN/CODE ročno ocenjevanje:** trenutno MVP auto-ocenjuje le MC; OPEN/CODE se shranita, a
  ne ocenita. Če naročnik želi ročno ocenjevanje + njegov vpliv na analitiko, je to ločen task.
- **Participant enrollment:** model nima enrollmenta; izbira "katere assessmente participant
  vidi" je ortogonalna tema. Izven tega taska, razen ob izrecni zahtevi.
- **Co-teaching (m2m instructor↔training):** za MVP en FK; m2m kot prihodnja opcija.

---

### Povzetek za backend chat v eni vrstici
Dodaj `Training.instructorId`, backfill+seed (z drugim instructorjem), ownership helperje, in
uveljavi scope NAD `requireRole` čez VSE domene (trainings/topics/LO/questions/assessments/
attempts/AI/analytics) — list = le lastno, detail/mutacija na tujem = 404 (ali izbrana
konvencija), ADMIN = vse — brez spreminjanja oblik odgovorov, in vrni readiness poročilo z
odločitvami in seed dokazom.
