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
```

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

## Frontend setup

1. Odpri terminal v `frontend/`:

```bash
cd frontend
npm install
```

2. Ustvari datoteko `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
```

3. Zaženi frontend:

```bash
npm run dev
```

Frontend bo na:

```txt
http://localhost:5173
```

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
