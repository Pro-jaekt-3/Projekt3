# AUDIT — AI authoring (re-avdit, READ-ONLY)

Branch: `feat/ai-authoring`. Avditirani datoteki (samo ti dve):
- `frontend-next/src/services/aiAuthoring.ts`
- `frontend-next/src/routes/app.questions.$id.tsx`

Brez popravkov, brez commit/push. Datum: 2026-06-29.

---

## EXECUTIVE SUMMARY

Implementacija je **solidna in production-ready** za MVP. Interaction-id plumbing je
**pravilen** (id pride iz odgovora backenda, ne hardcodiran/undefined) → **ni BLOCKER-ja**.
Vsi AI klici imajo loading+error obravnavo, brez praznih catch vej, reachability gate
dejansko disabla generiranje. Backendu se NE pošilja izmišljeno model polje, "model
ignored" je jasno označen v UX + komentarjih. Vse DEV A gotchas (status subset, client
validacija, MCQ options, hydration keyed na id) so po prepisu panela **nedotaknjene**.
`tsc`/`build`/`eslint` zeleno za ti dve datoteki.

Najdbe so **nizke do srednje** resnosti: (a) `modelsQuery` napaka se tiho prikaže kot
"no active local model" (zavajajoče); (b) Accept napolni **samo `description`** z
neobdelanim model tekstom (ne title/type/options) — pričakovanje je treba dokumentirati;
(c) nekaj sekundarnih nepokrytih error stanj.

---

## VERIFIKACIJA PO TOČKAH

### 1) INTERACTION-ID PLUMBING — ✅ POTRJENO (ni BLOCKER)
- **Draft:** `generateMutation.onSuccess` shrani id iz odgovora:
  `app.questions.$id.tsx:714-715` → `setDraft({ suggestion: res.suggestion, interactionId: res.aiInteractionId })`.
  Review ga uporabi: `:721` → `aiAuthoringService.reviewInteraction(draft!.interactionId, status)`.
- **Equivalence:** `:749-754` → `setEquiv({ ..., interactionId: res.aiInteractionId, questionBId: res.questionBId })`;
  review: `:760` → `reviewInteraction(equiv!.interactionId, status)`.
- Vir je backend response polje `aiInteractionId` (= `AiInteraction.id`, glej
  `backend/controllers/aiController.js:223, 359`). **Ni hardcodiran, ni undefined.**
- `draft!` / `equiv!` non-null assertion je varen: review gumbi se renderirajo samo
  znotraj `{draft && (…)}` (`:878`) oz. `{equiv && (…)}` (`:932`). → **NIT** (spodaj).

### 2) DRAFT PREFILL — kaj Accept napolni
- **Samo `description`.** `app.questions.$id.tsx:596`:
  `onInsertDraft={(text) => setDescription((prev) => (prev ? \`${prev}\n\n${text}\` : text))}`,
  klican v `reviewDraftMutation.onSuccess` (`:724`).
- **NE** napolni `title`, `difficulty`, `type`, niti (za MCQ) `answerOptions`.
- Razlog je legitimen: backend `suggestion` je **neobdelan model tekst** (ne strukturiran
  JSON; glej `aiController.js:46-57` prompt + `:222 suggestion`). Glej **najdbo F-2** za
  priporočilo glede pričakovanj/UX.

### 3) ERROR / LOADING — večinoma ✅, dve vrzeli
| Klic | Loading | Error | Opomba |
| --- | --- | --- | --- |
| draft generate | `:869` "Generating…" + disabled `:865` | `onError` toast `:716` | ✅ |
| draft review | disabled `:888,896` | `onError` toast `:731` | ✅ |
| suggestEquivalence | `:929` "Comparing…" + disabled `:925` | `onError` toast `:755` | ✅ |
| equiv review | disabled `:942,951` | `onError` toast `:785` | ✅ |
| **listModels** | — | **ni surfacea** | ⚠️ F-1: napaka → `localModels=[]` → prikaže "No active local model" |
| **ollamaStatus** | `:804` "Checking…" | fallback `reachable=false` | LOW: backend-down se prikaže kot "Ollama not reachable" |
| **questionsQuery** (equiv picker) | — | **ni surfacea** | LOW: napaka → prazen picker |
- **Brez praznih catch vej** (grep potrjen: nobenega `catch {}`). ✅
- **Reachability gate dejansko disabla:** `canGenerate = ollamaReachable && hasLocalModel
  && !!topicName && !!objectiveTitle` (`:702`), uporabljen v disable generate (`:865`);
  equiv gumb disabled `!ollamaReachable || !hasLocalModel || !equivBId` (`:925`); equiv
  Select disabled `!ollamaReachable` (`:909`). ✅

### 4) MODEL PARAM — ✅ POTRJENO
- Draft payload (`:707-713`): `{ topic, learningObjective, questionType, difficulty,
  instructions }` — **brez `model`**. Equiv payload (`:744-748`): `{ questionAId,
  questionBId, instructions }` — **brez `model`**.
- Servisni tipi `GenerateQuestionDraftInput`/`SuggestEquivalenceInput`
  (`aiAuthoring.ts:34-40, 50-54`) nimata `model` polja. **Nič izmišljenega.**
- "Model ignored" jasno: komentar `app.questions.$id.tsx:630-634`, UX tekst
  `:845` ("Informational only — generation always uses the active local Ollama model"),
  servisni komentar `aiAuthoring.ts:21-22`. ✅ Ni tihe zavajajoče izbire.

### 5) GOTCHAS NEDOTAKNJENI — ✅ POTRJENO
- **Status subset:** `statusMutation` tip `"REVIEW"|"APPROVED"|"REJECTED"|"ARCHIVED"`
  (`:161`); prehodni gumbi nespremenjeni. ✅
- **Client validacija:** `handleSave` (title/description/topicId + difficulty) je pred
  panelom in **ni bil urejan** (urejeni so bili samo importi, `<AIAssistantPanel/>`
  uporaba `:584-597`, in funkcija panela `:628+`). ✅
- **Options samo MCQ (≥2/≥1):** v `handleSave`, nedotaknjeno. ✅
- **Hydration keyed na id:** `:125-138` `}, [questionQuery.data?.id]);` nespremenjeno. ✅

### 6) SCOPE — ✅ POTRJENO
- **Brez `mock-data` importa** v `$id.tsx` (grep: NONE). ✅
- `git status`: samo `M app.questions.$id.tsx` + `?? aiAuthoring.ts`. Nobena
  frozen/tuja datoteka. ✅
- **Lasten `aiAuthoringKeys` iz `entityKeys`** (`aiAuthoring.ts:30`); `query-keys.ts`
  nedotaknjen. ✅ (uvoz `equivalentGroupsKeys`/`qk` je branje obstoječih, ne urejanje).

### 7) BUILD HEALTH
- `npx tsc --noEmit`: **0 napak v avditiranih datotekah.** Ostaneta 2 napaki v
  `src/routes/app.dashboard.tsx:115,129` (`/app/assessments/a1/...` — Dev B/C, **izven
  obsega**, pred-obstoječi na `main`). Samo zabeleženo.
- `npm run build` (vite): **zelen** (~21 s).
- `eslint` (obe datoteki): **exit 0**.

---

## NAJDBE (severity-ranked)

### [MEDIUM] F-1 — `listModels` napaka se prikaže kot "No active local model"
- **Datoteka:** `app.questions.$id.tsx:675-678` (modelsQuery, brez `isError`), `:685`
  (`localModels` iz `data ?? []`), `:815-821` (warning veja).
- **Dokaz:** ob napaki `modelsQuery` ostane `data=undefined` → `localModels=[]` →
  `hasLocalModel=false` → izriše se "No active local AI model. Activate one under AI
  Models…" — kar je **napačen vzrok** (dejansko gre za fetch/auth napako, ne za
  odsotnost aktivnega modela).
- **Priporočilo (opis):** ločiti `modelsQuery.isError` od "ni modelov" — prikazati
  ločeno sporočilo (npr. "Failed to load AI models") z retry; warning "no active local
  model" rezervirati za uspešen prazen rezultat. (Isti vzorec napake kot prej v
  equivalent-groups `questionsQuery`.)

### [MEDIUM] F-2 — Accept napolni samo `description` z neobdelanim model tekstom
- **Datoteka:** `app.questions.$id.tsx:596` (`onInsertDraft`), `:724` (klic).
- **Dokaz:** model vrne prost tekst, ki lahko vsebuje "Title: …", "answerOptions: …"
  inline; ta tekst gre **ves v `description`**. Title/type/difficulty/MCQ opcije
  ostanejo nespremenjeni → instruktor jih mora izpolniti ročno; tvegano za MCQ, kjer
  je predlog opcij le tekst v opisu, ne dejanske opcije.
- **Priporočilo (opis):** (a) minimalno — dodati UX opombo ob draftu ("Insert vstavi
  predlog v opis; title in opcije izpolnite ročno"), ali (b) bolje — poskusiti
  strukturirano parsiranje (če backend doda JSON odgovor) in napolniti title/type/
  options; brez backend sprememb ostane (a). Dokumentirati pričakovanje.

### [LOW] F-3 — `questionsQuery` (equivalence picker) napaka ni prikazana
- **Datoteka:** `app.questions.$id.tsx:735-740`.
- **Dokaz:** ob napaki `otherQuestions=[]` → picker je tiho prazen; uporabnik ne loči
  napake od "ni drugih vprašanj".
- **Priporočilo:** prikazati inline napako/disabled stanje z razlogom; sekundarno
  (equivalence ni primarni tok), zato LOW.

### [LOW] F-4 — `ollamaStatus` napaka se konflira z "Ollama not reachable"
- **Datoteka:** `app.questions.$id.tsx:700` (`reachable = data?.reachable ?? false`),
  `:806-814`.
- **Dokaz:** backend `/ai/ollama/status` vedno vrne 200 (`aiModelController.js:233-253`),
  a če pade sam API klic (npr. 401/server down), `statusQuery.isError` → `reachable=false`
  → prikaže "Ollama is not reachable", čeprav je vzrok backend, ne Ollama. Smiseln
  fallback, a sporočilo je lahko zavajajoče.
- **Priporočilo:** ob `statusQuery.isError` prikazati generično "Could not check AI
  status" namesto specifičnega "Ollama not reachable".

### [LOW] F-5 — Equivalence picker ni filtriran (vsi statusi / vsa izobraževanja)
- **Datoteka:** `app.questions.$id.tsx:740` (`otherQuestions` = vsa razen self).
- **Dokaz:** backend dovoli primerjavo katerihkoli dveh vprašanj, a seznam je lahko
  velik in vključuje DRAFT/ARCHIVED ter vprašanja iz drugih tematik. Funkcionalno OK.
- **Priporočilo:** opcijsko filtrirati po isti tematiki/težavnosti za smiselnost; ni nujno.

### [NIT] F-6 — non-null assert(`draft!`, `equiv!`) v mutationFn
- **Datoteka:** `:721, 760, 763-764`.
- **Dokaz:** varno zaradi pogojnega renderiranja gumbov (`{draft && …}`, `{equiv && …}`),
  a `!` je krhko ob bodočih refaktorjih. **Priporočilo:** guard znotraj `mutationFn`
  (early return če null) za robustnost. Brez funkcijske napake.

### [NIT] F-7 — model dropdown je čisto kozmetičen
- **Datoteka:** `:826` (`onValueChange={setSelectedModel}`, vrednost se nikamor ne pošlje).
- **Dokaz:** izbira modela nima funkcijskega učinka (backend uporablja default). To je
  **namerno in jasno označeno** (`:845`). Sprejemljivo; opcijsko bi se dalo skriti, če
  je le en lokalni model. Brez ukrepa.

---

## POZITIVNO (potrjeno pravilno)
- Interaction-id iz response (F-točka 1) — pravi AiInteraction.id.
- Free-text payload (topic **name** + objective **title**, ne id) se ujema z backend
  promptom (`aiController.js:31-58`); difficulty mapiran v `easy/medium/hard`
  (`:628, 711`) — backend sprejme tekst.
- `canGenerate` zahteva tudi `objectiveTitle` → prepreči 400 "Missing required fields:
  learningObjective" (backend `:18`). Pravilen gate.
- Advisory note (CLAUDE.md MVP) prisotna (`:795-798`), Accept/Reject realna prek
  `PATCH /ai/interactions/:id/review`.
- Equivalence Accept poveže B v skupino A prek obstoječe DEV A logike
  (`equivalentGroupsService.addQuestion`, `:764`) + invalidira `equivalentGroupsKeys.all`
  + `qk.questions.all` (`:771-772`). SetNull semantika ohranjena.

---

## ČESA NISEM POTRDIL
- **Runtime/integracija:** backend (`localhost:3000`) + Ollama nista bila pognana;
  vse je preverjeno statično (koda + controllerji). Dejanskih HTTP odgovorov (201
  oblika, 409 ob ponovnem reviewu, 502 ob nedosegljivi Ollami) nisem opazoval v živo.
- **Vedenje `addQuestion` ko B že pripada drugi skupini** (možna backend napaka ob
  Accept&link) — odvisno od backenda; UI bi jo prikazal prek `onError` toasta, a
  scenarija nisem izvajal.
- **Vizualni rendering** (dejanski izgled panela, dolg model tekst v `whitespace-pre-wrap`)
  ni bil vizualno preverjen; build je zelen, a UI ni bil odprt.
- **Prettier/format**: `eslint` zelen; ločenega `prettier --check` nisem izvajal v tem
  re-avditu (a lint pravila vključujejo `prettier/prettier`).

*Konec poročila. Brez popravkov.*
