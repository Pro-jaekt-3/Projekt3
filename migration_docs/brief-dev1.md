# BRIEF — DEV 1: Lastništvo, dostop, enrollment, matrika vlog

Gradiš novo avtorizacijsko hrbtenico. Večina tvojih datotek je NOVIH → najmanj kolizij.
Dve tvoji stvari sta "publish-first" (scoping middleware + matrika vlog): objavi ju zgodaj,
ker Dev 2/3 nanju vežeta svoje endpointe.

## Naloži pred delom
`schema-v2.prisma`, `schema-v2-NOTES.md`, `pre-db-design.md`, `migration-plan.md`, ta brief.
Čakaj na Fazo 0 (additivna migracija + regeneriran klient) od vodje.

## Matrika vlog (NOVA — tvoj spec, objavi zgodaj)
Danes ADMIN+INSTRUCTOR delita skoraj vse (`pre-db-design.md` §4.3). Nova ločnica:
- **ADMIN (provisioning + admin, NE vsebinski instructor workflow):** upravljanje userjev
  (`/users`), upravljanje `AiModel` (`/ai` model mutacije), **kreacija treningov**, **podeljevanje/
  odvzem lastništva (INSTRUCTOR-članstva) nad treningi**, in **dodeljevanje participantov na
  katerikoli training**. NE sme v vsebino treninga: ne Topic/Question/Assessment CRUD, ne AI
  authoring, ne instructor analitika/ocenjevanje. (ADMIN je torej upravitelj treningov in članstev,
  ne content-collaborator.)
- **INSTRUCTOR (scope na svoje treninge prek `UserTraining(role=INSTRUCTOR)`):** poln CRUD nad
  Training/Topic/Question/Assessment SVOJIH treningov, AI authoring, analitika, ocenjevanje.
- **PARTICIPANT (scope prek `UserTraining(role=PARTICIPANT)`):** rešuje PUBLISHED assessmente
  vpisanih treningov, vidi svoje rezultate.

## Scoping middleware / helper (publish-first)
- `requireOwnership(resourceType)` — za INSTRUCTOR: dovoli le, če ima klicatelj
  `UserTraining(role=INSTRUCTOR)` za pripadajoči training (Training neposredno; Topic/Question/
  Assessment prek njihovega `trainingId`, Question prek `topic.trainingId`). **404 namesto 403**
  za tuj resource (ne razkrivaj obstoja).
- `requireEnrollment` — za `/start`: dovoli le, če `UserTraining(userId, assessment.trainingId,
  PARTICIPANT)` obstaja IN `assessment.status=PUBLISHED`. (Dev 3 to pokliče v attempt-controllerju.)
- List-scope helper — za sezname (`GET /trainings`, `/questions`, `/assessments`): INSTRUCTOR vidi
  samo svoje; ADMIN teh seznamov v instructor-pomenu ne dobi (ali dobi prazno/prepoved, po matriki).
- Objavi te helperje + konstante vlog kot skupni modul, da jih Dev 2/3 uvozita.

## Nove datoteke / endpointi (tvoji, večinoma novi)
- **`UserTraining` CRUD** (nov controller + routes):
  - **Ownership-grant (dvojni model):**
    - Instructor si **sam ustvari** training → auto `UserTraining(creator, training, INSTRUCTOR)`.
    - **ADMIN ustvari** training in **podeli lastništvo** poljubnemu uporabniku (postavi ga za
      INSTRUCTOR-lastnika); ADMIN sme lastništvo tudi odvzeti.
    - Torej pravico ustvariti `UserTraining(role=INSTRUCTOR)` imata: ADMIN (za kogarkoli/katerikoli
      training) in obstoječi INSTRUCTOR-lastnik istega traininga (co-teaching, lahko Faza 4).
  - Participant-enroll: instructor (svoj training) ali ADMIN (katerikoli) doda participanta.
  - List-by-training (instruktorji/udeleženci treninga).
- **QR / enrollment endpoint:**
  - `POST /trainings/:id/enroll` z `enrollmentToken` → ustvari `UserTraining(PARTICIPANT)` za
    klicatelja ob veljavnem tokenu.
  - `POST /trainings/:id/regenerate-token` (lastnik/ADMIN) → nov `enrollmentToken`.
- **Kreacija traininga (dovoljena INSTRUCTOR in ADMIN):**
  - INSTRUCTOR ustvari → auto `UserTraining(role=INSTRUCTOR)` zase (postane lastnik).
  - ADMIN ustvari → NE postane lastnik sam; ob kreaciji (ali takoj zatem) podeli lastništvo
    izbranemu INSTRUCTOR uporabniku. (Training brez lastnika je dovoljeno vmesno stanje, dokler
    ADMIN ne dodeli — ali pa zahtevaj dodelitev ob kreaciji; produktna drobnarija, izberi eno.)

## Frontend (tvoj)
- UserTraining admin/instructor UI: assign instructor (če dovoljeno), enrollment liste, QR-token
  prikaz + regeneracija, "moji treningi" scope.
- Participant enrollment flow (skeniranje/vnos tokena → vpis).

## App-invariante, ki jih uveljaviš (NOTES §5)
#1 (dostop do /start prek enrollment — helper), #2 (instructor scope — helper), #7 (QR token).

## Odvisnosti
- **Čakaš:** Fazo 0 (nova shema aktivna).
- **Objaviš prvi:** scoping middleware + matrika vlog (Dev 2/3 ju rabita za svoje route-guarde).

## Done-kriterij
INSTRUCTOR vidi/ureja samo svoje treninge (404 za tuje); ADMIN je omejen na user/AiModel/
participant-assign; participant dostopa le do vpisanih PUBLISHED assessmentov; QR vpis deluje;
scoping helper uvožen v Dev 2/3 controllerje.
