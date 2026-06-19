# ARCHITECTURE — frontend-next

Kako je `frontend-next/` zgrajen, kje živijo posamezni sloji in **kam pride auth +
apiClient**, da lahko delo razdelimo po vlogah/entitetah. Trenutno stanje: prototip iz
Lovable exporta, ki teče **izključno na static mock data** (brez backenda).

## Stack

> **Posodobljeno (Option C):** pretvorjeno iz TanStack **Start (SSR)** v TanStack
> **Router SPA** brez vizualnih sprememb. Zgodovino/utemeljitev glej v sekciji
> [F1 — Investigacija: SSR vs SPA](#f1--investigacija-ssr-vs-spa-brez-sprememb-kode)
> in [F2 — izvedeno](#f2--izvedeno-option-c-start--router-spa) spodaj.

| Plast | Tehnologija |
| --- | --- |
| Framework | **TanStack Router SPA** (brez SSR) — `@tanstack/react-router` ~1.168 |
| Routing | file-based (`src/routes/*`), `routeTree.gen.ts` generira `@tanstack/router-plugin` |
| UI lib | React **19.2** + TypeScript 5.8 |
| Build | **Vite 7** — statičen client build (`dist/index.html` + `assets/`), brez strežnika |
| Styling | **Tailwind v4** (`@tailwindcss/vite`) + `tw-animate-css`, design tokeni v `src/styles.css` |
| Komponente | **shadcn/ui** (style "new-york", base slate, CSS variables), lucide ikone |
| Data fetching | `@tanstack/react-query` (montiran, trenutno mock — še ne uporabljen za API) |
| Forms / validacija | `react-hook-form` + `zod` |
| Grafi | `recharts` |

Vite config (`vite.config.ts`) je **standarden Vite SPA setup**: pluginsi
`vite-tsconfig-paths` (`@/*` alias iz `tsconfig.json`), `@tanstack/router-plugin/vite`
(`tanstackRouter`, file-based routing + code-splitting), `@vitejs/plugin-react`,
`@tailwindcss/vite`. Dev/preview port je fiksiran na **8080** (`server.port` / `preview.port`,
`strictPort`).

> Lovable build wrapper (`@lovable.dev/vite-tanstack-config`), `@tanstack/react-start`
> in `nitro` so **odstranjeni** — s tem izgine tudi prvotni npm ERESOLVE peer konflikt,
> zato `npm install` deluje brez `--legacy-peer-deps`.

## Zagon

```bash
cd frontend-next
npm install        # brez --legacy-peer-deps
npm run dev        # vite dev      -> http://localhost:8080/
npm run build      # vite build    -> statičen dist/ (index.html + assets/, BREZ strežnika)
npm run preview    # vite preview  -> http://localhost:8080/ (servira dist/)
npm run lint       # eslint
```

## Struktura map

```
frontend-next/
  index.html                 SPA vstopna HTML lupina (#root + <script src="/src/main.tsx">)
  components.json            shadcn config (style new-york, aliasi @/components, @/lib, @/hooks)
  vite.config.ts             standarden Vite SPA (tanstackRouter + react + tailwind + tsconfigPaths)
  src/
    main.tsx                 KLIENTSKI ENTRY — mount <RouterProvider> v #root, import styles.css
    styles.css               Tailwind v4 + VSI design tokeni (barve, sidebar/surface, radius)
    router.tsx               getRouter(): createRouter (+ QueryClient context, Register tip)
    routeTree.gen.ts         AUTO-GENERIRANO (router-plugin; ne urejaj ročno)
    routes/                  vse poti (file-based) + __root.tsx (root route: providerji + <Outlet/>)
    components/
      layout/                AppShell, SidebarNav, TopBar
      common/                PageHeader, MetricCard, StatusBadge, EmptyState
      ui/                    shadcn/ui primitivi (~50)
    hooks/                   use-mobile, …
    lib/
      mock-data.ts           >>> MOCK LAYER (vir vseh podatkov) <<<
      role-context.tsx       >>> ROLE SWITCHER (demo auth) <<<
      utils.ts               cn() helper
      lovable-error-reporting.ts   client error reporter (window-guarded; uporabljen v __root)
  .lovable/project.json      Lovable metadata
```

> Odstranjeno ob SPA konverziji: `src/server.ts`, `src/start.ts`,
> `src/lib/api/example.functions.ts`, `src/lib/config.server.ts`,
> `src/lib/error-capture.ts`, `src/lib/error-page.ts` (vse je bilo SSR/Start-only).

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

---

# F1 — Investigacija: SSR vs SPA (brez sprememb kode)

Analiza dejanske rabe SSR/server funkcij v `frontend-next/`, z namenom odločitve med
**Option B** (obdrži TanStack Start, podatki client-side, SSR servira le lupino) in
**Option C** (pretvori v TanStack Router SPA, statičen hosting).

## 1. SSR — se dejansko uporablja?

**Zaključek: SSR je VKLOPLJEN, a NI realnih server-side podatkovnih odvisnosti. App je
de facto client-renderable z mock podatki.**

Dokazi:

| Najdba | Dokaz (file:line) | Pomen |
| --- | --- | --- |
| SSR globalno vklopljen | `src/routeTree.gen.ts:568` → `interface Register { ssr: true }` | TanStack Start renderira na strežniku (dev na :8080 vrača SSR HTML) |
| SSR entry = samo error wrapper | `src/server.ts` (fetch → `@tanstack/react-start/server-entry`), `src/start.ts` (errorMiddleware) | Strežnik ne dela podatkovne logike; le ovije napake |
| Route loaderji so **sinhroni mock lookupi** | `app.assessments.$id.tsx:22-26`, `app.assessments.$id.results.tsx:17`, `app.assessments.$id.post-test.tsx:19`, `app.trainings.$id.tsx:24`, `assessment.$id.access.tsx:11`, `assessment.$id.solve.tsx:15-19`, `assessment.$id.result.tsx:11` | Npr. `getAssessment(params.id) ?? ASSESSMENTS[0]` — **brez `async`/`await`, brez fetcha, brez server-only dostopa**. Izomorfni: tečejo enako na strežniku in clientu, ker je `mock-data` navaden modul v client bundlu |
| `beforeLoad` je no-op | `app.tsx:5-9` (`void location`) | Nobenega server gatinga/redirecta |
| `createServerFn` obstaja, a je **mrtva koda** | `src/lib/api/example.functions.ts:14` (`getGreeting`) | Nikjer importan/klican (grep `getGreeting` → samo ta datoteka). Edini uporabnik `config.server.ts` je prav ta neuporabljen primer |
| Nič server-only dostopa v ekranih | grep `.server`, `createServerFn`, `process.env` v routes → 0 | Noben ekran ne potrebuje strežnika za podatke |

→ Edino, kar SSR trenutno počne, je **renderiranje statične lupine + mock HTML**. Vse
podatke bi se dalo enako servirati client-side.

## 2. Mock layer — kje živi in kje je "seam" za pravi service

- Vir: **`src/lib/mock-data.ts`** (en modul; uvožen v **20 datotek**).
- Dva vzorca potrošnje po ekranih:
  1. **Route `loader` → `Route.useLoaderData()`** (detajlne strani):
     `loader` vrne mock lookup, komponenta ga prebere. Primer: `app.assessments.$id.tsx:22`
     (`loader`) + `:31` (`useLoaderData`).
  2. **Direkten modul-uvoz konstant** v komponento:
     npr. `app.assessments.$id.tsx:17` `import { ASSESSMENTS, PARTICIPANTS, QUESTIONS, getAssessment }`,
     nato `QUESTIONS.filter(...)` (`:39`).
- **Seam za migracijo na pravi service (per ekran):**
  - Za vzorec (1): zamenjaj telo `loader`-ja s `queryClient.ensureQueryData(service.x)`
    ali pretvori v client `useQuery`.
  - Za vzorec (2): zamenjaj direktni import s `useQuery` klicem na `services/<entiteta>.ts`.
  - V obeh primerih ostane tip (`Assessment`, `Training` …) — danes iz `mock-data.ts`,
    jutri iz `src/types/`.

## 3. Role switching — kako deluje in vsa mesta branja

- **`src/lib/role-context.tsx`**: `RoleProvider` (montiran v `__root.tsx:127`) +
  `useRole()`. Stanje v `localStorage` (`projekt3.role`, `projekt3.auth`), privzeto
  `instructor`. API: `role, user, setRole, isAuthenticated, login, logout`.
- **Vsa mesta branja `useRole()`** (za zamenjavo s Firebase auth + dev-only override):
  - `components/layout/TopBar.tsx:35` — role switcher UI + logout
  - `components/layout/SidebarNav.tsx:51` — `NAV[role]` (vidnost menija)
  - `routes/app.dashboard.tsx:20,29,218` — izbira dashboard variante + user
  - `routes/app.assessments.index.tsx:21` — naslov/filter po vlogi
  - `routes/app.trainings.index.tsx:15` — "All" vs "My"
  - `routes/assessment.$id.access.tsx:21` — `isAuthenticated, role`
  - `routes/login.tsx:27` — `login(role)`
- **Plan:** `AuthProvider` (Firebase) izpostavi **isti API površinsko** kot `useRole()`,
  da teh 9 mest ostane nedotaknjenih; vir postane realni user + claims. Dev-only override
  (npr. `?as=admin` ali gumb v TopBar pod flagom) ohrani hitro preklapljanje vlog.

## 4. Routing & guards — kako se vloge mapirajo danes, kam pride access control

- File-based routi (`src/routes/*`); mapiranje pot→vloga je v
  [SCREENS.md](./SCREENS.md).
- **Današnji gating je le navigacijski** (`SidebarNav NAV[role]`) + nekaj in-component
  `role` razvejitev (dashboard variante, naslovi). **Route-level zaščite NI**:
  `app.tsx beforeLoad` je no-op, URL je dosegljiv ročno za katerokoli vlogo.
- **Kam pride access control:** v `beforeLoad` na `/app` (parent) za auth-redirect na
  `/login`, ter per-route `beforeLoad`/`ProtectedRoute` za vlogo (npr. `/app/users`,
  `/app/ai-models`, `/app/system-analytics` = samo ADMIN). Z auth contextom v routerju
  (`createRootRouteWithContext`) je to naravno mesto.

## 5. Data fetching (react-query) — setup in SSR

- `QueryClient` ustvarjen v `src/router.tsx:6`, ponujen prek `QueryClientProvider` v
  `__root.tsx:126` in router contexta (`createRootRouteWithContext<{ queryClient }>`).
- **react-query je montiran, a NEUPORABLJEN**: grep `useQuery|useMutation|useSuspenseQuery|queryOptions`
  → **0 zadetkov**. Infrastruktura je pripravljena, klicev še ni.
- **Nobeno fetchanje ne teče med SSR** — loaderji so sinhroni mock bralci, brez async/
  server fetchov.

## Priporočilo

Ker (1) pokaže **nič realne SSR rabe** (brez server funkcij v uporabi, brez SSR
fetchanja, loaderji so izomorfni mock bralci) in ker bo app po integraciji serviral
**per-user, za-auth podatke prek REST backenda** (kjer SSR/edge cache nima koristi):

### → Priporočam **Option C — TanStack Router SPA, statičen hosting.**

| | Option B (TanStack Start, client-fetch, SSR servira lupino) | **Option C (TanStack Router SPA)** |
| --- | --- | --- |
| Spremembe izgleda | brez | brez (iste komponente/tokeni/routi) |
| Deployment | **potrebuje Node/serverless SSR runtime** (nitro → cloudflare/node) — strežnik teče stalno | **statične datoteke** (`index.html` + assets) na kateremkoli CDN/static hostu (Firebase Hosting, Netlify, S3) — enaka zgodba kot obstoječi `frontend/` |
| Firebase auth | SSR + Firebase web SDK + `localStorage` role → tveganje hydration neujemanj | client-only auth je naraven; brez hydration pasti |
| Operativni strošek | višji (strežnik/serverless) | minimalen (CDN) |
| Migracijski trud | **nizek** — pusti kot je, dodaj client fetching | **zmeren, enkraten** — zamenjaj `@tanstack/react-start`→`@tanstack/react-router` + Vite SPA, `__root` html/`Scripts` → SPA entry + `index.html`, odstrani `server.ts`/`start.ts`/server-entry, `ssr:true`; izomorfni loaderji v Routerju delujejo naprej |

**Utemeljitev:** SSR tu ne prinaša nobene koristi (ni SEO-kritične javne vsebine za
prijavo; podatki so zasebni in dinamični), a doda strežniško površino in zaplete Firebase
auth (ki je client-side po naravi) ter deployment. Option C poenoti hosting z obstoječim
`frontend/` in je najcenejši/najpreprostejši za vzdrževanje. Strošek je **enkratna,
omejena migracija brez vizualnih sprememb**.

Option B je smiseln **samo**, če pričakujemo prihodnjo potrebo po SSR (SEO javnih strani,
server-side secrets prek `createServerFn`, streaming). Trenutno nič od tega ni v uporabi.

> **Odločitev pred nadaljevanjem:** izberi **B** ali **C**, preden postavim temelje za
> auth + apiClient (struktura iz sekcije "Kam pride pravi auth + apiClient").

---

# F2 — izvedeno: Option C (Start → Router SPA)

**Odločitev: Option C.** `frontend-next/` je pretvorjen iz TanStack Start (SSR) v
TanStack Router **SPA**, **brez vizualnih sprememb**. Backend in auth NISTA vezana
(ločen korak).

## Kaj se je spremenilo

| Področje | Prej (Start/SSR) | Zdaj (Router SPA) |
| --- | --- | --- |
| Vstopna točka | `src/server.ts` (SSR fetch) + `src/start.ts` (createStart) | `index.html` + `src/main.tsx` (`createRoot` → `<RouterProvider>`) |
| Root route | `__root.tsx` z `<html>/<head>/<HeadContent>/<Scripts>` + `shellComponent` | `__root.tsx` brez dokumenta; renderira `<HeadContent/>` + `<Outlet/>` ovito v `QueryClientProvider` + `RoleProvider` |
| Vite config | `@lovable.dev/vite-tanstack-config` (tanstackStart, nitro, cloudflare) | standarden Vite: `tanstackRouter` + react + tailwind + tsconfigPaths |
| SSR flag | `Register { ssr: true }` v `routeTree.gen.ts` | odstranjen (routeTree regeneriran s router-plugin) |
| Mrtva koda | `createServerFn` `getGreeting` + `config.server.ts` | odstranjeno |
| Stili | `import appCss from "...styles.css?url"` + `<link>` v head | `import "./styles.css"` v `main.tsx` |
| Odvisnosti | `@tanstack/react-start`, `@lovable.dev/vite-tanstack-config`, `nitro` | **odstranjene** |

## Kaj je ostalo NEDOTAKNJENO (zato ni vizualnih sprememb)

Vse poti (`src/routes/*`), vse komponente (`layout`, `common`, `ui`), Tailwind v4
config + design tokeni (`styles.css`), `mock-data.ts` in role switcher (`role-context.tsx`).
Izomorfni sinhroni loaderji ostanejo kot so — v Router SPA delujejo nespremenjeno.

## Verifikacija (vse opravljeno)

- ✅ `npm install` brez `--legacy-peer-deps` (odstranjenih 109 paketov; peer konflikt izginil).
- ✅ `npm run dev` → `http://localhost:8080/` vrača **HTTP 200** (tudi `/login`).
- ✅ `npm run build` → **statičen `dist/`**: samo `index.html` + `assets/`, **brez `dist/server/`**.
- ✅ `npm run preview` (port 8080) servira buildano aplikacijo: HTTP 200 na `/` in deep
  route `/app/dashboard` (SPA fallback na `index.html`).
- ✅ `routeTree.gen.ts` regeneriran čisto (brez `react-start`/`ssr: true`/`start.ts` referenc).

**Vizualna paralelnost:** vse vizualne datoteke (komponente, shadcn/ui, Tailwind tokeni)
so byte-nedotaknjene; spremenjeni so le vstopna lupina, root document in build pipeline.
Edina vedenjska razlika je dostavna, ne vizualna: začetni HTML je zdaj prazen `#root`, ki
ga React hidrira na klientu (prej je SSR vrnil že izrisan HTML). V brskalniku je izrisan UI
identičen.

## Deployment

Build output je **deployabilen na navaden statičen host brez strežniškega runtime-a**
(Firebase Hosting, Netlify, Vercel-static, S3+CloudFront, GitHub Pages …):

- `dist/` vsebuje le `index.html` + `assets/` (JS/CSS) — **brez `dist/server/`, brez nitro
  serverja, brez serverless funkcij**.
- Edina hosting zahteva: **SPA fallback** (vse ne-asset poti → `index.html`), da deep
  linki (`/app/dashboard`, `/assessment/:id/solve`) delujejo ob osvežitvi. Npr. Firebase
  `rewrites: [{ source: "**", destination: "/index.html" }]`.

To poenoti hosting zgodbo z obstoječim `frontend/` (prav tako Vite SPA).

---

# F3 — izvedeno: realni Firebase auth + apiClient temelj

**Cilj:** zamenjati mock role-context z realnim Firebase authom (ista `useRole()`
površina) + tipiran `apiClient` z Bearer tokenom. **Ekrani še vedno tečejo na mock** —
zamenjana je le avtentikacija pod njimi (NOBEN screen-data ni vezan na backend).

## Dodano / spremenjeno

| Datoteka | Vloga |
| --- | --- |
| `.env.example` | referenca env ključev: `VITE_API_URL`, `VITE_FIREBASE_*`, `VITE_DEV_ROLE_OVERRIDE`. Pravi `.env` izpolni uporabnik; `.env` se ne commita |
| `src/lib/firebase.ts` | Firebase web init iz env (port iz `frontend/`); `auth` + `googleProvider` |
| `src/services/apiClient.ts` | `apiFetch` / `apiJsonFetch` / `apiEnsureOk`: base URL iz `VITE_API_URL`, `Authorization: Bearer <Firebase ID token>`, `{ error }` ekstrakcija, **204 / prazno telo → `undefined`** |
| `src/lib/role-context.tsx` | interni del prepisan na realni auth; **`useRole()` API nespremenjen** (`role, user, isAuthenticated, login, logout, setRole`) — 9 klicnih mest ostane nedotaknjenih |
| `src/routes/login.tsx` | realni Firebase sign-in (email/geslo + Google); dev override gumbi kot fallback (vidni le ko je override omogočen) |

## Kako deluje auth zdaj

- `RoleProvider` posluša `onAuthStateChanged`. Ob prijavi pokliče backend
  **`GET /auth/me`** (prek `apiClient`, z Bearer tokenom) → `{ id, email, role, firebaseUid }`.
- Backend `role` (`ADMIN`/`INSTRUCTOR`/`PARTICIPANT`) se mapira v UI niz
  (`admin`/`instructor`/`participant`). `user.name` se izpelje iz emaila (backend ga ne vrača).
- `useRole()` vrne isti oblikovni API kot prej, zato `TopBar`, `SidebarNav`, dashboard
  ipd. delujejo brez sprememb.

### DEV-only role override

- Gated z **`import.meta.env.DEV && Boolean(VITE_DEV_ROLE_OVERRIDE)`**. Ker je
  `import.meta.env.DEV` v produkcijskem buildu statično `false`, Vite celotno funkcijo
  **dead-code-eliminira** — v produkciji je override **nemogoč**.
- Ko je omogočen: `setRole()` (TopBar "View as: …") in `login(role)` (login "Continue as …")
  nastavita previewano vlogo (persistirano v `localStorage` `projekt3.role`), ki ima
  prednost pred backend vlogo. Omogoča pregled vseh vlog z enim Firebase računom.
- V produkciji je `setRole()` **no-op**; vloga vedno izvira iz `/auth/me`.

> Opomba: ko ni `.env`/prijave, `role` privzeto pade na `instructor` in `user` na demo
> uporabnika — tako se ekrani še naprej izrišejo na mock (kot doslej). Pravo route-gating
> (redirect na `/login`, ADMIN-only poti) pride v naslednjem koraku.

## Status verifikacije

- ✅ `npm install` (dodan `firebase ^12.14.0`), brez `--legacy-peer-deps`.
- ✅ `npm run build` zelen; statičen `dist/` (firebase poveča glavni chunk → benigno
  >500 kB chunk-size opozorilo).
- ✅ `npm run dev` (:8080) → HTTP 200; `firebase.ts`/`apiClient.ts`/`role-context.tsx`/
  `login.tsx` se transformirajo brez napak.
- ⏳ **Polni login flow** (Firebase sign-in → `/auth/me` → vloga v navigaciji → logout →
  dev override switch) zahteva uporabnikov realni `.env` + delujoč backend; preveri
  uporabnik (glej sekcijo VERIFY v nalogi).

---

# F4 — izvedeno: route-level auth + role guards

Dodana je **route-level kontrola dostopa** nad realnim Firebase authom. Doslej je bil
gating le navigacijski (`NAV[role]`); zdaj URL-ji niso več dosegljivi ročno za napačno
vlogo. **Screen-data še vedno ni vezan na backend** — ekrani tečejo na mock.

## Arhitektura: auth nad routerjem

Da `beforeLoad` (teče pred renderjem komponente) lahko bere auth, je auth dvignjen
**nad** `RouterProvider`:

- `src/lib/role-context.tsx` → `useAuthController()` je **edini vir** auth stanja
  (Firebase + `/auth/me` + dev override + `isLoading`).
- `src/main.tsx` → `App` pokliče `useAuthController()` enkrat in vrednost poda:
  1. v **router context**: `<RouterProvider router={router} context={{ auth }} />`
     (za `beforeLoad` guarde),
  2. v **React context**: `<RoleContext.Provider value={auth}>` (za `useRole()` v drevesu).
- `src/router.tsx` → `RouterContext = { queryClient; auth }`; `__root.tsx` uporablja
  `createRootRouteWithContext<RouterContext>()`. (`RoleProvider` je odstranjen iz
  `__root`, ker je auth zdaj nad routerjem.)
- Ob spremembi autha (`isAuthenticated`/`role`) `App` pokliče `router.invalidate()`, da se
  guardi ponovno ovrednotijo brez polnega reloada.

## Loading state — brez /login flasha

`App` **gate-a render na `auth.isLoading`**: dokler `onAuthStateChanged` (+ `/auth/me`)
ni razrešen, prikaže nevtralen spinner. Šele nato se montira `RouterProvider`, zato guardi
vedno vidijo **razrešen** auth → ob refreshu globoke `/app/...` poti **ni** preusmeritve na
`/login` (ne za prijavljene, ne napačne vsebine). Guardi imajo tudi `if (auth.isLoading) return`
kot dodatno varovalo.

## Guardi (`src/lib/route-guards.ts`)

- `ensureAuthenticated({ auth, href })` → če ni prijavljen: `redirect("/login", { search: { redirect: href } })`
  (ohrani ciljno pot; `login.tsx` po prijavi pristane tam).
- `ensureRole({ auth, href }, roles)` → najprej auth, nato če `role` ni v `roles`:
  `redirect("/app/dashboard")` (dosegljiv vsem).
- V **dev** prevladuje override vloga → guardi gate-ajo po izbrani vlogi.

## Kje so guardi pripeti

| Pot(i) | Guard | Vloge |
| --- | --- | --- |
| `/app` (parent — pokriva cel podtree) | `ensureAuthenticated` | katerikoli prijavljen |
| `/app/dashboard`, `/app/`, `/app/my-assessments`, `/app/my-results` | (samo parent auth) | vse prijavljene vloge |
| `/app/users`, `/app/ai-models`, `/app/system-analytics` | `ensureRole` | **admin** |
| `/app/trainings` (+ `$id`), `/app/questions` (+ `$id`), `/app/assessments` (+ `new`, `$id`, `$id/results`, `$id/post-test`), `/app/results`, `/app/ai-insights` | `ensureRole` | **admin, instructor** |
| `/login` | redirect na `/app/dashboard` če že prijavljen | — |

> Reševalni tok `/assessment/$id/*` (access/solve/result) je **izven `/app`** in ostaja
> nepreusmerjen (QR-dostop), skladno z nalogo (participant ga doseže).

## Verifikacija

- ✅ `npm run build` zelen; statičen `dist/` (benigno >500 kB firebase chunk opozorilo).
- ✅ `npm run dev` (:8080) → vsi moduli (`route-guards`, `role-context`, `router`, `main`,
  guardane poti) se transformirajo brez napak; HTTP 200.
- ⏳ Vedenje guardov (redirecti po vlogah, brez flasha ob refreshu) teče **v brskalniku** —
  ročni koraki v sekciji VERIFY (zahteva realni `.env` + backend).

---

# F5 — izvedeno: data foundation + Trainings (referenčni vzorec)

Postavljen je temelj za pridobivanje podatkov, ki ga bo 3-članska ekipa uporabila, in
**dokazan** z vezavo **ene** domene (**Trainings**) na realni backend. Vse ostale domene
ostajajo na mocku.

## Dodano (skupna infrastruktura)

| Datoteka | Vloga |
| --- | --- |
| `src/types/{enums,models,index}.ts` | tipi 1:1 z backend odzivi + enumi + aliasi (`answer.textAnswer`, `attempt.participantId`) |
| `src/lib/query-keys.ts` | `qk` factory (hierarhični ključi po domenah) |
| `src/components/common/Spinner.tsx` | `LoadingState` / `ErrorState` (+ `Spinner`) |
| `src/lib/sanitize.ts` | `sanitizeQuestionForSolving()` — odstrani `answerOptions.isCorrect` (znan leak) |
| `src/lib/attempt-storage.ts` | klientska persistenca `attemptId` (ker ni GET seznama poskusov) — **TODO: backend list endpoint** |
| `src/services/trainings.ts` | referenčni service (list/get/create/update/remove) |
| `src/lib/training-view.ts` | prehoden most: realni Training → bogatejša display oblika (ostala polja nevtralna) |

## Trainings — vezava end-to-end

- `app.trainings.index.tsx`: `useQuery` seznam + **create** (`Dialog`) mutacija +
  loading/empty/error stanja.
- `app.trainings.$id.tsx`: `useQuery` detajl + **edit** (`Dialog`) + **delete** (`AlertDialog`,
  opozorilo na FK-500) + 204 handling; po brisu navigacija na seznam.
- Druge domene (topics, participants, assessments, analytics) na tej strani **ostajajo mock**
  (most + drugo-domenski mock importi), dokler niso vezane.

## Recept za ekipo

Kanonski postopek "mock → real" za vsako domeno je v **[SERVICES.md](./SERVICES.md)**
(seam, query keys, loading/empty/error, mutacije+invalidacija, 204/FK-500, per-role razlike),
s Trainings kot delujočim primerom.

## Status verifikacije

- ✅ `npm run build` zelen; statičen `dist/` (benigno >500 kB firebase chunk opozorilo).
- ✅ `npm run dev` (:8080) HTTP 200; vsi novi moduli se transformirajo brez napak.
- ✅ TS: nova koda tipsko čista (`tsc --noEmit` javi le **3 pred-obstoječe** hardcoded
  demo-link napake v `app.dashboard.tsx` in podedovani `Create post-test` link — niso del te naloge;
  build/runtime nemoteni).
- ⏳ Trainings CRUD proti realnemu API-ju + "ostale domene še na mocku" → ročni VERIFY
  (zahteva backend + `.env`).
