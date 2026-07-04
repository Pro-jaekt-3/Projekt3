# AUDIT-DEV-B — Assessments + Solving (frontend-next)

> Read-only senior audit. Nič v kodi ni spremenjeno; edini zapis je ta datoteka.
> Vsaka ugotovitev ima dokaz `pot:vrstica` + citat. Delo je **že v `main`** (merge
> `7dd7d7c Merge branch 'feat/assessments-solving'`), zato popravki gredo kot
> **follow-up branch**, ne kot revert — razen CRITICAL, kjer je hotfix nujen.

---

## 1. EXECUTIVE SUMMARY

**Skupna ocena: POTREBUJE POPRAVKE.**

Jedro domene (solving flow + assessment lifecycle) je **solidno in pravilno wired**:
sanitizacija odgovorov, one-shot submit, attempt-storage shim, 403-handling,
DRAFT→publish ločen korak, advisory AI v post-testu — vse to je narejeno po
FRONTEND-NOTES.md in SERVICES.md. To je dobro delo.

Vendar so trije resni problemi: **(1)** instructor **Results stran je 100% mock**
(`app.assessments.$id.results.tsx`) — kaže izmišljene rezultate inštruktorju in
sploh ne kliče backenda; servisna metoda `getResults` je mrtva koda. **(2)** Dev B
je **zbrisal `backend/.env.example` IN `frontend-next/.env.example`** — referenčni
datoteki, ki ju CLAUDE.md eksplicitno zahteva. **(3)** Dev B je posegel v **backend**
(`assessmentController.js`) in `login.tsx`, kar je izven obsega frontend domene.
`tsc --noEmit` ni čist (2 napaki v `app.dashboard.tsx`).

Število ugotovitev po resnosti: **CRITICAL: 2 · HIGH: 3 · MEDIUM: 4 · LOW: 4.**

### 5 najnujnejših stvari
1. **C1** — `tsc --noEmit` ni čist (2× TS2820 v `app.dashboard.tsx`); `npm run build`
   je zelen samo zato, ker build skripta je `vite build` brez `tsc`.
2. **C2** — `.env.example` (backend + frontend-next) sta zbrisana → onboarding/CI breakage,
   kršitev CLAUDE.md.
3. **H1** — instructor Results (`app.assessments.$id.results.tsx`) je v celoti mock; prikazuje
   lažne rezultate, uporablja `Assessment` tip iz `mock-data` namesto `AssessmentResults`.
4. **H2** — poseg v backend (`assessmentController.js`) — mešanje backend+frontend (CLAUDE.md).
5. **H3** — poseg v `login.tsx` (izven obsega Dev B).

---

## 2. SCOREBOARD

| Točka | Verdikt | Razlog (ena vrstica) |
| ----- | ------- | -------------------- |
| **Scope / Frozen** | **DELNO** | Nobena frozen datoteka spremenjena (✔), a backend + login.tsx + `.env.example` izven obsega (✘). |
| **Build (`npm run build`)** | **PASS** | `vite build` ✓ built (exit 0). |
| **Typecheck (`tsc --noEmit`)** | **FAIL** | 2× TS2820 v `app.dashboard.tsx:115,129` (`/app/assessments/a1/...`). |
| **G1 — sanitize solving** | **PASS** | `solvingItems()` mapira skozi `sanitizeQuestionForSolving`; `isCorrect` ne doseže render-a pred oddajo. |
| **G2 — one-shot submit, no autosave** | **PASS** | Lokalno stanje + en submit; re-submit (400) ujet + redirect; UI zaklenjen po oddaji. |
| **G3 — my-assessments brez GET seznama** | **PASS** | Bere `getAttemptId`/`getAllAttemptIds` iz `attempt-storage`; persist v localStorage. |
| **G4 — picker APPROVED + isti training + brez dup.** | **PASS** | Filter `status==="APPROVED"` + trainingTopicIds; `Array.from(new Set(...))`. |
| **G5 — edit pravila + status lifecycle** | **DELNO** | Create=DRAFT ✔, edit le pri DRAFT ✔, publish/archive ločen PATCH ✔; a `update` ne pokriva vprašanj, ni id-bound edit wizard. |
| **G6 — results tip** | **FAIL** | Results stran je mock; uporablja `Assessment` iz `mock-data`, ne `AssessmentResults`; `getResults` mrtva koda. |
| **G7 — access control 403** | **PASS** | access/solve/start ujamejo `/not available\|forbidden/` → AccessDenied + redirect. |
| **G8 — scoring MC vs OPEN/CODE** | **PASS** | `needsManualReview` → "Pending manual review"; OPEN/CODE nikoli "Incorrect"; velja za my-results in result. |

---

## 3. UGOTOVITVE PO RESNOSTI

### CRITICAL

#### C1 — `tsc --noEmit` ni čist (2 napaki), build samo skriva to
- **Lokacija:** `frontend-next/src/routes/app.dashboard.tsx:115` in `:129`
- **Dokaz (tsc izhod):**
  ```
  app.dashboard.tsx(115,23): error TS2820: Type '"/app/assessments/a1/post-test"' is not assignable …
  app.dashboard.tsx(129,29): error TS2820: Type '"/app/assessments/a1/results"' is not assignable …
  ```
  Build skripta: `frontend-next/package.json` → `"build": "vite build"` (NI `tsc -b`).
- **Zakaj pomembno:** Audit-kriterij: čist `tsc` je pogoj za "Done". Build je zelen le,
  ker ne tipa preverja. Te povezave so na **post-test/results** route, ki ju je Dev B
  ravno wired — OWNERSHIP §PART4 #5 te popravke izrecno pripiše Dev B/C ob wiranju teh
  zaslonov, a so ostale nepopravljene.
- **Kako popraviti:** V `app.dashboard.tsx` zamenjaj hardcodirana `to="/app/assessments/a1/post-test"`
  in `to=".../a1/results"` z `to="/app/assessments/$id/post-test"` + `params={{ id }}` (id iz
  dejanskega assessmenta), enako kot je narejeno drugje. Po želji dodaj `tsc -b &&` v build skripto.
- **Pravilo:** Quality bar (OWNERSHIP §PART3.4), Gotcha "Build/Tsc".

#### C2 — Zbrisani `.env.example` (backend + frontend-next)
- **Lokacija:** `backend/.env.example`, `frontend-next/.env.example` (oba MANJKATA na `main`)
- **Dokaz:**
  ```
  git diff --name-status 7dd7d7c^1 7dd7d7c
  D  backend/.env.example
  D  frontend-next/.env.example
  ls backend/.env.example → No such file or directory
  ```
- **Zakaj pomembno:** CLAUDE.md: "`.env.example` je referenca." README.md gradi setup na
  teh datotekah. Brisanje odstrani onboarding referenco za oba paketa in lahko podre CI/setup.
  Datoteki nista del te domene — to je nenamerna/izven-obsežna izguba.
- **Kako popraviti:** Obnovi obe datoteki: `git checkout 7dd7d7c^1 -- backend/.env.example
  frontend-next/.env.example` in commitaj kot hotfix. Preveri, da niso vsebovale skrivnosti
  (so samo predloge).
- **Pravilo:** CLAUDE.md "Ne commitaj `.env`; `.env.example` je referenca"; Scope.

---

### HIGH

#### H1 — Instructor Results stran je 100% mock (napačen tip, lažni podatki)
- **Lokacija:** `frontend-next/src/routes/app.assessments.$id.results.tsx:16-43,182-253`
- **Dokaz:**
  ```ts
  import { ASSESSMENTS, PARTICIPANTS, QUESTIONS, SCORE_DISTRIBUTION, … } from "@/lib/mock-data";
  import type { Assessment } from "@/lib/mock-data";            // ← NE iz @/types, NE AssessmentResults
  loader: ({ params }) => { const a = getAssessment(params.id) ?? ASSESSMENTS[0]; … }
  const correct = [82, 76, 49, 58, 71][i % 5];                  // ← izmišljeni %
  {PARTICIPANTS.slice(0, 7).map((p, i) => … {[88,76,64,54,91,70,82][i]}% …)}  // ← lažni rezultati
  ```
  Servis ima pravo metodo, a je **nikjer ne kliče**:
  ```
  grep getResults src → samo definicija v services/assessments.ts:69 (0 uporab)
  ```
  Tip obstaja: `src/types/models.ts:196 export interface AssessmentResults`.
- **Zakaj pomembno:** G6 zahteva `AssessmentResults` (iz `src/types`), ne `Assessment`.
  Inštruktor vidi popolnoma izmišljene rezultate (score distribucija, participant attempts) kot
  da so resnični → napačne odločitve. `getResults` je mrtva koda → deliverable nedokončan.
  (Datoteka NI bila v merge diffu `7dd7d7c` → ostala je na mocku.)
- **Kako popraviti:** Prepiši stran po SERVICES.md vzorcu: `useQuery({ queryKey: qk.assessments.results(id),
  queryFn: () => assessmentsService.getResults(id) })`, tipiziraj na `AssessmentResults`, odstrani
  vse `mock-data` importe, mapiraj realne agregate; loading/empty/error blok. 403 je ADMIN/INSTRUCTOR-only
  (že zaščiteno z `ensureRole`).
- **Pravilo:** G6; SERVICES.md §2/§6; OWNERSHIP Dev B "per-assessment results".

#### H2 — Poseg v backend iz frontend domene (mešanje backend+frontend)
- **Lokacija:** `backend/controllers/assessmentController.js` (v merge `7dd7d7c`)
- **Dokaz:**
  ```
  git diff 7dd7d7c^1 7dd7d7c -- backend/controllers/assessmentController.js
  - const { id } = req.params;
  + const assessmentId = parseId(req.params.id);
  + if (!assessmentId) return res.status(400).json({ error: "Assessment id must be a positive integer" });
  ```
- **Zakaj pomembno:** CLAUDE.md: "**NE mešaj backend in frontend v istem tasku.**" OWNERSHIP
  Dev B obsega samo frontend pages+services. Sprememba je sama po sebi smiselna (validacija ID),
  a je izven obsega in v frontend PR-ju → procesna kršitev; potencialna kolizija z backend lastnikom.
- **Kako popraviti:** Sprememba je benigna in lahko ostane, A naj se prenese/odobri prek backend
  lastnika (ločen commit/PR). Vnaprej: backend hardening teče po PART4, ne v assessments-solving frontend vejii.
- **Pravilo:** CLAUDE.md "ne mešaj backend/frontend"; OWNERSHIP §PART3.1.

#### H3 — Poseg v `login.tsx` (izven obsega Dev B)
- **Lokacija:** `frontend-next/src/routes/login.tsx:44-58,247-258`
- **Dokaz:**
  ```ts
  + function sanitizeRedirect(value?: string) {
  +   if (!value || !value.startsWith("/")) return null;
  +   if (value.startsWith("//")) return null;
  +   const assessmentMatch = value.match(/^\/assessment\/([^/?#]+)\/(access|solve|result)…/);
  +   if (assessmentMatch && !/^\d+$/.test(assessmentMatch[1])) return "/app/my-assessments";
  +   return value;
  + }
  ```
- **Zakaj pomembno:** `login.tsx` ni v Dev B owned route seznamu (OWNERSHIP §PART2). Sprememba je
  **dobra** (preprečuje open-redirect + ne-numerične assessment id-je iz `access` redirecta), a je
  scope-expansion v tujo datoteko brez koordinacije.
- **Kako popraviti:** Obdrži (varnostno koristno), a evidentiraj kot dogovorjeno spremembo s
  shell/lead lastnikom; idealno ločen, namensko opisan commit.
- **Pravilo:** OWNERSHIP §PART2/§PART3.1 (lastništvo poti).

---

### MEDIUM

#### M1 — Create wizard: korak "Assign" + nastavitve so kozmetične (ne persistirajo)
- **Lokacija:** `frontend-next/src/routes/app.assessments.new.tsx:218-226,946-1018,25,92`
- **Dokaz:** `create()` pošlje le `{ title, description, trainingId, type, questions }`:
  ```ts
  assessmentsService.create({ title…, description…, trainingId, type…, questions: …map(Number) });
  ```
  Medtem Step4 (assignTo, accessMode, dueDate, attemptLimit) in Step1 (timeLimit, availability,
  randomizeQuestions/Answers) niso nikjer poslani; `selectedParticipantIds` izhaja iz mock
  `PARTICIPANTS` (`import { PARTICIPANTS } from "@/lib/mock-data"`).
- **Zakaj pomembno:** UI obljublja dodelitev/časovno omejitev/randomizacijo, a backend tega ne dobi
  → uporabnik misli, da je nastavil, pa ni (false affordance). `timeLimitMinutes`, ki ga solve/access
  prikazujeta, se ob create nikoli ne nastavi.
- **Kako popraviti:** Ali (a) skrij/onemogoči nepodprta polja z opombo "ni v MVP", ali (b) razširi
  `CreateAssessmentInput` + backend, da jih sprejme. Vsaj odstrani `PARTICIPANTS` mock in zamenjaj
  s pravim virom, ko obstaja.
- **Pravilo:** Vizualna/funkcijska konsistenca; mock-removal (OWNERSHIP §PART3.2).

#### M2 — Edit ne pokriva vprašanj; ni id-bound edit wizarda
- **Lokacija:** `frontend-next/src/routes/app.assessments.$id.tsx:151-157`
- **Dokaz:**
  ```ts
  assessmentsService.update(id, { title: title.trim(), description…, type });  // brez questions
  ```
- **Zakaj pomembno:** Po kreaciji DRAFT-a ni načina urediti nabora vprašanj prek UI (le naslov/opis/tip).
  OWNERSHIP §PART1 to označi kot "Partial gap — no id-bound edit". Deliverable je delno.
- **Kako popraviti:** Dodaj id-bound edit (npr. wizard v edit-modu ali "Manage questions" dialog), ki
  pošlje `questions` v `update` — dovoljeno le pri DRAFT brez SUBMITTED poskusov (backend vrne 409, že ujet).
- **Pravilo:** G5; OWNERSHIP §PART4 #7.

#### M3 — Publish nima client-side guarda (0 vprašanj / neodobrena)
- **Lokacija:** `frontend-next/src/routes/app.assessments.$id.tsx:314-327,256-264`
- **Dokaz:** "Publish" gumb (`statusActionsFor("DRAFT")`) je onemogočen le med `pending`; validacijski
  seznam (`validationChecks`) je zgolj prikaz, ne blokira `statusMutation.mutate("PUBLISHED")`.
- **Zakaj pomembno:** Inštruktor lahko objavi prazno/neodobreno preverjanje; sicer backend lahko zavrne,
  a UX bi moral preprečiti pred klicem (jasno sporočilo namesto surove napake).
- **Kako popraviti:** Onemogoči Publish, dokler `questions.length>0 && approvedCount===questions.length`,
  s tooltip razlogom; ohrani backend kot zadnjo obrambo.
- **Pravilo:** G5; ravnanje z napakami.

#### M4 — Sanitizacija je v komponenti, ne na servis/loader seam-u
- **Lokacija:** `frontend-next/src/routes/assessment.$id.solve.tsx:539-554`;
  `frontend-next/src/services/assessmentAttempts.ts:53-54`
- **Dokaz:** servis `get()` vrne surov `AssessmentAttempt` (z `answerOptions.isCorrect`); strip se zgodi
  šele v `solvingItems()` v komponenti. SERVICES.md §5 priporoča strip "at the service/loader seam".
- **Zakaj pomembno:** `isCorrect` se **ne renderira** (zato G1 = PASS), a surovi pravilni odgovori
  ostanejo v react-query cache-u (`qk.assessmentAttempts.detail`) in v network payloadu — tehnično
  dostopni v brskalniku. Manjši odklon od priporočenega vzorca, povečuje tveganje regresije.
- **Kako popraviti:** Sanitiziraj že v servisu (npr. `assessmentAttemptsService.getForSolving`) ali na
  seam-u, da surov `isCorrect` ne pride v cache za solving poglede.
- **Pravilo:** G1; SERVICES.md §5; FRONTEND-NOTES "Razkritje pravilnih odgovorov".

---

### LOW

#### L1 — `frontend-next/package-lock.json` spremenjen v domenskem PR-ju
- **Lokacija:** merge `7dd7d7c` (`M frontend-next/package-lock.json`)
- **Dokaz:** `git diff --name-status 7dd7d7c^1 7dd7d7c` → `M frontend-next/package-lock.json`.
- **Zakaj/popravek:** Ni root lock (pravilo cilja root), a OWNERSHIP §PART3.4 želi minimalne PR-je.
  Preveri, ali je sprememba namerna (nova odvisnost?) ali nenamerna; sicer revertaj.

#### L2 — `as never` cast za search param
- **Lokacija:** `frontend-next/src/routes/app.assessments.$id.post-test.tsx:325`
- **Dokaz:** `search: { published: 1 } as never,`
- **Zakaj/popravek:** Ohlapen cast zaobide tipni sistem; deklariraj `published` v `validateSearch`
  ciljne route (`app.assessments.$id` ga že ima) in odstrani `as never`.

#### L3 — Časovnik je zgolj prikaz (brez enforcement)
- **Lokacija:** `frontend-next/src/routes/assessment.$id.solve.tsx:207-217,260-267`
- **Dokaz:** odštevanje `seconds` se prikazuje, a ob `0` ni auto-submita ali zaklepa.
- **Zakaj/popravek:** Ker `timeLimitMinutes` ni nastavljen ob create (M1), timer je večinoma skrit; če
  bo kdaj nastavljen, odsotnost enforce-a zavaja. Dodaj auto-submit/lock ob izteku, ko bo polje resnično.

#### L4 — Ternary s stranskim učinkom
- **Lokacija:** `frontend-next/src/routes/assessment.$id.solve.tsx:239`
- **Dokaz:** `next.has(idx) ? next.delete(idx) : next.add(idx);`
- **Zakaj/popravek:** Stil; uporabi `if/else` za berljivost (vrnjeni boolean se zavrže).

---

## 4. PRIORITIZIRAN SEZNAM POPRAVKOV (fix plan)

**NUJEN HOTFIX (CRITICAL — že v `main`):**
1. **C2** — obnovi `backend/.env.example` + `frontend-next/.env.example` (`git checkout 7dd7d7c^1 -- …`).
2. **C1** — popravi 2 hardcodirana `a1` linka v `app.dashboard.tsx` na `$id`+`params`; razmisli o `tsc -b` v build.

**REDEN FOLLOW-UP (HIGH):**
3. **H1** — wiraj instructor Results na `assessmentsService.getResults` + `AssessmentResults`, odstrani mock.
4. **H2** — backend `assessmentController.js` spremembo prenesi v backend PR / odobritev lastnika.
5. **H3** — `login.tsx` sanitizeRedirect formaliziraj z lead/shell lastnikom (vsebinsko obdrži).

**MEDIUM (kakovost/dokončanje):**
6. **M2** — id-bound edit z `questions`.  7. **M1** — odstrani kozmetična polja / mock PARTICIPANTS.
8. **M3** — publish guard.  9. **M4** — sanitizacija na servis seam-u.

**LOW (ob priložnosti):** L1–L4.

---

## 5. KAJ JE DOBRO (ne kvari pri popravljanju)

- **G1/G2/G3/G4/G7/G8 PASS** — solving flow je premišljen: `sanitizeQuestionForSolving` v `solvingItems`,
  enkraten submit z re-submit (400) handlingom in zaklepom UI po oddaji, attempt-storage shim za "moje" sezname,
  picker filtrira APPROVED+isti training+brez duplikatov, dosleden 403→AccessDenied+redirect, in pravilna
  ločitev MC (auto) od OPEN/CODE (`needsManualReview` → "Pending manual review", nikoli "Incorrect").
- **Status lifecycle**: create=DRAFT, edit le pri DRAFT (gumbi disabled + tooltip), publish/archive prek
  ločenega `PATCH /:id/status` — točno po FRONTEND-NOTES.
- **Post-test wizard** (`app.assessments.$id.post-test.tsx`): pravilno wired (real `generate`→`update`→ločen
  `publish`), advisory AI z Accept/Reject, dedup generiranih draftov prek `removeQuietly` + signature.
- **Vzorec & higiena**: servisa (`assessments.ts`, `assessmentAttempts.ts`) sledita SERVICES.md (thin wrapper,
  `apiJsonFetch`/`apiEnsureOk`, tipizirani inputi, komentirani endpointi/gotchas). Uporabljene so skupne
  komponente (`LoadingState`/`ErrorState`/`EmptyState`/`StatusBadge`/`MetricCard`). **Nobena FROZEN datoteka
  ni spremenjena.** Brez `console.log`/`TODO`/`any`/`@ts-ignore` v wired route datotekah.

---

## 6. PRILOGA

### 6.1 Kako je identificiran Dev B scope
- Merge: `7dd7d7c Merge branch 'feat/assessments-solving'` (parents: `8e5397a` ^1, `f6c8c358` ^2).
- Datoteke (`git diff --name-status 7dd7d7c^1 7dd7d7c`):
  | Datoteka | Oznaka |
  | --- | --- |
  | `frontend-next/src/services/assessments.ts` (A) | [SVOJA DOMENA] |
  | `frontend-next/src/services/assessmentAttempts.ts` (A) | [SVOJA DOMENA] |
  | `frontend-next/src/routes/app.assessments.index.tsx` (M) | [SVOJA DOMENA] |
  | `frontend-next/src/routes/app.assessments.new.tsx` (M) | [SVOJA DOMENA] |
  | `frontend-next/src/routes/app.assessments.$id.tsx` (M) | [SVOJA DOMENA] |
  | `frontend-next/src/routes/app.assessments.$id.post-test.tsx` (M) | [SVOJA DOMENA] |
  | `frontend-next/src/routes/app.my-assessments.tsx` (M) | [SVOJA DOMENA] |
  | `frontend-next/src/routes/app.my-results.tsx` (M) | [SVOJA DOMENA] |
  | `frontend-next/src/routes/assessment.$id.access.tsx` (M) | [SVOJA DOMENA] |
  | `frontend-next/src/routes/assessment.$id.solve.tsx` (M) | [SVOJA DOMENA] |
  | `frontend-next/src/routes/assessment.$id.result.tsx` (M) | [SVOJA DOMENA] |
  | `frontend-next/src/routes/app.dashboard.tsx` (M) | [IZVEN OBSEGA — sankcionirano OWNERSHIP §PART4 #5] |
  | `frontend-next/src/routes/login.tsx` (M) | [IZVEN OBSEGA → H3] |
  | `backend/controllers/assessmentController.js` (M) | [IZVEN OBSEGA → H2] |
  | `backend/.env.example` (D) | [IZVEN OBSEGA → C2] |
  | `frontend-next/.env.example` (D) | [IZVEN OBSEGA → C2] |
  | `frontend-next/package-lock.json` (M) | [IZVEN OBSEGA → L1] |
- Opomba: `app.assessments.$id.results.tsx` **ni** v tem merge diffu (ostala mock — glej H1). Domenska
  zgodovina vključuje tudi prejšnje PR-je (`issue-23-assessment-builder`, `issue-24-solve-assessment`,
  `ui-assessment-flow-redesign`, `db/add-assessment-*`) — UI/mock predhodniki te domene.
- **FROZEN preverjeno:** noben od `src/types/*`, `apiClient.ts`, `firebase.ts`, `role-context.tsx`,
  `route-guards.ts`, `query-keys.ts`, `sanitize.ts`, `attempt-storage.ts`, `training-view.ts`,
  `mock-data.ts`, `components/ui/*`, `components/common/*`, `styles.css` ni v merge diffu → **brez frozen kršitev.**

### 6.2 Artefakti (KORAK 1.5)
| Pričakovano | Status | Pot |
| --- | --- | --- |
| `services/assessments.ts` | OBSTAJA | `frontend-next/src/services/assessments.ts` |
| `services/assessmentAttempts.ts` | OBSTAJA | `frontend-next/src/services/assessmentAttempts.ts` |
| attempt-storage | OBSTAJA (frozen helper, ne-spremenjen) | `frontend-next/src/lib/attempt-storage.ts` |
| Assessments list (instructor) | OBSTAJA | `app.assessments.index.tsx` |
| Assessment create/generate | OBSTAJA | `app.assessments.new.tsx` |
| Assessment detail/edit/publish | OBSTAJA | `app.assessments.$id.tsx` |
| Post-test wizard | OBSTAJA | `app.assessments.$id.post-test.tsx` |
| Solve | OBSTAJA | `assessment.$id.solve.tsx` |
| Access | OBSTAJA | `assessment.$id.access.tsx` |
| Participant result | OBSTAJA | `assessment.$id.result.tsx` |
| MyAssessments / Available | OBSTAJA | `app.my-assessments.tsx` |
| MyResults | OBSTAJA | `app.my-results.tsx` |
| Instructor AssessmentResults | OBSTAJA, a 100% MOCK | `app.assessments.$id.results.tsx` (→ H1) |

### 6.3 Poln tsc izhod (`npx tsc --noEmit`, na `main`)
```
src/routes/app.dashboard.tsx(115,23): error TS2820: Type '"/app/assessments/a1/post-test"' is not assignable to type '"/" | "/app" | … 21 more … | "/app/trainings"'. Did you mean '"/app/assessments/$id/post-test"'?
src/routes/app.dashboard.tsx(129,29): error TS2820: Type '"/app/assessments/a1/results"' is not assignable to type '"/" | "/app" | … 21 more … | "/app/trainings"'. Did you mean '"/app/assessments/$id/results"'?
```
(2 napaki — obe predhodni, v `app.dashboard.tsx`, ki ga je Dev B sicer urejal, a teh vrstic ni popravil.)

### 6.4 Poln build izhod (`npm run build` = `vite build`)
```
✓ built in 22.69s     (exit 0)
(!) Some chunks are larger than 500 kB after minification …  ← samo opozorilo o velikosti chunkov
```
Build je zelen, ker skripta NE poganja `tsc` (glej C1).
