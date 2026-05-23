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

## Frontend

V `frontend/` ustvari:

```txt
.env
```

Dodaj:

```env
VITE_API_URL=http://localhost:3000
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

# Ustvari `.env` datoteke

## Backend

V `backend/` ustvari:

```txt
.env
```

Dodaj:

```env
DATABASE_URL="mysql://root:GESLO@localhost:3306/projekt3"
PORT=3000
```

Če MySQL nima gesla:

```env
DATABASE_URL="mysql://root:@localhost:3306/projekt3"
PORT=3000
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
