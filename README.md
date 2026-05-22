# Projekt3

# Projekt3

AI podprt sistem za generiranje, upravljanje in analizo vprašanj/testov za področje informatike.

## Tech Stack

### Frontend
- React
- TypeScript
- Vite

### Backend
- Node.js
- Express

### Database
- MySQL

### ORM
- Prisma

---

# Setup projekta

## 1. Kloniranje repozitorija

```bash
git clone <repo-url>
cd Projekt3
```

---

# Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend deluje na:

```txt
http://localhost:5173
```

---

# Backend setup

```bash
cd backend
npm install
npm run dev
```

Backend deluje na:

```txt
http://localhost:3000
```

---

# Database setup

## Potrebno:
- MySQL Server
- MySQL Workbench

Ustvari bazo:

```sql
CREATE DATABASE projekt3;
```

---

# Prisma setup

V backend `.env` datoteko dodaj:

```env
DATABASE_URL="mysql://root:GESLO@localhost:3306/projekt3"
```

---

# Prisma migracije

```bash
npx prisma migrate dev --name init
```

---

# Test API

GET vprašanja:

```txt
http://localhost:3000/questions
```

---

# Trenutno implementirano

- React frontend setup
- Express backend setup
- MySQL database
- Prisma ORM
- Question API
- GET questions
- POST questions

---

# Struktura projekta

```txt
Projekt3/
│
├── frontend/
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── prisma/
│   └── server.js
│
└── docs/
```