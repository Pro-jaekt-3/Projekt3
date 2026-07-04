-- backend/prisma/phase0/04_drop_lo_data.sql
-- =============================================================================
-- NAMEN: Izbrisi preostale LearningObjective vrstice (PODATKOVNO ciscenje).
--        Struktura tabele (in FK Question.learningObjectiveId) OSTANE do cutovera --
--        LearningObjective se na nivoju SHEME odstrani sele v poznejsem destruktivnem
--        cutoveru; TU brisemo le podatke, da je preostalo stanje cisto.
-- BASELINE: backups/phase0-20260704-1121.sql  (+ 01_purge.sql, + 02_backfill.sql, + 03_ownership.sql).
--   - 01_purge.sql je ze pobrisal LO na ne-ohranjenih temah (FK-varno pred brisanjem tem);
--     ta skripta pobrise se preostale LO (na ohranjenih temah).
--   - re-run na ciljnem stanju / ze prazni tabeli -> NO-OP (DELETE prizadene 0 vrstic).
-- FK: Question.learningObjectiveId -> LearningObjective je ON DELETE SET NULL, zato je
--     brisanje varno (referenca na vprasanju se sprosti na NULL).
-- Transakcijsko.
-- =============================================================================

START TRANSACTION;

DELETE FROM learningobjective;

COMMIT;
