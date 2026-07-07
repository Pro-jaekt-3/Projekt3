# PROJEKT3

PROJEKT3 is an assessment platform for informatics and computer science education. It supports training ownership and enrollment, question banks, assessment authoring, participant solving, grading, analytics, and optional local-model features.

The repository is split into two active apps:

- `frontend-next/` — TanStack Router SPA, React 19, TypeScript, Tailwind v4
- `backend/` — Express, Prisma, MySQL, Firebase Admin

There is no root app runner. Install and run the frontend and backend separately.

## What The App Currently Does

### Instructor

- Manage trainings, participants, topics, and enrollment tokens
- Create and edit questions
- Group equivalent questions
- Build assessments and post-tests
- Publish, archive, and review assessments
- Grade open/code answers manually
- View results, participant progress, trends, leaderboard, and question analysis
- Use model-backed drafting, AI review, and AI insights

### Participant

- Join trainings
- View available assessments
- Start and solve assessments
- Submit answers once
- View personal results

### Admin

- Manage users and roles
- Provision trainings
- Manage AI models
- Access system-level analytics

## Repository Layout

```text
backend/         Express API, Prisma schema, controllers, routes, tests
frontend-next/   Active frontend SPA
lovable-reference/
migration_docs/
```

Key active frontend areas:

- `frontend-next/src/routes` — pages and route guards
- `frontend-next/src/services` — API domain services
- `frontend-next/src/lib` — auth, route guards, query keys, helpers
- `frontend-next/src/types` — shared frontend models and enums

Key active backend areas:

- `backend/routes` — HTTP route registration
- `backend/controllers` — business logic
- `backend/middleware` — auth, role, and ownership/enrollment scoping
- `backend/prisma/schema.prisma` — active database schema
- `backend/__tests__` — API/controller/middleware tests

Documentation assets in `docs/`:

- `docs/DIAGRAMS.md` — Mermaid ER, use-case, sequence, lifecycle, and deployment diagrams
- `docs/arhitekturni_projekt3.png` — exported architecture image
- `docs/DPU_2.jpg` — exported diagram/image asset

## Stack

### Frontend

- React 19
- TypeScript 5
- TanStack Router
- TanStack Query
- Vite 7
- Tailwind CSS v4
- Recharts
- Firebase Web SDK

### Backend

- Node.js
- Express 5
- Prisma 6
- MySQL
- Firebase Admin SDK

## Requirements

- Node.js 20+ recommended
- npm
- MySQL
- Firebase project for auth
- Optional: Ollama for local AI model support

## Environment Setup

### Frontend

Copy:

```bash
cp frontend-next/.env.example frontend-next/.env
```

Required frontend env values:

- `VITE_API_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

Optional frontend env:

- `VITE_DEV_ROLE_OVERRIDE`

`VITE_DEV_ROLE_OVERRIDE` enables a dev-only role preview on the login page. Use one of:

- `admin`
- `instructor`
- `participant`

### Backend

Copy:

```bash
cp backend/.env.example backend/.env
```

Required backend env values:

- `DATABASE_URL`
- Firebase Admin credentials expected by the middleware setup in your local `.env`

AI-related backend env values:

- `AI_DEFAULT_PROVIDER`
- `AI_DEFAULT_MODEL`
- `OLLAMA_BASE_URL`
- `OLLAMA_TIMEOUT_MS`

## Database Setup

The active Prisma schema is:

- `backend/prisma/schema.prisma`

If you are bootstrapping a local database from scratch, the practical flow is:

```bash
cd backend
npx prisma db push
node prisma/seed.js
```

If you are working with the migration/cutover materials, see:

- `backend/prisma/phase0/README.md`
- `migration_docs/`

## Install

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend-next
npm install
```

## Run Locally

Start the backend first:

```bash
cd backend
npm run dev
```

The API runs on:

- `http://localhost:3000`

Then start the frontend:

```bash
cd frontend-next
npm run dev
```

The frontend runs on:

- `http://localhost:8080`

## Authentication And Roles

The frontend uses Firebase authentication and then calls:

- `GET /auth/me`

to resolve the authoritative backend role.

Frontend route guards are handled in:

- `frontend-next/src/lib/route-guards.ts`

The UI role navigation is defined in:

- `frontend-next/src/components/layout/SidebarNav.tsx`

Role mapping in the current system:

- `ADMIN`
- `INSTRUCTOR`
- `PARTICIPANT`

## Backend API Domains

Registered top-level API groups:

- `/auth`
- `/users`
- `/trainings`
- `/topics`
- `/questions`
- `/equivalence-groups`
- `/assessments`
- `/assessment-attempts`
- `/analytics`
- `/ai`

## Diagrams And Docs

The current docs folder is small but useful for orientation:

- [docs/DIAGRAMS.md](/Users/gajkorosec/Library/CloudStorage/OneDrive-Personal/Namizje/Sola/FAKS/3L_IPT/2._Sem/Zakljucni_Projekt/Projekt3/docs/DIAGRAMS.md)
  - Entity-relationship overview
  - Role/use-case overview
  - Assessment solving sequence
  - Question lifecycle
  - Deployment topology
- [arhitekturni_projekt3.png](/Users/gajkorosec/Library/CloudStorage/OneDrive-Personal/Namizje/Sola/FAKS/3L_IPT/2._Sem/Zakljucni_Projekt/Projekt3/docs/arhitekturni_projekt3.png)
- [DPU_2.jpg](/Users/gajkorosec/Library/CloudStorage/OneDrive-Personal/Namizje/Sola/FAKS/3L_IPT/2._Sem/Zakljucni_Projekt/Projekt3/docs/DPU_2.jpg)

Use `docs/DIAGRAMS.md` as a conceptual reference, but treat the live code and config as authoritative when they differ. In particular:

- the active schema is `backend/prisma/schema.prisma`
- runtime ports and scripts come from `frontend-next/package.json`, `backend/package.json`, and the env files
- some diagram content still includes legacy FAZA-0 entities or older example runtime values

## Ollama Notes

The app supports local Ollama-backed models through the AI model management UI.

Important practical note:

- on some machines, `http://localhost:11434` and `http://127.0.0.1:11434` do not resolve to the same Ollama runtime

If the app says a model is not installed even though `ollama list` shows it, verify the model against:

```bash
curl http://127.0.0.1:11434/api/tags
curl http://localhost:11434/api/tags
```

If needed, set the model Base URL in the UI or set:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

in `backend/.env`.

## Testing

### Backend

```bash
cd backend
npm test
```

Existing backend tests include:

- controllers
- scope middleware
- integration API coverage

### Frontend

```bash
cd frontend-next
npm test
```

Useful validation commands:

```bash
cd frontend-next
npx tsc --noEmit
npm run build
```

## Current Known Caveats

- Some older in-app copy still says "prototype" or "static demo data" even though major parts of the app are now wired to real services.
- `docs/DIAGRAMS.md` is useful, but parts of it are conceptual and some sections still include legacy entities or older example runtime values.
- There is no root package runner; frontend and backend must be managed separately.

## Source Of Truth

For the current implementation, prefer the live code and active schema over older planning notes:

- frontend routes: `frontend-next/src/routes`
- frontend services: `frontend-next/src/services`
- backend routes/controllers: `backend/routes`, `backend/controllers`
- active schema: `backend/prisma/schema.prisma`
- env and runtime config: `frontend-next/.env.example`, `backend/.env.example`, package scripts
