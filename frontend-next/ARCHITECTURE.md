# ARCHITECTURE — frontend-next

Kako je `frontend-next/` zgrajen, kje živijo posamezni sloji in **kam pride auth +
apiClient**, da lahko delo razdelimo po vlogah/entitetah. Trenutno stanje: prototip iz
Lovable exporta, ki teče **izključno na static mock data** (brez backenda).

## Stack (ohranjen 1:1 iz Lovable exporta)

| Plast | Tehnologija |
| --- | --- |
| Framework | **TanStack Start** (SSR) — `@tanstack/react-start` ~1.167 |
| Routing | **TanStack Router**, file-based (`src/routes/*`), `routeTree.gen.ts` auto-gen |
| UI lib | React **19.2** + TypeScript 5.8 |
| Build | **Vite 7** (+ `nitro` za SSR/serverless build, privzeto cloudflare target) |
| Styling | **Tailwind v4** (`@tailwindcss/vite`) + `tw-animate-css`, design tokeni v `src/styles.css` |
| Komponente | **shadcn/ui** (style "new-york", base slate, CSS variables), lucide ikone |
| Data fetching | `@tanstack/react-query` (na voljo, trenutno mock — še ne uporabljen za API) |
| Forms / validacija | `react-hook-form` + `zod` |
| Grafi | `recharts` |

Vite config je zavit v `@lovable.dev/vite-tanstack-config` (pinnan na **`2.1.1`**), ki
že vključuje: tanstackStart, viteReact, tailwindcss, tsconfig-paths, nitro,
componentTagger (dev), VITE_* env injection, `@` alias. **Ne dodajaj teh pluginov ročno.**

> ⚠️ Verzijski pin: caret `^2.1.1` zdaj plava na 2.5.3, ki zahteva novejši `nitro`
> (peer konflikt z npm). Zato je config **pinnan na točno `2.1.1`** (= verzija, s katero
> je Lovable gradil export). Če kdaj nadgradiš config, hkrati bumpaj `nitro` na
> `>=3.0.260603-beta`.

## Zagon

```bash
cd frontend-next
npm install        # 460 paketov; config pinnan, da se npm resolva brez --legacy-peer-deps
npm run dev        # vite dev  -> http://localhost:8080/
npm run build      # vite build (client + SSR v dist/)
npm run preview    # predogled buildane verzije
npm run lint       # eslint
```

Dev port je **8080** (določa ga Lovable config / sandbox detection).

## Struktura map

```
frontend-next/
  components.json            shadcn config (style new-york, aliasi @/components, @/lib, @/hooks)
  vite.config.ts             tanstackStart entry -> src/server.ts
  src/
    styles.css               Tailwind v4 + VSI design tokeni (barve, sidebar/surface, radius)
    router.tsx               createRouter (history, defaultPreload, QueryClient wiring)
    routeTree.gen.ts         AUTO-GENERIRANO (ne urejaj ročno)
    start.ts                 client entry (hydration)
    server.ts                SSR entry (error wrapper okrog TanStack Start handlerja)
    routes/                  vse poti (file-based) + __root.tsx (app shell)
    components/
      layout/                AppShell, SidebarNav, TopBar
      common/                PageHeader, MetricCard, StatusBadge, EmptyState
      ui/                    shadcn/ui primitivi (~50)
    hooks/                   use-mobile, …
    lib/
      mock-data.ts           >>> MOCK LAYER (vir vseh podatkov) <<<
      role-context.tsx       >>> ROLE SWITCHER (demo auth) <<<
      utils.ts               cn() helper
      api/example.functions.ts   TanStack Start server-function primer (placeholder)
      config.server.ts       server-side config (SSR)
      error-capture.ts, error-page.ts, lovable-error-reporting.ts   Lovable dev/error tooling
  .lovable/project.json      Lovable metadata
```

## Mock layer — kje so podatki

**`src/lib/mock-data.ts`** je edini vir resnice za podatke v prototipu (~600 vrstic):

- **Tipi / enumi:** `AssessmentStatus`, `AssessmentType`, `QuestionStatus`, `QuestionType`,
  `Difficulty` + vmesniki `Topic`, `LearningObjective`, `Training`, `Participant`,
  `Question`, `Assessment`, `User`, `AIModel`, `ParticipantAssessment`.
- **Konstante (seed):** `TOPICS`, `TRAININGS`, `PARTICIPANTS`, `QUESTIONS`, `ASSESSMENTS`,
  `USERS`, `AI_MODELS`, `MY_ASSESSMENTS` + analitika (`TOPIC_PERFORMANCE`,
  `DIFFICULTY_PERFORMANCE`, `PRE_POST_COMPARISON`, `PROGRESS_OVER_TIME`,
  `SCORE_DISTRIBUTION`, `RECENT_ACTIVITY`).
- **Lookup helperji:** `getTraining(id)`, `getAssessment(id)`, `getQuestion(id)`,
  `assessmentsForTraining(id)`, `questionsForTraining(title)`.

Strani trenutno importajo te konstante neposredno. Pri prehodu na backend te uvoze
zamenjajo klici skozi `services/` (glej spodaj).

## Role switcher — kje je "auth" zdaj

**`src/lib/role-context.tsx`** (`RoleProvider` + `useRole()`):

- `Role = "admin" | "instructor" | "participant"` (demo), shranjeno v `localStorage`
  (`projekt3.role`, `projekt3.auth`). Privzeta vloga: `instructor`.
- `DEMO_USERS` — statični demo uporabniki (ime/email/role).
- API: `role`, `user`, `setRole()`, `isAuthenticated`, `login(role)`, `logout()`.
- **UI vstopne točke:** `login.tsx` ("Continue as …") in `TopBar.tsx` ("View as: …").
- Vidnost ekranov: `SidebarNav.tsx` → `NAV[role]`. Gating je zdaj **navigacijski**
  (URL ostane dosegljiv ročno).

## Kam pride pravi auth + apiClient (predlog za delitev dela)

Cilj: zamenjati mock + demo role z **Firebase Auth** in **REST backendom**, brez
spreminjanja izgleda. Predlagana struktura (skladna z obstoječim `frontend/` v repo):

```
src/lib/firebase.ts          # Firebase web init (config iz VITE_* env)
src/auth/AuthProvider.tsx    # nadomesti/ovije RoleProvider; pravi user + ID token
src/auth/permissions.ts      # hasRole(...) na realnih UserRole (ADMIN/INSTRUCTOR/PARTICIPANT)
src/services/apiClient.ts    # apiFetch/apiJsonFetch + Firebase Bearer token (vzor: obstoječi frontend/)
src/services/<entiteta>.ts   # po ena na entiteto: questions, topics, trainings,
                             #   assessments, results, users, aiModels, aiInsights
src/types/                   # deljeni tipi (izpeljani iz prisma enumov; danes živijo v mock-data.ts)
```

**Načrt migracije (priporočen vrstni red):**

1. **Tipi:** izloči vmesnike/enume iz `mock-data.ts` → `src/types/`. Uskladi z
   `backend/prisma/schema.prisma` (vir resnice za vloge/statuse).
2. **apiClient:** dodaj `services/apiClient.ts` (Bearer token). Vse strani naj kličejo
   skozenj — nikoli `fetch` neposredno (enako pravilo kot v `frontend/`).
3. **Auth:** `firebase.ts` + `AuthProvider`; `useRole()` ohrani isti API površinsko, da
   strani ostanejo nedotaknjene, a vir je realni user + claims (role).
4. **Role gating:** uvedi `ProtectedRoute`/route `beforeLoad` guard po vlogah (zdaj je
   `app.tsx` `beforeLoad` namenoma no-op; tam pride redirect na `/login`).
5. **Services + React Query:** zamenjaj direktne `mock-data` uvoze z `useQuery` klici na
   `services/*`. `@tanstack/react-query` je že nameščen.
6. **Počisti Lovable tooling** (`lovable-error-reporting.ts`, componentTagger) ko ni več
   potreben.

### Mapiranje vlog na backend

| frontend-next (demo) | backend (`UserRole`) |
| --- | --- |
| `admin` | `ADMIN` |
| `instructor` | `INSTRUCTOR` |
| `participant` | `PARTICIPANT` |

> Uporabljaj **`PARTICIPANT`**, nikoli `STUDENT` (glej `CLAUDE.md`). Demo user
> `eva.student@…` je le placeholder email.

## AI pravila (veljajo tudi za UI)

AI je **advisory**: predlogi (AI Insights, AI Models) morajo ostati neavtonomni —
nič se ne objavi/ustvari brez potrditve inštruktorja; izpisi naj navedejo, da jih mora
pregledati inštruktor (glej `docs/mvp-scope.md` in `CLAUDE.md`).

## Razmerje do obstoječega `frontend/`

`frontend/` (Vite + React Router, obstoječ) ostaja **nedotaknjen**. `frontend-next/` je
nov, vzporeden kandidat z Lovable izgledom; backend ni vezan na nobenega od njiju v tem
koraku. `lovable-reference/` je le referenca (ni del build-a).
