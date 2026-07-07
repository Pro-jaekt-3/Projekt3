# FAZA 0 — reproducibilne data-skripte (purge + backfill + lastništvo + LO-brisanje)

Te skripte **reproducirajo podatkovno stanje FAZE 0**, ki je bilo uveljavljeno nad bazo `projekt3`
(dopolnjujejo additivno migracijo `../migrations/20260704112500_additive_v2_phase0/`). So **idempotentne**:
prvi zagon nad izhodiščnim stanjem izvede posege, vsak nadaljnji zagon nad že-uveljavljenim stanjem je
**NO-OP** (0 sprememb, brez napake, brez podvojitev).

> **Niso Prisma migracije.** So ločene, ročno pognane data-skripte. Sheme in migracij ne spreminjajo
> (drift ostane prazen). V produkciji jih poženeš enkrat; v repo so zato, da je poseg reproducibilen
> in ne le zabeležen v izpisu.

## Izhodiščno stanje / varnostna mreža

Izhodiščno stanje (stanje **pred** purge) je poln dump:

```
backups/phase0-20260704-1121.sql
```

Če želiš skripte preveriti od začetka, obnovi bazo iz tega dumpa, nato poženi additivno migracijo
(`npx prisma migrate deploy`) in nato skripte v spodnjem vrstnem redu.

## Vrstni red zagona (obvezen)

FK-odvisnosti in idempotentna varovala zahtevajo ta vrstni red:

| # | Datoteka | Kaj naredi |
|---|----------|-----------|
| 1 | `01_purge.sql` | izbris ne-Firebase demo podatkov (otroci→starši), ohrani preživele + AiModel/AiInteraction + admin |
| 2 | `02_backfill.sql` | UserTraining(PARTICIPANT) iz poskusov; EquivalenceGroup + `equivalenceGroupId`; `enrollmentToken` (le kjer NULL); čiščenje singletonov |
| 3 | `03_ownership.sql` | jurij (preživeli user) → `INSTRUCTOR` na treningu 3 in 5 |
| 4 | `04_drop_lo_data.sql` | izbris preostalih `LearningObjective` vrstic (struktura tabele ostane do cutovera) |

## Kako pognati

Iz mape `backend/` (uporablja `DATABASE_URL` iz `.env`):

```bash
npx prisma db execute --schema prisma/schema.prisma --file prisma/phase0/01_purge.sql
npx prisma db execute --schema prisma/schema.prisma --file prisma/phase0/02_backfill.sql
npx prisma db execute --schema prisma/schema.prisma --file prisma/phase0/03_ownership.sql
npx prisma db execute --schema prisma/schema.prisma --file prisma/phase0/04_drop_lo_data.sql
```

(Alternativno z mysql klientom: `mysql -uroot -p projekt3 < prisma/phase0/01_purge.sql`, itd.)

## Idempotentnost — kako je zagotovljena

- **01_purge**: retencijski nabori v `TEMPORARY` tabelah; DELETE prek anti-join
  (`LEFT JOIN _keep_* k ... WHERE k.id IS NULL`) → na ciljnem stanju ni ne-ohranjenih vrstic → 0 brisanj.
  SET NULL na `AiInteraction.source/generatedQuestionId` je pogojen (`IS NOT NULL AND keep IS NULL`).
- **02_backfill**: `INSERT ... WHERE NOT EXISTS` (UserTraining, EquivalenceGroup); pogojni `UPDATE`
  za `equivalenceGroupId`; `enrollmentToken` le `WHERE enrollmentToken IS NULL` (re-run ne regenerira).
- **03_ownership**: `UPDATE ... WHERE role <> 'INSTRUCTOR'` → na ciljnem stanju 0 vrstic.
- **04_drop_lo_data**: `DELETE FROM learningobjective` na prazni tabeli → 0 vrstic.

## Predpostavke

- Obstaja **vsaj en preživeli** user (`firebaseUid IS NOT NULL`) — v tem izhodiščnem stanju je to `id=4` (jurij).
  Če preživelega ni, `01_purge.sql` **ne poganjaj** (anti-join brez keep-nabora bi izbrisal vse).
- Odločitve, vgrajene v skripte: ohrani ADMIN userje; jurij je INSTRUCTOR treningov 3 in 5;
  `LearningObjective` se podatkovno izprazni (struktura pade šele v cutoveru).
