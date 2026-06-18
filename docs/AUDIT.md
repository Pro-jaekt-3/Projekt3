# AUDIT — Projekt3

Pregled stanja repozitorija ob uvodnem auditu. Namen: hiter posnetek arhitekture,
podatkovnega modela, varnostnih in konsistenčnih opažanj, ki naj jih agent upošteva.

## 1. Pregled arhitekture

- **Monorepo** z dvema deloma: `backend/` (Express 5 + Prisma + MySQL, CommonJS) in
  `frontend/` (React 19 + Vite + Tailwind, TypeScript/ESM).
- **Avtentikacija**: Firebase (web SDK na frontendu, Admin SDK na backendu). Frontend
  pošlje Firebase ID token kot `Authorization: Bearer ...`; `firebaseAuthMiddleware` ga
  verificira in poveže/ustvari lokalnega `User` po `firebaseUid`/`email`.
- **Avtorizacija**: `requireRole(...)` na vsaki zaščiteni poti; vloge `ADMIN`,
  `INSTRUCTOR`, `PARTICIPANT`.
- **AI**: lokalni Ollama (`config/ai.js` + `aiController.js`). Vse AI generacije se
  beležijo v `AiInteraction` s `reviewStatus=PENDING` in zahtevajo človeški pregled.

## 2. Podatkovni model (Prisma)

Glavne entitete in povezave (`backend/prisma/schema.prisma`):

- `Training` 1—* `Topic` 1—* `LearningObjective`
- `Topic` 1—* `Question`; `Question` opcijsko *—1 `LearningObjective`
- `Question` *—1 `EquivalentQuestionGroup`; 1—* `AnswerOption`
- `Assessment` *—1 `Training`; 1—* `AssessmentQuestion` (—1 `Question`)
- `Assessment` 1—* `AssessmentAttempt` 1—* `ParticipantAnswer`
- `AiModel` 1—* `AiInteraction`; `AiInteraction` sklicuje source/generated `Question`
- `User` poganja `createdBy`/`reviewedBy` na `Question` in `AiInteraction`

Enumi: `QuestionType` (OPEN, MULTIPLE_CHOICE, CODE), `QuestionStatus`
(DRAFT, NEEDS_REVIEW, REVIEW, APPROVED, REJECTED, ARCHIVED), `AssessmentType`
(PRE_TEST, POST_TEST, QUIZ), `AssessmentStatus`, `AttemptStatus`, `UserRole`,
`AiProvider`, `AiAction`, `AiReviewStatus`.

20 migracij (od `init` 2026-05-22 do `add_firebase_uid_to_user`) — shema je stabilna.

## 3. API površina

Montirane v `server.js`: `/auth`, `/questions`, `/topics`, `/learning-objectives`,
`/trainings`, `/equivalent-question-groups`, `/assessments`, `/assessment-attempts`,
`/analytics`, `/ai`.

- CRUD entitet (trainings/topics/learning-objectives/questions) je za `ADMIN`+`INSTRUCTOR`.
- `assessment-attempts` (start/submit/get) dovoljuje tudi `PARTICIPANT`.
- `/ai/*` (models, ollama/status, question-draft, equivalence-suggestion,
  pre-post-insights, interactions/:id/review) je za `ADMIN`+`INSTRUCTOR`.

## 4. AI — opažanja

- Generacija je trdno omejena: samo aktiven (`isActive`) **lokalni** Ollama model, ki je
  tudi dejansko nameščen; sicer 4xx/5xx z jasnim sporočilom.
- Le Ollama je implementiran (`aiController` vrne 501 za druge providerje), čeprav
  `config/ai.js` pripravi OpenAI/DeepSeek/OTHER configs — **dokumentirano kot TODO**.
- Vsi prompti eksplicitno navajajo, da je rezultat osnutek/advisory za človeški pregled —
  skladno z `docs/mvp-scope.md`. ✔

## 5. Varnostna in konsistenčna opažanja

| # | Opažanje | Resnost | Opomba |
|---|----------|---------|--------|
| 1 | `middleware/authMiddleware.js` veruje header-jem `x-user-id`/`x-user-role` brez verifikacije | Visoka (če v rabi) | Videti je legacy; produkcijske poti uporabljajo `firebaseAuthMiddleware`. Preveri, da nikjer ni montiran. |
| 2 | `server.js` ima `PORT` hardcodiran na 3000 (vrstica 38) in ignorira `process.env.PORT` | Nizka | README/`.env` omenjata `PORT`; razhajanje. |
| 3 | CORS je popolnoma odprt (`app.use(cors())`) | Srednja | Za demo ok; za produkcijo omeji origin. |
| 4 | `.env` je prisoten v `backend/` in vsebuje skrivnosti | Info | Mora ostati v `.gitignore`; ne commitaj. |
| 5 | OPEN/CODE odgovori se shranijo, a se ne ocenjujejo samodejno | Po zasnovi | MVP omejitev; avtomatsko ocenjevanje le za MULTIPLE_CHOICE. |
| 6 | Naziv vloge: povsod `PARTICIPANT`, nikjer `STUDENT` | ✔ | Konsistentno; seed maile tipa `*.student@` so le emaili. |

## 6. Build / orodja

- Frontend: `npm run build` (`tsc -b && vite build`), `npm run lint` (eslint flat config).
- Backend: brez build koraka; `npm run dev` = `nodemon server.js`. Ni testov.
- Ni CI konfiguracije v repozitoriju.

## 7. Priporočila (ne-blokirajoča)

1. Odstrani ali jasno označi legacy `authMiddleware.js`, da ne pride v rabo.
2. `server.js` naj bere `process.env.PORT` z fallbackom na 3000.
3. Razmisli o omejitvi CORS origin-a za ne-demo okolja.
4. Dodaj minimalne teste za scoring logiko (MULTIPLE_CHOICE) in role-gating.

> Audit je posnetek stanja; ničesar v kodi ni spreminjal. Spremembe naj sledijo
> konvencijam iz `CLAUDE.md` (en del naenkrat, brez `package-lock.json`/`repo-files.txt`).
