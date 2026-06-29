# AUDIT — DEV A (Curriculum + Question Bank)

Read-only senior audit dela junior developerja **jozef134** na domeni DEV A.
Avtor poročila ni spreminjal nobene izvorne kode. Datum: 2026-06-29.

---

## 0. Obseg avdita (kako določen)

DEV A branch je `feat/curriculum-questions` (zmergano v `main` prek PR #89–#95).
Trenutni branch je `feat/analytics-questions` (druga domena), zato sem obseg določil
**po avtorju + OWNERSHIP.md**, ne po `git diff main...HEAD`.

**Določitev:**
- `git log --author="jozef134" --name-only` → footprint avtorja.
- OWNERSHIP.md PART 2 (Dev A = Curriculum + Question Bank).
- Per-file `git log` za potrditev avtorstva vsake datoteke.

**Avditirane datoteke (vse avtorja jozef134, znotraj `frontend-next/`):**

| Datoteka | Vloga |
| --- | --- |
| `src/services/topics.ts` | servis |
| `src/services/learningObjectives.ts` | servis |
| `src/services/questions.ts` | servis |
| `src/services/equivalentGroups.ts` | servis |
| `src/routes/app.questions.index.tsx` | Question bank list |
| `src/routes/app.questions.$id.tsx` | Question editor (create+edit, MCQ, AI panel) |
| `src/routes/app.questions.equivalent-groups.tsx` | Equivalent groups CRUD (nov screen) |
| `src/routes/app.trainings.$id.tsx` | Curriculum + Question Bank tab |
| `src/routeTree.gen.ts` | **avto-generirano** (TanStack Router) — sprememba pričakovana ob dodajanju route |

**Izven obsega (NE avtor DEV A):** `src/services/ai.ts` (avtor Jurij — Dev C, ne aiAuthoring),
`src/services/trainings.ts` (referenca, Jurij), `app.trainings.index.tsx` (Jurij).
Referenčni template za primerjavo: `src/services/trainings.ts` + `app.trainings.index.tsx`.

---

## 1. EXECUTIVE SUMMARY

Delo DEV A je **kvalitetno in večinoma production-ready**. Servisni sloj (topics,
learningObjectives, questions, equivalentGroups) natančno sledi template-u
`trainings.ts`: thin wrapper, pravilni return tipi, brez `any`, brez lokalnih
dvojnikov tipov. **Vse high-signal gotchas so pravilno obravnavane** (status subset,
client-side validacija, MCQ options, client-side status filter), in DEV A je
**zaprl prave coverage gaps**: Topic/LO create-edit-delete in popolnoma nov
EquivalentGroup CRUD screen. **Scope je čist — nobene FROZEN datoteke ni uredil**
(query-keys, types, apiClient, mock-data, UI primitivi vsi nedotaknjeni); za
manjkajoč `equivalentGroups` ključ je pravilno zgradil svoj key set iz `entityKeys`
namesto da bi uredil zamrznjen `query-keys.ts`.

`npm run build` (vite) je **zelen**. ESLint na DEV A datotekah je **čist**. Brez
`console.log`/`TODO`/`any`.

**Največje tveganje:** AI authoring del **ni implementiran** — AI panel v question
editorju je še vedno popolnoma mock (`AI_MODELS`, `setTimeout`, hardcodiran SQL
tekst), pričakovan servis `aiAuthoring.ts` ne obstaja, čeprav backend endpointa
`/ai/question-draft` in `/ai/equivalence-suggestion` obstajata. Ostala manjša tveganja:
1 TS napaka v DEV A datoteki (hardcodiran `a1` route link), nekaj hardcodiranih
fake številk v Overview tabu in en nepokrit error-state.

**Ocena production-readiness: ~85 %** za curriculum/questions/equivalent-groups
slice; AI authoring slice je ~10 % (mock).

---

## 2. PRIORITETNI SEZNAM POPRAVKOV (po resnosti)

1. **[HIGH]** Implementiraj AI authoring (`aiAuthoring.ts` + zamenjaj mock AI panel v
   `app.questions.$id.tsx`) ali eksplicitno označi kot "ni v MVP". Odstrani
   `AI_MODELS` mock import in fake `setTimeout` suggestion.
2. **[MEDIUM]** Popravi TS napako `app.trainings.$id.tsx:818` (`/app/assessments/a1/post-test`)
   — uporabi `$id` obliko ali odstrani gumb (assessments tab je Dev B mock).
3. **[MEDIUM]** Zamenjaj hardcodirane fake številke v Overview "Question bank readiness"
   (`app.trainings.$id.tsx:405-422`) z realnimi izračuni ali odstrani — trenutno
   instruktorju kažejo lažne podatke.
4. **[MEDIUM]** Dodaj error-state za `questionsQuery` v
   `app.questions.equivalent-groups.tsx` — trenutno se napaka tiho požre.
5. **[LOW]** Uskladi top MetricCard "Approved questions" z realnim izračunom (že
   obstaja v Question Bank tabu).
6. **[LOW/NIT]** Inertni gumbi brez handlerjev (placeholderji) — glej §3.
7. **[OPEN]** ARCHIVED vprašanja nimajo poti nazaj (reactivate); MCQ→OPEN pusti
   osirotele `answerOption` vrstice (backend).

> **Pozitivno za zabeležiti (ne potrebuje popravka):** per-entiteta delete handling
> je **pravilen in se ujema z dejanskim backendom** (topics/LO = 204 → `apiEnsureOk`;
> questions/groups = `{message}` 200 → `apiJsonFetch`). To je **nasprotno** od
> trditve v gotcha C5 in v zamrznjenem `types/models.ts` (glej §5) — DEV A je bral
> kodo, ne (napačnega) dokumenta.

---

## 3. NAJDBE po datotekah

### `app.questions.$id.tsx`

#### [HIGH] AI assistant panel je popolnoma mock; `aiAuthoring.ts` ni implementiran
- **Datoteka/vrstice:** `app.questions.$id.tsx:45` (import), `618-787` (`AIAssistantPanel`),
  `629-637` (fake `setTimeout`), `768-780` (fake Insert/Reject).
- **Koda:**
  ```tsx
  import { AI_MODELS } from "@/lib/mock-data";              // :45
  const generate = (action: string) => {
    setBusy(true); setSuggestion(null);
    setTimeout(() => { setBusy(false); setSuggestion(
      action === "explain" ? "WHERE filters individual rows…" : "…"); }, 700);  // :629
  };
  onClick={() => { toast("Inserted into draft"); setSuggestion(null); }}        // :768
  onClick={() => toast("Saved as Needs Review")}                               // :775
  ```
- **Zakaj narobe:** OWNERSHIP.md (PART 2, Dev A) zahteva `src/services/aiAuthoring.ts`
  z `POST /ai/question-draft` + `POST /ai/equivalence-suggestion` (advisory). Oba
  endpointa **obstajata na backendu** (`backend/routes/aiRoutes.js:22-29`), a nista
  zvezana. Krši tudi: (a) pravilo "odstrani mock importe iz SVOJIH strani" — `AI_MODELS`
  iz `mock-data.ts` še vedno uvožen; (b) MVP AI pravilo (CLAUDE.md) — predlog mora biti
  **dejansko** Accept/Reject z `reviewStatus` PENDING→ACCEPTED/REJECTED prek
  `PATCH /ai/interactions/:id/review`; tu so gumbi le `toast()`. Hardcodiran SQL tekst
  je mrtva mock vsebina.
- **Priporočen popravek:** Ustvari `aiAuthoring.ts` (po vzorcu `trainings.ts`), kliči
  realna endpointa, render predloga z realnim Accept/Reject (advisory note). Če AI
  authoring ni v MVP obsegu, odstrani panel + `AI_MODELS` import in dokumentiraj v SERVICES.md.

#### [LOW] Po type-switch MCQ→OPEN ostanejo osirotele answer options
- **Vrstice:** `handleSave` `app.questions.$id.tsx:226-240` (optionsPayload `undefined` za ne-MCQ).
- **Zakaj:** ko je `options` `undefined`, backend `updateQuestion` preskoči `answerOptions`
  blok (`questionController.js:166-177`), zato stare opcije ostanejo v bazi pod zdaj
  OPEN/CODE vprašanjem. UI jih ne prikaže, a so podatkovni šum. Backend issue, ne
  frontend bug — **OPEN QUESTION**.
- **Priporočen popravek:** (backend) ob ne-MCQ tipu počisti `answerOptions`, ali (frontend)
  ob shranjevanju ne-MCQ pošlji prazno opcijsko zamenjavo (a backend to zavrne s 400 — torej backend fix).

#### [NIT] ARCHIVED nima status-prehoda nazaj
- **Vrstice:** `app.questions.$id.tsx:500-540` — gumbi pokrivajo DRAFT/NEEDS_REVIEW→REVIEW,
  REVIEW→APPROVED/REJECTED, APPROVED/REJECTED→ARCHIVED; iz ARCHIVED ni izhoda.
- **Zakaj:** backend `PATCH status` ne preverja prehodov in dovoli REVIEW iz katerega koli
  stanja, tako da bi "Reactivate" (→REVIEW) bil mogoč. **OPEN QUESTION** (morda namerno).

> **Pravilno obravnavano (potrjeno):** status subset (samo REVIEW/APPROVED/REJECTED/ARCHIVED,
> nikoli DRAFT/NEEDS_REVIEW) — `:163-172` ✓ (gotcha C1). Client-side validacija
> title/description/topicId — `:211-224` ✓ (C2). `options` samo za MCQ, ≥2 opciji, ≥1
> pravilna — `:226-240` ✓ (C3). Hydration `useEffect` keyed na `id` (ne na cel objekt) ✓.

---

### `app.questions.index.tsx`

#### [NIT] Inertni gumbi brez handlerja
- **Vrstice:** `:80-82` "Review AI drafts" (brez `onClick`), `:117-119` "Filters" (brez `onClick`).
- **Zakaj:** placeholderja; "Review AI drafts" cilja Dev C review queue (izven domene),
  "Filters" je nezavezan. Vizualna parnost ohranjena, a brez funkcije.
- **Priporočen popravek:** zveži ali odstrani; vsaj `disabled`/tooltip "coming soon".

> **Pravilno:** client-side status filter (`:67-71`) + search — `GET /questions` vrne vse
> statuse (gotcha C4) ✓. Loading/error/empty bloki popolni ✓.

---

### `app.questions.equivalent-groups.tsx`

#### [MEDIUM] `questionsQuery` error se tiho požre
- **Vrstice:** `:172-182` preverja le `groupsQuery.isLoading`/`groupsQuery.isError`;
  `questionsQuery.isError` ni nikjer obravnavan.
- **Koda:**
  ```tsx
  {groupsQuery.isLoading || questionsQuery.isLoading ? <LoadingState/>
   : groupsQuery.isError ? <ErrorState .../>          // questionsQuery.isError manjka
   : groups.length === 0 ? <EmptyState/>
   : ...}
  const unassignedQuestions = (questionsQuery.data ?? []).filter(q => q.equivalentGroupId === null);
  ```
- **Zakaj:** če `GET /questions` pade, a `groups` uspe, se stran normalno izriše, le
  "Add a question…" picker je tiho prazen ("No unassigned questions available") — uporabnik
  ne ve, da gre za napako, ne za prazno stanje.
- **Priporočen popravek:** dodaj `|| questionsQuery.isError` v error vejo (ali ločen
  inline opozorilni trak), z `onRetry` ki refetcha oba.

> **Pravilno:** create/edit/delete + add/remove question s pravilno invalidacijo
> (`equivalentGroupsKeys.all` + `qk.questions.all`) ✓. Delete dialog pravilno sporoča
> **SetNull detach** (ne FK-500) — ujema se s `schema.prisma:70` `onDelete: SetNull`
> (`:413-416`) ✓. `equivalentGroupsKeys` zgrajen iz `entityKeys` (frozen `query-keys.ts`
> nedotaknjen) ✓.

---

### `app.trainings.$id.tsx` (Curriculum + Question Bank tab)

#### [MEDIUM] TS napaka — hardcodiran neveljaven route link
- **Vrstica:** `:818` `<Link to="/app/assessments/a1/post-test">`.
- **Dokaz (`tsc --noEmit`):**
  ```
  src/routes/app.trainings.$id.tsx(818,25): error TS2820:
    Type '"/app/assessments/a1/post-test"' is not assignable …
    Did you mean '"/app/assessments/$id/post-test"'?
  ```
- **Zakaj:** `tsc` ni čist. Pred-obstoječa napaka (OWNERSHIP PART 4 #5 jo navaja na
  `:390`; po DEV A razširitvi je na `:818`). V Assessments tabu, ki je Dev B mock, a
  **datoteka je v lasti DEV A**. Build je vseeno zelen (vite/esbuild ne tipizira).
- **Priporočen popravek:** uporabi `params` obliko (`to="/app/assessments/$id/post-test"
  params={{ id }}`) ali odstrani gumb dokler ni Dev B assessments slice zvezan.

#### [MEDIUM] Hardcodirane fake številke v Overview "Question bank readiness"
- **Vrstice:** `:405-422` (`value={6}`, `value={3}`, `value={2}`), `:431-444` ("SQL Joins
  shows weak performance (49%)", hardcodiran `a1` post-test link), `:455-469`
  (timeline "26 / 28 submitted · Avg 64%").
- **Zakaj:** prikazujejo se kot realni podatki, a so izmišljeni. DEV A **ima** realne
  podatke (`trainingQuestions`) in bi lahko izračunal vsaj "Questions needing review" in
  "Approved questions". (Overview tab je delno podedovan iz reference/mock-bridge, a je
  zdaj v DEV A datoteki.) Zavajajoče za inštruktorja.
- **Priporočen popravek:** izračunaj iz `trainingQuestions` (npr. status === "REVIEW" /
  "APPROVED"); izmišljene metrike (timeline, "AI drafts pending") odstrani ali jasno
  označi kot placeholder.

#### [LOW] Top MetricCard "Approved questions" ni usklajen z realnim izračunom
- **Vrstice:** `:372-376` uporablja `training.approvedQuestions` (iz `trainingToView`
  mostu = nevtralna privzeta vrednost), medtem ko Question Bank tab `:699-704` izračuna
  realno število approved vprašanj. Na isti strani dve različni številki.
- **Priporočen popravek:** napajaj MetricCard iz `trainingQuestions.filter(status==="APPROVED")`.

#### [NIT] Inertni gumbi / mock tabi izven domene
- **Vrstice:** `:356-358` "Add participant", `:498-510` participants search/filter/import,
  `:721-723` "Generate draft with AI" (curriculum Question Bank tab).
- **Zakaj:** Participants/Assessments/Results tabi so **Dev B/C domena** in po SERVICES.md
  bridge ostanejo mock (`PARTICIPANTS`, `assessmentsForTraining`, `PRE_POST_COMPARISON`,
  `TOPIC_PERFORMANCE`, `RECENT_ACTIVITY`, import `:64-70`) dokler tiste domene niso zvezane.
  **To NI scope violation DEV A** — pričakovano po bridge planu. "Generate draft with AI"
  pa spada v AI authoring (glej HIGH zgoraj).

> **Pravilno obravnavano (potrjeno):** Topic forma **nima description** polja
> (`:1041-1049`) — ujema se s `schema.prisma:24-31` (Topic nima `description`) ✓ (gotcha C6).
> Topic/LO create-edit-delete dialogi popolni z FK-500 opozorili (`:1073-1078`) ✓.
> LO delete invalidira tudi `qk.questions.all` zaradi SetNull (`:281-284`) ✓.
> Selektorji vežejo prave Int tipe: `t.trainingId === Number(id)` (`:164`), `topicId:
> Number(id)` ob create (`:221`), `objectiveTopicId` validiran (`:1117-1120`) ✓ (model D).
> Coverage gap zaprt: Topic/LO/EquivalentGroup create/edit DEJANSKO obstajajo in delujejo ✓.

---

### Servisni sloj — `topics.ts` / `learningObjectives.ts` / `questions.ts` / `equivalentGroups.ts`

**Skladnost s template-om (`trainings.ts`) — odlična.** Vsi: thin wrapper nad
`apiClient`, ena funkcija na endpoint, `jsonHeaders` + `JSON.stringify`, return tipi iz
`@/types`, napake bubblajo kot `Error(message)`. Brez `any`, brez lokalnih dvojnikov tipov.

#### [INFO/POZITIVNO] Per-entiteta delete handling je pravilen (nasprotno od dokumentov)
- `topics.ts:46` → `apiEnsureOk` (DELETE = **204**) — backend `topicController.js:178`
  `res.status(204).send()` ✓
- `learningObjectives.ts:58` → `apiEnsureOk` (**204**) — `learningObjectiveController.js:130`
  `res.status(204).send()` ✓
- `questions.ts:78-79` → `apiJsonFetch<{message}>` (**200**) — `questionController.js:199` ✓
- `equivalentGroups.ts:60-61` → `apiJsonFetch<{message}>` (**200**) —
  `equivalentQuestionGroupController.js:112` ✓
- **Pomembno:** gotcha C5 in `types/models.ts:9-12` trdita, da topics/LO vrneta
  `{message}` 200 — to je **napačno**; backend vrne 204. DEV A je implementiral po
  dejanskem backendu, ne po (napačnem) dokumentu. (Funkcionalno bi `apiEnsureOk` delal v
  obeh primerih, a izbira je pravilna.)

#### [NIT] `equivalentGroups.ts` — `removeQuestion` brez eksplicitnih `jsonHeaders`
- **Vrstice:** `:70-73` DELETE brez `Content-Type` (telo ni poslano) — pravilno (ni body).
  Brez pripombe; navedeno le za popolnost.

> `learningObjectives.ts` pravilno implementira `?topicId` filter (`:32-37`) ✓ (gotcha:
> LO filter implementiran). `questions.ts` `updateStatus` omeji tip na
> `"REVIEW"|"APPROVED"|"REJECTED"|"ARCHIVED"` (`:20`) ✓.

---

## 4. SCOPE / FROZEN-FILE KRŠITVE

**Brez kršitev.** Footprint DEV A (jozef134) znotraj `frontend-next/` je natanko:
4 lastni servisi + 4 lastne route + `routeTree.gen.ts` (avto-generiran).

Preverjeno, da **NI** urejal nobene FROZEN datoteke:
- `src/types/*` — zadnji avtor Jurij (`8c18027`), ne jozef ✓
- `src/services/apiClient.ts` — ni v footprintu ✓
- `src/lib/query-keys.ts` — zadnji avtor Jurij/duma-ju, ne jozef ✓ (DEV A je za manjkajoč
  `equivalentGroups` ključ zgradil svoj set iz `entityKeys`, namesto da bi uredil zamrznjeno datoteko)
- `src/lib/mock-data.ts`, `role-context.tsx`, `sanitize.ts`, UI primitivi, `styles.css` — niso v footprintu ✓

`routeTree.gen.ts` je generiran in se posodobi ob dodajanju route (`/app/questions/equivalent-groups`)
— pričakovano, ne ročna kršitev.

Mock importi: `app.questions.$id.tsx` (`AI_MODELS`) je **prava ostalina** (DEV A domena —
glej HIGH). `app.trainings.$id.tsx` mock importi pripadajo Dev B/C tabom in so **dovoljeni**
po SERVICES.md bridge planu.

---

## 5. ČESA NISEM MOGEL PREVERITI / DISKREPANCE

- **Runtime/integracijsko vedenje:** backend (`localhost:3000`) ni bil pognan; preverjal sem
  statično (koda + `schema.prisma` + controllerji). Dejanske HTTP odgovore (npr. da PUT
  ohrani `equivalentGroupId` ko je izpuščen) sem sklepal iz `questionController.js:164-165`
  (`!== undefined` guard) — kodno potrjeno, a ne run-time.
- **Napaka v zamrznjenem dokumentu (ne DEV A):** `src/types/models.ts:9-12` in audit
  gotcha C5 navajata, da topics/learning-objectives delete vrneta `{message}` 200; dejansko
  vrneta **204** (`topicController.js:178`, `learningObjectiveController.js:130`). Priporočam
  popravek tega komentarja (preko lead-a, frozen file) — DEV A koda je pravilna.
- **`tsc --noEmit`** javlja 3 napake; 2 sta v `app.dashboard.tsx` (Dev B/C, izven DEV A),
  1 v `app.trainings.$id.tsx:818` (DEV A — §3 MEDIUM). Build (`vite build`) je zelen, ker
  ne izvaja tipizacije.
- **Vizualna parnost** (markup/Tailwind nespremenjen, le wiring): ni bilo mogoče pixel-diff;
  iz kode markup izgleda ohranjen, dodane so le funkcionalne forme/dialogi konsistentni z
  obstoječim design sistemom (`Dialog`/`AlertDialog`/`ui/*`).

