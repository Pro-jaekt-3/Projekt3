-- backend/prisma/phase0/02_backfill.sql
-- =============================================================================
-- NAMEN: Minimalni backfill preživelega stanja (FAZA 0). Idempotenten, transakcijski.
-- BASELINE: backups/phase0-20260704-1121.sql  (+ predhodni 01_purge.sql).
--   - re-run na ciljnem stanju -> NO-OP (0 sprememb).
-- POKRIVA:
--   1) UserTraining(PARTICIPANT) iz preostalih poskusov (dedup po userId,trainingId),
--   2) EquivalenceGroup + equivalenceGroupId = kopija iz equivalentGroupId
--      (samo skupine z >=2 clani in enim samim trainingId),
--   3) enrollmentToken -- generiran SAMO kjer je NULL (re-run NE regenerira obstojecih),
--   in ciscenje praznih/singleton EquivalenceGroup.
-- IDEMPOTENTNOST:
--   - INSERT ... WHERE NOT EXISTS (UserTraining, EquivalenceGroup),
--   - UPDATE pogojni (question.equivalenceGroupId le kadar se se ne ujema),
--   - enrollmentToken le WHERE IS NULL.
-- OPOMBA: 03_ownership.sql kasneje jurijevo vlogo spremeni v INSTRUCTOR. Ta skripta uporablja
--   WHERE NOT EXISTS in NE prepise obstojece vloge -> re-run NE vrne INSTRUCTOR nazaj v PARTICIPANT.
-- OPOMBA: naravni kljuc idempotence za EquivalenceGroup je (trainingId, title=staro.name).
--   Na tem naboru so imena skupin unikatna znotraj treninga.
-- =============================================================================

START TRANSACTION;

-- 1) UserTraining(PARTICIPANT) iz preostalih poskusov (dedup po userId,trainingId)
INSERT INTO usertraining (userId, trainingId, role, enrolledAt)
SELECT DISTINCT a.userId, s.trainingId, 'PARTICIPANT', NOW(3)
FROM assessmentattempt a
JOIN assessment s ON a.assessmentId = s.id
WHERE a.userId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM usertraining ut
    WHERE ut.userId = a.userId AND ut.trainingId = s.trainingId
  );

-- 2a) EquivalenceGroup: ustvari za vsako staro EquivalentQuestionGroup z >=2 prezivelimi clani
--     in natanko enim trainingId. Naravni kljuc (trainingId, title) -> WHERE NOT EXISTS.
INSERT INTO equivalencegroup (trainingId, title, description, createdAt, updatedAt)
SELECT g.trainingId, g.name, g.description, NOW(3), NOW(3)
FROM (
  SELECT eqg.id, eqg.name, eqg.description,
         MIN(t.trainingId)          AS trainingId,
         COUNT(DISTINCT q.id)       AS members,
         COUNT(DISTINCT t.trainingId) AS trainings
  FROM equivalentquestiongroup eqg
  JOIN question q ON q.equivalentGroupId = eqg.id
  JOIN topic t    ON q.topicId = t.id
  GROUP BY eqg.id, eqg.name, eqg.description
  HAVING members >= 2 AND trainings = 1
) g
WHERE NOT EXISTS (
  SELECT 1 FROM equivalencegroup eg
  WHERE eg.trainingId = g.trainingId AND eg.title <=> g.name
);

-- 2b) kopiraj clanstvo: question.equivalenceGroupId = id ustrezne EquivalenceGroup
--     (samo vprasanja skupin, ki so dobile EquivalenceGroup -> >=2 clani).
UPDATE question q
JOIN topic t                    ON q.topicId = t.id
JOIN equivalentquestiongroup old ON old.id = q.equivalentGroupId
JOIN equivalencegroup eg        ON eg.trainingId = t.trainingId AND eg.title <=> old.name
SET q.equivalenceGroupId = eg.id
WHERE q.equivalentGroupId IS NOT NULL
  AND (q.equivalenceGroupId IS NULL OR q.equivalenceGroupId <> eg.id);

-- 2c) ciscenje: odstrani prazne/singleton EquivalenceGroup (<2 clana)
--     -> question.equivalenceGroupId se prek FK ON DELETE SET NULL sprosti. Na ciljnem stanju: 0.
DELETE eg FROM equivalencegroup eg
WHERE (SELECT COUNT(*) FROM question q WHERE q.equivalenceGroupId = eg.id) < 2;

-- 3) enrollmentToken: generiraj SAMO kjer je NULL (re-run NE regenerira obstojecih)
UPDATE training
SET enrollmentToken = CONCAT('trn_', LOWER(HEX(RANDOM_BYTES(18))))
WHERE enrollmentToken IS NULL;

COMMIT;
