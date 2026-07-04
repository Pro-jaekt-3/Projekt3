# CLAUDE.md

Navodila za delo z agentom (Claude Code) v tem repozitoriju. Preberi pred vsakim taskom.

## Kaj je projekt

AI-podprt sistem za **generiranje, upravljanje in analizo vprašanj/testov** za področje
informatike. Inštruktorji pripravljajo banko vprašanj (po izobraževanjih, tematikah in
učnih ciljih), gradijo preverjanja, udeleženci jih rešujejo, sistem pa ponuja analitiko
in **advisory** AI predloge (lokalni Ollama). Končno odločitev vedno sprejme inštruktor.

- **Frontend**: React 19 + TypeScript + Vite + Tailwind, React Router, Firebase Auth (web SDK)
- **Backend**: Node.js + Express 5 + Prisma (CommonJS, `require`), Firebase Admin za verifikacijo tokenov
- **Baza**: MySQL (preko Prisme)
- **AI**: lokalni Ollama (privzeti model `qwen3:8b`); OpenAI/DeepSeek so v configu, a niso implementirani za generacijo

## Vloge (UserRole)

Trije nivoji — **uporabljaj točno te nazive** (glej `prisma/schema.prisma`):

- `ADMIN` — vse + admin strani (`/admin/*`: users, trainings, assessments, ai-models)
- `INSTRUCTOR` — vprašanja, tematike, učni cilji, izobraževanja, preverjanja, analitika, AI asistent
- `PARTICIPANT` — reševanje preverjanj, lastni rezultati (`/my-assessments`, `/my-results/:id`)

⚠️ **NE uporabljaj `STUDENT`.** Pravi naziv je `PARTICIPANT` povsod (baza, API, frontend, seed).

## Ključna AI pravila (glej `docs/mvp-scope.md`)

AI je **podporno orodje**, ne avtonomni odločevalec:

- AI **lahko** predlaga vprašanja, odgovore, preverjanja in pomaga organizirati vsebine.
- AI **ne sme** samodejno objaviti vprašanja ali ustvariti preverjanja brez potrditve.
- Vsak AI predlog mora biti **eksplicitno potrjen ali zavrnjen** s strani uporabnika
  (`AiInteraction.reviewStatus`: `PENDING` → `ACCEPTED`/`REJECTED`).
- Generiran osnutek se nikoli ne označi kot `APPROVED`; konča kot `DRAFT`/`NEEDS_REVIEW`.
- AI insights so **advisory only** — izpis mora navesti, da ga mora pregledati inštruktor.
- Generacija teče samo proti **aktivnemu** (`isActive`) lokalnemu Ollama modelu, ki je tudi
  dejansko nameščen (`ollama pull`). Neaktivni modeli se ne uporabljajo.

## Struktura map

```
backend/                  Express REST API (CommonJS)
  config/ai.js            centralizirana AI provider konfiguracija
  controllers/            poslovna logika (po entiteti + aiController, analyticsController)
  routes/                 route definicije (auth + role middleware na vsaki poti)
  middleware/             firebaseAuthMiddleware (produkcijska pot), roleMiddleware, authMiddleware (legacy header-based)
  lib/firebaseAdmin.js    Firebase Admin init
  prisma/
    schema.prisma         shema + enumi (vir resnice za vloge/statuse)
    migrations/           Prisma migracije (ne urejaj ročno obstoječih)
    seed.js               idempotenten demo seed
  server.js               vstopna točka, montira /auth /questions /topics ... /ai
frontend/                 Vite React app
  src/auth/               AuthProvider (Firebase), permissions (hasRole)
  src/components/         AppShell, Navbar, ProtectedRoute, ui.tsx, Card, PageContainer
  src/pages/              ena stran na route (glej App.tsx)
  src/services/           apiClient.ts (apiFetch z Bearer tokenom) + en service na entiteto
  src/lib/firebase.ts     Firebase web init
docs/                     mvp-scope.md, ER/arhitekturni diagrami
lovable-reference/        SAMO referenca za UI (assess-weave-main); NI del build-a
```

## Najpomembnejši ukazi

Backend (iz `backend/`):
```bash
npm install
npm run dev                      # nodemon server.js -> http://localhost:3000
npx prisma migrate reset --force # ponovno zgradi bazo + seed
npx prisma db push               # samo sinhronizacija sheme
npx prisma db seed               # idempotenten demo seed (node prisma/seed.js)
npx prisma generate              # po spremembi sheme
```

Frontend (iz `frontend/`):
```bash
npm install
npm run dev      # vite -> http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # eslint
```

AI / Ollama preverjanje:
```bash
ollama list
curl http://localhost:11434/api/tags
```

## Konvencije, ki se jih je treba držati

- **NE spreminjaj** `package-lock.json` (root in podmape) ali `repo-files.txt` — niso del nalog.
- **NE mešaj backend in frontend v istem tasku** — drži se ene strani naenkrat.
- Uporabljaj **`PARTICIPANT`**, nikoli `STUDENT`.
- Backend je **CommonJS** (`require`/`module.exports`), frontend je **ESM + TypeScript**.
- Vloge in statusi izhajajo iz `prisma/schema.prisma` — to je vir resnice; ne podvajaj ročno.
- Vsaka zaščitena pot uporablja `firebaseAuthMiddleware` + `requireRole(...)`. Nove poti naj
  sledijo istemu vzorcu (glej `routes/questionRoutes.js`, `routes/aiRoutes.js`).
- Frontend API klici gredo skozi `services/apiClient.ts` (`apiFetch`/`apiJsonFetch`), ki doda
  Firebase `Bearer` token; ne kliči `fetch` neposredno v straneh.
- Zaščita poti na frontendu preko `ProtectedRoute allowedRoles={[...]}` v `App.tsx`.
- Ne commitaj `.env` (vsebuje skrivnosti); `.env.example` je referenca.
- Ne ustvarjaj novih Prisma migracij brez razloga; obstoječih migracij ne urejaj ročno.
