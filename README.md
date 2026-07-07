# PROJEKT3

PROJEKT3 je platforma za preverjanje znanja pri izobraževanju iz informatike in računalništva. Podpira lastništvo usposabljanj in vpisovanje, banke vprašanj, pripravo preverjanj, reševanje s strani udeležencev, ocenjevanje, analitiko ter izbirne funkcije z lokalnimi AI-modeli.

Repozitorij je razdeljen na dve aktivni aplikaciji:

- `frontend-next/` — SPA s TanStack Routerjem, React 19, TypeScript, Tailwind v4
- `backend/` — Express, Prisma, MySQL, Firebase Admin

Korenskega zaganjalnika ni. Frontend in backend namestite in zaganjajte ločeno.

## Kaj aplikacija trenutno omogoča

### Inštruktor

- Upravljanje usposabljanj, udeležencev, tem in žetonov za vpis
- Ustvarjanje in urejanje vprašanj
- Združevanje enakovrednih vprašanj v skupine
- Sestavljanje preverjanj in naknadnih testov (post-testov)
- Objava, arhiviranje in pregled preverjanj
- Ročno ocenjevanje odprtih in programerskih odgovorov
- Pregled rezultatov, napredka udeležencev, trendov, lestvice in analize vprašanj
- Uporaba osnutkov s pomočjo modelov, AI-pregleda in AI-vpogledov

### Udeleženec

- Pridružitev usposabljanjem
- Pregled razpoložljivih preverjanj
- Začetek in reševanje preverjanj
- Enkratna oddaja odgovorov
- Pregled lastnih rezultatov

### Administrator

- Upravljanje uporabnikov in vlog
- Ustvarjanje usposabljanj
- Upravljanje AI-modelov
- Dostop do analitike na ravni sistema

## Struktura repozitorija

```text
backend/         Express API, Prisma shema, kontrolerji, poti, testi
frontend-next/   Aktivni frontend SPA
lovable-reference/
migration_docs/
```

Ključna aktivna področja frontenda:

- `frontend-next/src/routes` — strani in varovala poti
- `frontend-next/src/services` — domenske API-storitve
- `frontend-next/src/lib` — avtentikacija, varovala poti, ključi poizvedb, pomožne funkcije
- `frontend-next/src/types` — skupni frontend modeli in enumeracije

Ključna aktivna področja backenda:

- `backend/routes` — registracija HTTP-poti
- `backend/controllers` — poslovna logika
- `backend/middleware` — avtentikacija, vloge ter omejevanje po lastništvu/vpisu
- `backend/prisma/schema.prisma` — aktivna shema baze podatkov
- `backend/__tests__` — testi API-ja, kontrolerjev in vmesne programske opreme

Dokumentacijska gradiva v mapi `docs/`:

- `docs/DIAGRAMS.md` — Mermaid ER, primeri uporabe, sekvenčni diagrami, življenjski cikli in diagram namestitve
- `docs/arhitekturni_projekt3.png` — izvožena slika arhitekture
- `docs/DPU_2.jpg` — izvožen diagram/slikovno gradivo

## Tehnologije

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

## Zahteve

- Priporočen Node.js 20+
- npm
- MySQL
- Firebase projekt za avtentikacijo
- Izbirno: Ollama za podporo lokalnim AI-modelom

## Nastavitev okolja

### Frontend

Kopirajte:

```bash
cp frontend-next/.env.example frontend-next/.env
```

Obvezne frontend okoljske spremenljivke:

- `VITE_API_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

Izbirna frontend spremenljivka:

- `VITE_DEV_ROLE_OVERRIDE`

`VITE_DEV_ROLE_OVERRIDE` omogoči predogled vloge na prijavni strani (samo za razvoj). Uporabite eno od vrednosti:

- `admin`
- `instructor`
- `participant`

### Backend

Kopirajte:

```bash
cp backend/.env.example backend/.env
```

Obvezne backend okoljske spremenljivke:

- `DATABASE_URL`
- Firebase Admin poverilnice, ki jih pričakuje nastavitev vmesne programske opreme v vaši lokalni datoteki `.env`

Okoljske spremenljivke, povezane z AI:

- `AI_DEFAULT_PROVIDER`
- `AI_DEFAULT_MODEL`
- `OLLAMA_BASE_URL`
- `OLLAMA_TIMEOUT_MS`

## Nastavitev baze podatkov

Aktivna Prisma shema je:

- `backend/prisma/schema.prisma`

Če lokalno bazo vzpostavljate od začetka, je praktičen postopek:

```bash
cd backend
npx prisma db push
node prisma/seed.js
```

Če delate z gradivi za migracijo/prehod, glejte:

- `backend/prisma/phase0/README.md`
- `migration_docs/`

## Namestitev

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

## Lokalni zagon

Najprej zaženite backend:

```bash
cd backend
npm run dev
```

API teče na:

- `http://localhost:3000`

Nato zaženite frontend:

```bash
cd frontend-next
npm run dev
```

Frontend teče na:

- `http://localhost:8080`

## Avtentikacija in vloge

Frontend uporablja Firebase avtentikacijo in nato pokliče:

- `GET /auth/me`

za pridobitev avtoritativne vloge iz backenda.

Varovala poti na frontendu so v:

- `frontend-next/src/lib/route-guards.ts`

Navigacija po vlogah v uporabniškem vmesniku je definirana v:

- `frontend-next/src/components/layout/SidebarNav.tsx`

Vloge v trenutnem sistemu:

- `ADMIN`
- `INSTRUCTOR`
- `PARTICIPANT`

## Domene backend API-ja

Registrirane vrhnje API-skupine:

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

## Diagrami in dokumentacija

Trenutna mapa z dokumentacijo je majhna, a koristna za orientacijo:

- [docs/DIAGRAMS.md](docs/DIAGRAMS.md)
  - Pregled entitetno-relacijskega modela
  - Pregled vlog in primerov uporabe
  - Sekvenčni diagram reševanja preverjanja
  - Življenjski cikel vprašanja
  - Topologija namestitve
- [arhitekturni_projekt3.png](docs/arhitekturni_projekt3.png)
- [DPU_2.jpg](docs/DPU_2.jpg)

`docs/DIAGRAMS.md` uporabljajte kot konceptualno referenco, ob razhajanjih pa kot avtoritativna vira upoštevajte živo kodo in konfiguracijo. Posebej velja:

- aktivna shema je `backend/prisma/schema.prisma`
- vrata in skripte za zagon izhajajo iz `frontend-next/package.json`, `backend/package.json` in okoljskih datotek
- del vsebine diagramov še vedno vključuje zastarele entitete FAZA-0 ali starejše primere nastavitev

## Opombe glede Ollame

Aplikacija podpira lokalne modele prek Ollame v vmesniku za upravljanje AI-modelov.

Pomembna praktična opomba:

- na nekaterih računalnikih se `http://localhost:11434` in `http://127.0.0.1:11434` ne razrešita v isto Ollama okolje

Če aplikacija javi, da model ni nameščen, čeprav ga `ollama list` prikazuje, preverite model z:

```bash
curl http://127.0.0.1:11434/api/tags
curl http://localhost:11434/api/tags
```

Po potrebi nastavite osnovni URL modela v vmesniku ali nastavite:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

v datoteki `backend/.env`.

## Testiranje

### Backend

```bash
cd backend
npm test
```

Obstoječi backend testi pokrivajo:

- kontrolerje
- vmesno programsko opremo za omejevanje dostopa
- integracijsko pokritost API-ja

### Frontend

```bash
cd frontend-next
npm test
```

Koristni ukazi za preverjanje:

```bash
cd frontend-next
npx tsc --noEmit
npm run build
```

## Znane omejitve

- Nekatera starejša besedila v aplikaciji še vedno omenjajo »prototip« ali »statične demo podatke«, čeprav so večji deli aplikacije že povezani z resničnimi storitvami.
- `docs/DIAGRAMS.md` je koristen, vendar so deli konceptualni in nekateri razdelki še vedno vključujejo zastarele entitete ali starejše primere nastavitev.
- Korenskega paketnega zaganjalnika ni; frontend in backend je treba upravljati ločeno.

## Vir resnice

Za trenutno implementacijo imajo živa koda in aktivna shema prednost pred starejšimi načrtovalnimi zapiski:

- frontend poti: `frontend-next/src/routes`
- frontend storitve: `frontend-next/src/services`
- backend poti/kontrolerji: `backend/routes`, `backend/controllers`
- aktivna shema: `backend/prisma/schema.prisma`
- okoljska in zagonska konfiguracija: `frontend-next/.env.example`, `backend/.env.example`, skripte paketov
