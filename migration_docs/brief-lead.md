# BRIEF — LEAD / INTEGRACIJA

Vloga: lastnik skupnega temelja in zaporedja mergov. Ne kodiraš vseh treh vej — skrbiš,
da se ne zaletijo, in izvedeš faze, ki morajo biti centralne (additivna migracija, backfill,
deljene datoteke, destruktivni cutover).

## Naloži pred delom
`schema-v2.prisma`, `schema-v2-NOTES.md`, `pre-db-design.md`, `migration-plan.md`, ta brief.

## Zaklenjene odločitve (kontekst za vse veje)
- **Podatki:** demo baza je disponibilna — izbriši vse, kar ni vezano na Firebase prijavo
  (samo `User.firebaseUid != NULL` je "pravo"; danes 1/9 uporabnikov). Backfill se s tem
  poenostavi na "purge + minimalna ročna nastavitev".
- **by-LO analitika:** ukine se, nadomesti z by-topic.
- **Ekvivalenca:** backend jo PRVIČ dejansko uveljavi pri generaciji post-testa (ne le UI).
- **ADMIN:** samo user-management, AiModel-management, in dodeljevanje participantov na training.
  Izven celotnega instructor workflowa. INSTRUCTOR je scope-an na svoje treninge.
- **Lastništvo (dvojni model):** INSTRUCTOR si sam ustvari training → auto INSTRUCTOR-lastnik;
  ADMIN sme ustvariti training in podeliti/odvzeti lastništvo poljubnemu uporabniku. ADMIN je
  upravitelj treningov+članstev, ne posega pa v vsebino (topics/questions/assessments/AI/ocenjevanje).

## FAZA 0 — Skupni temelj (ti, PRED fan-outom)

1. **Additivna migracija (nič brisanj).** Uveljavi novo shemo tako, da se novo doda *ob* starem:
   nove tabele/stolpci (`UserTraining`, `TrainingRole`, `EquivalenceGroup`, `equivalenceGroupId`
   ob `equivalentGroupId`, `enrollmentToken`, `pairedAssessmentId`, `gradedById/At`, timestampi,
   TEXT širitve, novi indeksi). Star stolpci/tabele OSTANEJO za zdaj. Prek `prisma migrate dev`
   iz `schema-v2.prisma` — a v tej fazi še brez `@@unique([assessmentId,userId])`, NOT NULL,
   in brez `DROP`. (Praktično: pripravi vmesno "additive-only" različico sheme, ali ročno urejeno
   migracijo, da faza ostane nedestruktivna.)
2. **Regeneriraj Prisma klient.** Preveri, da obstoječa aplikacija še dela nespremenjeno.
3. **Purge podatkov (po tvoji odločitvi).** Varno pravilo, POTRDI natančen obseg pred `DELETE`:
   - Obdrži `User` z `firebaseUid != NULL` in vse, kar je vezano nanje (njihovi poskusi/odgovori/
     ustvarjeni viri, če jih hočeš ohraniti).
   - Izbriši seed uporabnike (`firebaseUid IS NULL`) in osirotele demo vrstice (skrivnostnih 12
     GRADED poskusov, seed treningi/vprašanja, ki jih nočeš). Pazi na FK RESTRICT vrstni red
     (najprej otroci: ParticipantAnswer → AssessmentAttempt → AssessmentQuestion → AnswerOption →
     Question → LearningObjective/EquivalentQuestionGroup → Topic → Assessment → Training).
   - **To je nepovraten poseg — pred izvedbo naredi dump.**
4. **Backfill preživelega (minimalno):**
   - `UserTraining(PARTICIPANT)` iz preostalih poskusov.
   - `UserTraining(INSTRUCTOR)` ročno za preživele prave uporabnike (nekaj vrstic).
   - `equivalenceGroupId` = kopija iz `equivalentGroupId` za preostala vprašanja; počisti prazne/
     singleton skupine. *(Cross-training preverba §5.3.2 je po purge večinoma mootna — zaženi le,
     če preživi kaka equivalence skupina.)*
   - `enrollmentToken` generiraj za preostale treninge.
5. **Objavi deljeni temelj:** potrdi Dev 2, da lahko objavi `types/models.ts` spremembe, in Dev 1,
   da lahko objavi scoping middleware — to sta dve "publish-first" odvisnosti za drugi dve veji.

## Med vejami (tvoja koordinacija)
- **Lastnik deljenih datotek:** `server.js` (vsi trije spreminjajo mount), `seed.js`. Zbiraj njihove
  spremembe ob integraciji, ne dovoli treh vzporednih editov istega fajla.
- **Publish-first pravilo:** Dev 2 (`types/models.ts`) in Dev 1 (scoping middleware + matrika vlog)
  objavita prva; Dev 3 (in ostala) rebase-ata nanju.

## FAZA 3 — Cutover (ti sekvenciraš)
Destruktivne spremembe morajo iti **v istem releasu kot pripadajoč frontend** (ni DTO plasti).
Vsaka veja pripravi svoj destruktivni del na branchu; ti jih zložiš v eno okno:
- `AssessmentAttempt.userId` → NOT NULL + RESTRICT + `@@unique([assessmentId,userId])`
  (dedup je po purge že urejen).
- DROP: `learningObjectiveId`/`LearningObjective`, `AssessmentBlueprint`, `equivalentGroupId` +
  stara `EquivalentQuestionGroup`, `Question.reviewedById`, `AiInteraction.reviewedById`.
- Mount preimenovanja v `server.js`.
Preveri, da so vsi trije frontend-follow-upi pripravljeni PRED tem oknom.

## Done-kriterij
Aplikacija dela na novi shemi; `prisma validate` čist; stara polja/tabele odstranjene; vse tri
veje zmergane; seed producira konsistentno v2 stanje.
