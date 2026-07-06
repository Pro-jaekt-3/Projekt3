-- backend/prisma/phase0/03_ownership.sql
-- =============================================================================
-- NAMEN: Dodeli lastnistvo treningov jurij-u (prezivi user, firebaseUid IS NOT NULL)
--        -> UserTraining.role = INSTRUCTOR na treningu 3 in 5.
--        UPDATE obstojecih vrstic (iz 02_backfill), NE INSERT, ker @@unique(userId,trainingId)
--        dovoli natanko eno vlogo na trening.
-- BASELINE: backups/phase0-20260704-1121.sql  (+ 01_purge.sql, + 02_backfill.sql).
--   - re-run na ciljnem stanju -> NO-OP (vloga je ze INSTRUCTOR).
-- IDEMPOTENTNOST: pogoj `role <> 'INSTRUCTOR'` -> na ciljnem stanju 0 posodobitev.
-- OPOMBA: treninga 3 ("predavanje varnost") in 5 ("Introduction to Databases") sta edina
--   ohranjena treninga in ju jurij dejansko uporablja; sta njegova (odlocitev lastnika).
-- Transakcijsko.
-- =============================================================================

START TRANSACTION;

UPDATE usertraining
SET role = 'INSTRUCTOR'
WHERE userId IN (SELECT id FROM `user` WHERE firebaseUid IS NOT NULL)
  AND trainingId IN (3, 5)
  AND role <> 'INSTRUCTOR';

COMMIT;
