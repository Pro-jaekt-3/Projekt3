# Projekt3

AI-podprt sistem za generiranje, upravljanje in analizo vprašanj/testov za področje informatike.

## Hiter pregled

Projekt ima:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + Prisma
- **Bazo**: MySQL
- **Glavne entitete**: Trainings, Topics, LearningObjectives, Questions

## Struktura projekta

- `frontend/` – Vite React aplikacija
- `backend/` – Express REST API
- `backend/prisma/` – Prisma schema, migracije, seed

## Predpogoj

Namesti:
- Node.js
- npm
- MySQL

## Kloniranje repozitorija

```bash
git clone <repo-url>
cd Projekt3
```

## Backend setup

1. Odpri terminal v `backend/`:

```bash
cd backend
npm install
```

2. Ustvari datoteko `backend/.env`:

```env
DATABASE_URL="mysql://root:GESLO@localhost:3306/projekt3"
PORT=3000
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-firebase-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Required backend environment values:
- `DATABASE_URL` - MySQL connection string used by Prisma.
- `PORT` - backend port for local development.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` - Firebase Admin service account values used to verify Firebase ID tokens.

3. Ustvari bazo v MySQL, če še ne obstaja:

```sql
CREATE DATABASE projekt3;
```

4. Sinhroniziraj Prisma in po potrebi zaženi seed:

```bash
npx prisma migrate reset --force
```

Če želiš samo sinhronizirati shemo brez ponovnega ustvarjanja baze, uporabi:

```bash
npx prisma db push
```

5. Zaženi backend:

```bash
npm run dev
```

Backend bo na:

```txt
http://localhost:3000
```

## Backend AI configuration

The backend has centralized AI provider configuration in `backend/config/ai.js`
and exposes authenticated AI endpoints for instructor/admin use. Local demo
generation uses Ollama only.

Check local Ollama before the demo:

```bash
ollama list
curl http://localhost:11434/api/tags
```

Confirmed local demo models:
- `mistral-nemo:12b`
- `qwen3:8b`
- `llama3.1:8b`
- `gemma3n:e4b`
- `gpt-oss:20b`

Recommended backend environment values:

```env
AI_PROVIDER=OLLAMA
AI_DEFAULT_PROVIDER=OLLAMA
AI_DEFAULT_MODEL=qwen3:8b
OLLAMA_BASE_URL=http://localhost:11434
```

Alternative stronger/slower local model:

```env
AI_DEFAULT_MODEL=gpt-oss:20b
```

The matching `AiModel` row must exist and be active:

```txt
provider=OLLAMA
modelName=qwen3:8b
isActive=true
isLocal=true
```

Example backend environment values:

```env
AI_DEFAULT_PROVIDER=OLLAMA
AI_DEFAULT_MODEL=qwen3:8b
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=
OPENAI_BASE_URL=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=
```

If `AI_DEFAULT_MODEL` is not set, the backend uses the first active local
Ollama `AiModel` row from the database, then the first active `AiModel` row.
It will not generate with inactive models. If Ollama `/api/tags` is reachable,
the selected model must also be installed locally.

Useful AI endpoints:
- `GET /ai/models`
- `GET /ai/ollama/status`
- `POST /ai/models/:id/test`
- `POST /ai/question-draft`
- `POST /ai/equivalence-suggestion`

Hosted backends cannot access Ollama running on your PC unless Ollama is
hosted on the same server or exposed through a tunnel/VPS. AI suggestions are
advisory only and must be reviewed by an instructor before use.

## Frontend setup

1. Odpri terminal v `frontend/`:

```bash
cd frontend
npm install
```

2. Ustvari datoteko `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-firebase-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-firebase-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
```

Required frontend environment values:
- `VITE_API_URL` - backend API base URL, for example `http://localhost:3000`.
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` - Firebase web app configuration used by the existing Firebase login.

3. Zaženi frontend:

```bash
npm run dev
```

Frontend bo na:

```txt
http://localhost:5173
```

## Demo accounts and setup

Seed data creates these database users:
- `admin@example.com` - `ADMIN`
- `instructor@example.com` - `INSTRUCTOR`
- `participant@example.com` - `PARTICIPANT`

For demo login, create Firebase Authentication users with emails that match the seeded database users above. The backend links a Firebase user to an existing database user by email on first login.

If a Firebase user signs in with an email that does not exist in the database, the backend creates a new database user with role `PARTICIPANT`. That account can use participant pages, but instructor/admin pages will show access denied until the database role matches the requested access. Do not expect Google or email/password demo accounts to receive instructor/admin access unless their Firebase email matches a database user with the correct role.

Demo assessments should use `MULTIPLE_CHOICE` questions when automatic scoring is needed. `OPEN` and `CODE` answers are saved, but they are not automatically graded in the current MVP.

## API endpointi

### Trainings
- `GET /trainings`
- `GET /trainings/:id`
- `POST /trainings`
- `PUT /trainings/:id`
- `DELETE /trainings/:id`

### Topics
- `GET /topics`
- `GET /topics/:id`
- `POST /topics`
- `PUT /topics/:id`
- `DELETE /topics/:id`

### Learning Objectives
- `GET /learning-objectives`
- `GET /learning-objectives/:id`
- `GET /learning-objectives?topicId=<id>`
- `POST /learning-objectives`
- `PUT /learning-objectives/:id`
- `DELETE /learning-objectives/:id`

### Questions
- `GET /questions`
- `GET /questions/:id`
- `POST /questions`
- `PUT /questions/:id`
- `DELETE /questions/:id`

## Najpomembnejše funkcionalnosti

- `Topic` je povezan z `Training` preko `trainingId`
- `LearningObjective` je povezan s `Topic` preko `topicId`
- API preverja obstoj `trainingId` in `topicId` pri ustvarjanju in posodabljanju
- `/learning-objectives` omogoča filtriranje po `topicId`

## Hitri testi z curl

```bash
# Preveri, ali deluje backend
curl http://localhost:3000/

# Dobi vse trainings
curl http://localhost:3000/trainings

# Ustvari nov training
curl -X POST http://localhost:3000/trainings \
  -H "Content-Type: application/json" \
  -d '{"title":"Web Development","description":"Learn web dev"}'

# Ustvari nov topic za training
curl -X POST http://localhost:3000/topics \
  -H "Content-Type: application/json" \
  -d '{"name":"HTML Basics","trainingId":1}'

# Ustvari novo learning objective za topic
curl -X POST http://localhost:3000/learning-objectives \
  -H "Content-Type: application/json" \
  -d '{"title":"Understand tags","description":"Basics","topicId":1}'

# Filtriraj learning objectives po topicId
curl http://localhost:3000/learning-objectives?topicId=1
```

## Dodatne pripombe

- V `backend/.env` prilagodi MySQL geslo in uporabniško ime
- Če se ti pojavi napaka `table does not exist`, ponovno zaženi Prisma migracije ali `npx prisma db push`
- Za boljši vpogled v API lahko uporabiš VS Code REST Client ali Postman
