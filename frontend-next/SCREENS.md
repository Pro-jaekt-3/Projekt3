# SCREENS — frontend-next

Pregled vseh ekranov/poti v `frontend-next/` (prototip iz Lovable exporta, **static
mock data**, brez backenda). Routing je **file-based** (TanStack Start) — vsaka datoteka
v `src/routes/*.tsx` je pot. Vstopna postavitev je `src/routes/__root.tsx`.

> **Vloge tukaj so demo (Role switcher):** `admin` / `instructor` / `participant`.
> V backendu/produkciji so to `ADMIN` / `INSTRUCTOR` / `PARTICIPANT` (glej
> [ARCHITECTURE.md](./ARCHITECTURE.md) — sekcija "Mapiranje na backend").
> Vidnost je trenutno **navigacijska** (sidebar `NAV[role]`), ne trdo zaklenjena —
> URL je dosegljiv ob ročnem vnosu. Pravo zaklepanje pride z auth/ProtectedRoute.

## Javni ekrani (brez prijave, brez AppShell)

| Pot | Datoteka | Opis | Glavne komponente |
| --- | --- | --- | --- |
| `/` | `routes/index.tsx` | Marketing landing (hero, feature kartice, mini dashboard preview) | `Button`, lucide ikone, lokalna `MiniStat`/`Feature` |
| `/login` | `routes/login.tsx` | Prijava + **prototip role switcher** ("Continue as Admin/Instructor/Participant"); demo Firebase/Google gumb (ni vezan) | `Input`, `Label`, `Button`, `Separator`, `useRole().login()` |

## Reševalni tok udeleženca (QR / public-ish, brez AppShell)

Ločeno od `/app/*` — namenjeno reševanju preko dostopa/QR.

| Pot | Datoteka | Opis |
| --- | --- | --- |
| `/assessment/$id/access` | `routes/assessment.$id.access.tsx` | Vstopni / access ekran preverjanja (pred reševanjem) |
| `/assessment/$id/solve` | `routes/assessment.$id.solve.tsx` | Reševanje preverjanja (vprašanja, odgovori) |
| `/assessment/$id/result` | `routes/assessment.$id.result.tsx` | Rezultat po oddaji |

## Aplikacijski ekrani (`/app/*`, znotraj `AppShell`)

`AppShell` = sidebar (`SidebarNav`, vsebina po vlogi) + `TopBar` (role switcher + user menu) + `<Outlet/>`.

| Pot | Datoteka | Vloge (vidno v navigaciji) | Opis |
| --- | --- | --- | --- |
| `/app` | `routes/app.tsx` | vse | Layout (AppShell + Outlet) |
| `/app/` | `routes/app.index.tsx` | vse | Redirect → `/app/dashboard` |
| `/app/dashboard` | `routes/app.dashboard.tsx` | vse (**3 različice**) | Role-aware: `AdminDashboard` / instructor (privzeti) / `ParticipantDashboard` |
| `/app/users` | `routes/app.users.tsx` | **admin** | Users & Roles — upravljanje uporabnikov |
| `/app/trainings` | `routes/app.trainings.index.tsx` | admin ("All Trainings"), instructor ("My Trainings") | Seznam izobraževanj |
| `/app/trainings/$id` | `routes/app.trainings.$id.tsx` | admin, instructor | Detajl izobraževanja (tematike, učni cilji, vprašanja, preverjanja) |
| `/app/questions` | `routes/app.questions.index.tsx` | **instructor** | Question Bank — banka vprašanj |
| `/app/questions/$id` | `routes/app.questions.$id.tsx` | instructor | Detajl/urejanje vprašanja |
| `/app/assessments` | `routes/app.assessments.index.tsx` | admin ("All Assessments"), instructor ("Assessments") | Seznam preverjanj |
| `/app/assessments/new` | `routes/app.assessments.new.tsx` | instructor | Ustvarjanje novega preverjanja (blueprint) |
| `/app/assessments/$id` | `routes/app.assessments.$id.tsx` | admin, instructor | Detajl preverjanja |
| `/app/assessments/$id/results` | `routes/app.assessments.$id.results.tsx` | admin, instructor | Rezultati preverjanja (analitika) |
| `/app/assessments/$id/post-test` | `routes/app.assessments.$id.post-test.tsx` | instructor | Post-test varianta / pre→post primerjava |
| `/app/results` | `routes/app.results.tsx` | **instructor** | Pregled rezultatov |
| `/app/ai-models` | `routes/app.ai-models.tsx` | **admin** | AI Models — upravljanje (Ollama) modelov |
| `/app/ai-insights` | `routes/app.ai-insights.tsx` | admin, instructor | AI Insights — **advisory only** predlogi |
| `/app/system-analytics` | `routes/app.system-analytics.tsx` | **admin** | Sistemska analitika |
| `/app/my-assessments` | `routes/app.my-assessments.tsx` | **participant** | Moja preverjanja (za reševanje) |
| `/app/my-results` | `routes/app.my-results.tsx` | **participant** | Moji rezultati |

## Navigacija po vlogi (sidebar)

Vir: `src/components/layout/SidebarNav.tsx` (`NAV: Record<Role, NavItem[]>`).

**admin:** Dashboard · Users & Roles · All Trainings · All Assessments · AI Models · AI Insights · System Analytics

**instructor:** Dashboard · My Trainings · Question Bank · Assessments · Results · AI Insights

**participant:** Dashboard · My Assessments · My Results

## Skupne / layout komponente

| Komponenta | Datoteka | Vloga |
| --- | --- | --- |
| `AppShell` | `components/layout/AppShell.tsx` | Sidebar + TopBar + main Outlet, mobilni `Sheet` |
| `SidebarNav` | `components/layout/SidebarNav.tsx` | Navigacija po vlogi + brand + "Prototype mode" |
| `TopBar` | `components/layout/TopBar.tsx` | **Role switcher** ("View as: …") + user menu (Profile/Log out) |
| `PageHeader` | `components/common/PageHeader.tsx` | Naslov strani + akcije |
| `MetricCard` | `components/common/MetricCard.tsx` | KPI kartica |
| `StatusBadge` | `components/common/StatusBadge.tsx` | Barvni status (assessment/question status) |
| `EmptyState` | `components/common/EmptyState.tsx` | Prazna stanja |
| `components/ui/*` | shadcn/ui (new-york) | ~50 primitivov (Button, Card, Dialog, Table, Tabs, Select, Chart …) |

Grafi/analitika uporabljajo `recharts` (npr. `components/ui/chart.tsx`).
