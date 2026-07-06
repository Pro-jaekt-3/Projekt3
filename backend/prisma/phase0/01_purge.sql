-- backend/prisma/phase0/01_purge.sql
-- =============================================================================
-- NAMEN: Idempotenten izbris ne-Firebase demo podatkov (FAZA 0), da je poseg
--        reproducibilen (ne le iz izpisa/backupa).
-- BASELINE: backups/phase0-20260704-1121.sql  (stanje PRED purge).
--   - zagnano na baseline  -> pocisti demo podatke,
--   - zagnano na ze-uveljavljenem (ciljnem) stanju -> NO-OP (0 sprememb), NE napaka.
-- IDEMPOTENTNOST: retencijski nabori so izracunani deklarativno (temp tabele);
--   DELETE prek anti-join (LEFT JOIN ... WHERE keep.id IS NULL) -> na ciljnem stanju 0 vrstic.
-- LOGIKA OHRANITVE:
--   (a) prezivi user(ji): firebaseUid IS NOT NULL, IN vse strukturno vezano nanje
--       (poskusi/odgovori/uporabljena+ustvarjena vprasanja -> teme -> treningi),
--   (b) VSI AiModel + AiInteraction (nedotaknjeno),
--   (c) userji pripeti z RESTRICT: Question.createdById, AiInteraction.requestedById,
--   (d) ADMIN userji (odlocitev: admin racun ostane).
-- SET NULL RAZRESITVE: brisanje vprasanj sprozi FK ON DELETE SET NULL na
--   AiInteraction.sourceQuestionId/generatedQuestionId (spodaj tudi eksplicitno, dokumentacijsko).
--   Question.reviewedById / AiInteraction.reviewedById sta prav tako SET NULL, a izbrisani
--   userji nimajo takih referenc (edini reviewerji so ohranjeni userji 1 in 4).
-- PREDPOSTAVKA: obstaja vsaj en prezivi user (firebaseUid IS NOT NULL). Ce ga ni, NE poganjaj
--   (anti-join bi brez keep-nabora izbrisal vse) -- na tem baseline je to user id=4 (jurij).
-- Transakcijsko.
-- =============================================================================

START TRANSACTION;

-- ---- retencijski nabori (session-scoped temp tabele) ----
DROP TEMPORARY TABLE IF EXISTS _keep_attempt;
DROP TEMPORARY TABLE IF EXISTS _keep_assessment;
DROP TEMPORARY TABLE IF EXISTS _keep_question;
DROP TEMPORARY TABLE IF EXISTS _keep_topic;
DROP TEMPORARY TABLE IF EXISTS _keep_training;
DROP TEMPORARY TABLE IF EXISTS _keep_eqg;
DROP TEMPORARY TABLE IF EXISTS _keep_user;

CREATE TEMPORARY TABLE _keep_attempt (id INT PRIMARY KEY);
INSERT INTO _keep_attempt
  SELECT a.id FROM assessmentattempt a
  JOIN `user` u ON a.userId = u.id
  WHERE u.firebaseUid IS NOT NULL;

CREATE TEMPORARY TABLE _keep_assessment (id INT PRIMARY KEY);
INSERT INTO _keep_assessment
  SELECT DISTINCT a.assessmentId FROM assessmentattempt a
  JOIN _keep_attempt k ON a.id = k.id;

CREATE TEMPORARY TABLE _keep_question (id INT PRIMARY KEY);
-- (a) vprasanja, ki jih je ustvaril prezivi user
INSERT IGNORE INTO _keep_question
  SELECT q.id FROM question q JOIN `user` u ON q.createdById = u.id
  WHERE u.firebaseUid IS NOT NULL;
-- (b) vprasanja v ohranjenih assessmentih (RESTRICT: AssessmentQuestion.questionId)
INSERT IGNORE INTO _keep_question
  SELECT DISTINCT aq.questionId FROM assessmentquestion aq
  JOIN _keep_assessment ka ON aq.assessmentId = ka.id;
-- (c) vprasanja iz odgovorov ohranjenih poskusov (RESTRICT: ParticipantAnswer.questionId)
INSERT IGNORE INTO _keep_question
  SELECT DISTINCT pa.questionId FROM participantanswer pa
  JOIN _keep_attempt kt ON pa.attemptId = kt.id;

CREATE TEMPORARY TABLE _keep_topic (id INT PRIMARY KEY);
INSERT INTO _keep_topic
  SELECT DISTINCT q.topicId FROM question q JOIN _keep_question kq ON q.id = kq.id;

CREATE TEMPORARY TABLE _keep_training (id INT PRIMARY KEY);
INSERT IGNORE INTO _keep_training
  SELECT DISTINCT t.trainingId FROM topic t JOIN _keep_topic kt ON t.id = kt.id;
INSERT IGNORE INTO _keep_training
  SELECT DISTINCT a.trainingId FROM assessment a JOIN _keep_assessment ka ON a.id = ka.id;

CREATE TEMPORARY TABLE _keep_eqg (id INT PRIMARY KEY);
INSERT INTO _keep_eqg
  SELECT DISTINCT q.equivalentGroupId FROM question q JOIN _keep_question kq ON q.id = kq.id
  WHERE q.equivalentGroupId IS NOT NULL;

CREATE TEMPORARY TABLE _keep_user (id INT PRIMARY KEY);
INSERT IGNORE INTO _keep_user SELECT id FROM `user` WHERE firebaseUid IS NOT NULL;                                   -- (a) prezivi
INSERT IGNORE INTO _keep_user SELECT DISTINCT q.createdById FROM question q JOIN _keep_question kq ON q.id = kq.id;  -- (c) RESTRICT createdBy
INSERT IGNORE INTO _keep_user SELECT DISTINCT requestedById FROM aiinteraction;                                      -- (c) RESTRICT requestedBy (vse AI ostane)
INSERT IGNORE INTO _keep_user SELECT id FROM `user` WHERE role = 'ADMIN';                                            -- (d) ohrani admin

-- ---- eksplicitna SET NULL razresitev (FK to naredi tudi samodejno ob DELETE; tu dokumentacijsko + varovalno) ----
UPDATE aiinteraction ai LEFT JOIN _keep_question kq ON ai.sourceQuestionId = kq.id
  SET ai.sourceQuestionId = NULL
  WHERE ai.sourceQuestionId IS NOT NULL AND kq.id IS NULL;
UPDATE aiinteraction ai LEFT JOIN _keep_question kq ON ai.generatedQuestionId = kq.id
  SET ai.generatedQuestionId = NULL
  WHERE ai.generatedQuestionId IS NOT NULL AND kq.id IS NULL;

-- ---- DELETE otroci -> starsi (FK-varni vrstni red) ----
DELETE pa FROM participantanswer   pa LEFT JOIN _keep_attempt    k ON pa.attemptId    = k.id WHERE k.id IS NULL;
DELETE a  FROM assessmentattempt   a  LEFT JOIN _keep_attempt    k ON a.id            = k.id WHERE k.id IS NULL;
DELETE aq FROM assessmentquestion  aq LEFT JOIN _keep_assessment k ON aq.assessmentId = k.id WHERE k.id IS NULL;
DELETE ao FROM answeroption        ao LEFT JOIN _keep_question   k ON ao.questionId   = k.id WHERE k.id IS NULL;
DELETE q  FROM question            q  LEFT JOIN _keep_question   k ON q.id            = k.id WHERE k.id IS NULL;
DELETE lo FROM learningobjective   lo LEFT JOIN _keep_topic      k ON lo.topicId      = k.id WHERE k.id IS NULL;
DELETE e  FROM equivalentquestiongroup e LEFT JOIN _keep_eqg     k ON e.id            = k.id WHERE k.id IS NULL;
DELETE t  FROM topic               t  LEFT JOIN _keep_topic      k ON t.id            = k.id WHERE k.id IS NULL;
DELETE a  FROM assessment          a  LEFT JOIN _keep_assessment k ON a.id            = k.id WHERE k.id IS NULL;
DELETE FROM assessmentblueprint;  -- ni vezan na prezivele; celotna tabela je demo (na ciljnem stanju ze prazna)
DELETE t  FROM training            t  LEFT JOIN _keep_training   k ON t.id            = k.id WHERE k.id IS NULL;
DELETE u  FROM `user`              u  LEFT JOIN _keep_user       k ON u.id            = k.id WHERE k.id IS NULL;

DROP TEMPORARY TABLE IF EXISTS _keep_attempt, _keep_assessment, _keep_question, _keep_topic, _keep_training, _keep_eqg, _keep_user;

COMMIT;
