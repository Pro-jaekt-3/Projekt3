# FRONTEND-NOTES — backend obnašanje, ki vpliva na bodoči frontend

Posnetek dejanskega obnašanja backend API-ja (controllers + routes). Vsaka vrstica je
backend dejstvo + **kako vpliva na frontend**. Vir resnice je koda v `backend/`, ne ta dokument.

## Vidnost in vloge (assessments)

- `GET /assessments` vrne **vse statuse za ADMIN/INSTRUCTOR, a samo `PUBLISHED` za PARTICIPANT** (isti endpoint, drugačen nabor). → Frontend ne sme predpostaviti, da participant vidi DRAFT/ARCHIVED; isti klic vrača različno po vlogi.
- `GET /assessments/available` vedno vrne **samo `PUBLISHED`** in lažji payload (le `training`). → To uporabi za participantov "na voljo za reševanje" seznam, ne težkega `GET /assessments`.
- `GET /assessments/:id` vrne **403 "This assessment is not available."** participantu, če ni `PUBLISHED`. → Stran za reševanje mora ujeti 403 in preusmeriti/prikazati sporočilo.
- `GET /assessments/:id/results` je **ADMIN/INSTRUCTOR only** (participant dobi 403). → Rezultate preverjanja prikaži samo inštruktorju; participant ima svoj `/my-results/:attemptId`.
- `trainings`, `topics`, `learning-objectives`, `equivalent-question-groups`, `analytics`, `questions` so **vsi ADMIN/INSTRUCTOR only**. → Participant UI iz teh endpointov ne more graditi katalogov; ima dostop le do assessments + assessment-attempts.

## ⚠️ Razkritje pravilnih odgovorov

- `GET /assessments/:id` (in atempt include) vrača `answerOptions` **vključno z `isCorrect`** tudi participantu med reševanjem. → Frontend med reševanjem **ne sme** prikazati/uporabiti `isCorrect`; to je znan backend leak — pravilnih odgovorov ne izriši pred oddajo.

## Reševanje in ocenjevanje (attempts)

- `POST /assessment-attempts/start` zahteva, da je preverjanje `PUBLISHED`, sicer 403. → Gumb "Start" ponudi samo na published preverjanjih.
- Oddaja **avtomatsko oceni samo `MULTIPLE_CHOICE`**; `OPEN`/`CODE` se shranijo z `isCorrect=null`, `pointsAwarded=null`, `needsManualReview=true`. → Za ne-MCQ vprašanja prikaži "čaka ročni pregled", ne tretiraj rezultata kot dokončnega.
- `OPEN`/`CODE` štejejo v `maxScore`, a do ročne ocene prinesejo 0 točk. → Skupni odstotek je lahko videti nizek; jasno loči "samodejno ocenjeno" od "v pregledu".
- Oddaja je **enkratna**: ob submitu se vsi prejšnji odgovori izbrišejo in zapišejo na novo (`deleteMany`+`createMany`); ponovni submit vrne 400 "already submitted". → Ni delnega shranjevanja/auto-save endpointa; zgradi en končen submit, po oddaji onemogoči urejanje.
- `score` in `maxScore` se izračunata šele ob submitu (`maxScore` = vsota `points`). → Med `IN_PROGRESS` ni rezultata; odstotek računaj `score/maxScore` šele po oddaji.
- `GET /assessment-attempts/:id` vrne attempt **samo lastniku** (participant) ali kateremukoli inštruktorju/adminu; tujega participantovega = 403. → Prikaz lastnih rezultatov gradi na lastnem `attemptId`.
- **Ni endpointa za seznam mojih poskusov** — samo `GET /:id`. → `MyAssessmentsPage` mora `attemptId` hraniti na klientu (npr. iz odgovora `start`/`submit`); backend ga ne našteje.
- Odgovor serializira aliase: `answer.textAnswer` (= `answerText`) in `attempt.participantId` (= `userId`). → Frontend lahko bere te aliase; oba para sta enaka vrednost.

## Vprašanja (questions)

- `PATCH /questions/:id/status` dovoli samo `REVIEW | APPROVED | REJECTED | ARCHIVED` (ne `DRAFT`/`NEEDS_REVIEW`). → Status dropdown omeji na te štiri; ob `APPROVED`/`REJECTED` backend sam zapiše `reviewedBy`/`reviewedAt`.
- `createQuestion` **ne validira** `title`/`description`/`difficulty`/`topicId` (le MCQ opcije); manjkajoč `topicId` pade kot 500. → Obvezna polja validiraj na klientu, da se izogneš 500.
- MCQ zahteva ≥2 opciji in ≥1 pravilno; `options` poslan za ne-MCQ tip vrne 400. → Editor pošlji `options` samo za `MULTIPLE_CHOICE`.
- `GET /questions` vrne **vsa** vprašanja ne glede na status (brez filtra). → Filtriranje po statusu/tematiki naredi na frontendu (ali dodaj query param na backend).

## Sestavljanje in objava preverjanj

- V preverjanje gredo **samo `APPROVED`** vprašanja in **vsa morajo pripadati izbranemu trainingu** prek tematike, sicer 400. → Question picker filtriraj na APPROVED + isti training; podvojeni ID-ji niso dovoljeni.
- Novo preverjanje se ustvari vedno kot `DRAFT`; objava je ločen korak `PATCH /:id/status`. → Po kreaciji ponudi eksplicitni "Publish"; brez tega participant preverjanja ne vidi.
- Urejanje (`PUT /:id`) dovoljeno **samo dokler je `DRAFT` in brez `SUBMITTED` poskusov** (400 oz. 409). → Po objavi ali prvi oddaji onemogoči urejanje (gumbe skrij/disable).
- `PATCH /:id/status` **ne preverja prehodov** — PUBLISHED lahko vrneš v DRAFT/ARCHIVED. → Lahko ponudiš unpublish, a pazi: vrnitev v DRAFT ponovno odpre urejanje.
- `POST /assessments/generate`: `difficulty` sprejme `easy|medium|hard` ali `1|2|3`, dedupira po `equivalentGroup` (eno na skupino), 400 če ni dovolj approved vprašanj. → Prikaži sporočilo "samo N approved vprašanj ustreza filtrom" in dovoli oba zapisa težavnosti.

## Analitika

- Vse analytics štejejo **samo oddane poskuse** (`submittedAt != null`). → Dokler ni oddaj, pričakuj prazne sezname/ničle; predvidi empty-state.
- Pre/post primerjava temelji na `AssessmentType` `PRE_TEST`/`POST_TEST`; ruta je **`/analytics/pre-post-comparison`** (NE `/pre-post-series`), pari pre+post **po istem uporabniku** (zadnji poskus na uporabnika). → V parnih pogledih se pojavijo samo participanti, ki so opravili **oba** testa.
- Parni breakdowni (by-topic/objective/difficulty) računajo **1 točko na odgovor**, ne dejanskih `points`. → Ne prikazuj uteženih točk v teh pogledih; so pravilnostne stopnje, ne točkovne.
- `GET /analytics/questions?sort=worst&limit=N` in `/worst-questions?limit=N` obstajata. → Lahko gradiš "najtežja vprašanja" widget brez dodatne logike.

## Auth, oblika odgovorov, razno

- Vsak nov Firebase uporabnik se ob prvi prijavi **avtomatsko ustvari kot `PARTICIPANT`** (`firebaseAuthMiddleware`). → Nova prijava vedno pristane kot participant; instructor/admin dostop zahteva ročno spremembo vloge v bazi.
- `GET /auth/me` vrne `{ id, email, role, firebaseUid }` — **brez `name`**. → Imena uporabnika ne pričakuj iz `/auth/me`; če ga rabiš, dodaj na backend.
- AI endpointi vrnejo `{ suggestion, aiInteractionId, reviewStatus: "PENDING", ... }`; potrditev prek `PATCH /ai/interactions/:id/review`. → Vsak AI predlog prikaži z Accept/Reject; nikdar samodejno ne uveljavi (skladno z MVP AI pravili).
- AI napake so razločne: 501 (ne-Ollama provider), 502 (Ollama nedosegljiv), **500 (model neaktiven ali ni v bazi)**, 400 (manjkajoča vhodna polja). → Prikaži specifična sporočila namesto generičnega "AI error". (Popravek: "model neaktiven" je **500**, ne 400, kot je bilo prej zapisano.)
- ⚠️ **Endpointi, ki še NE obstajajo** (backend hardening track) — ne gradi proti njim brez backend dela: `/ai/models`, `/ai/ollama/status`, `/ai/pre-post-insights`, `GET /ai/interactions` (review queue list; obstaja le `PATCH /ai/interactions/:id/review`) in `/users` (admin user/role CRUD). `/ai` trenutno izpostavlja le `POST /question-draft`, `POST /equivalence-suggestion`, `PATCH /interactions/:id/review`.
- `DELETE /trainings/:id` vrne **204 brez telesa**, večina ostalih delete-ov vrne `{ message }` JSON. → Delete handlerji naj prenesejo 204 (prazno telo) brez `res.json()`.
- Brisanje trainingov/tematik z vezanimi zapisi pade kot **FK 500** (ni cascade). → Pred brisanjem opozori uporabnika; pričakuj 500 ob "v uporabi".
- Vse napake imajo obliko `{ error: string }`; `apiClient.ts` to že izvleče. → Drži se `apiJsonFetch`/`apiFetch`; sporočilo napake je v `error.message`.
- `server.js` ima `PORT` hardcodiran na **3000** (ignorira `process.env.PORT`). → Frontend `VITE_API_URL` naj cilja `http://localhost:3000` v lokalnem razvoju.
