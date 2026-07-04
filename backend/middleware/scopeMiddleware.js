// =============================================================================
// scopeMiddleware.js — DELJENI scoping modul (Dev 1; uvažata ga tudi Dev 2/3).
//
// Matrika vlog (glej migration_docs/brief-dev1.md):
//   ADMIN      — provisioning: userji, AiModel, kreacija treningov, članstva
//                (lastništvo + participanti). NE vsebina (Topic/Question/
//                Assessment CRUD, AI authoring, analitika, ocenjevanje).
//   INSTRUCTOR — poln CRUD nad vsebino SVOJIH treningov
//                (UserTraining role=INSTRUCTOR).
//   PARTICIPANT— rešuje PUBLISHED assessmente VPISANIH treningov
//                (UserTraining role=PARTICIPANT).
//
// Konvencija: tuj/neobstoječ resource vrne 404 (ne 403), da ne razkriva obstoja.
//
// Uporaba (route-level):
//   const { requireOwnership, requireEnrollment } = require("../middleware/scopeMiddleware");
//   router.get("/:id", firebaseAuthMiddleware, requireRole("ADMIN", "INSTRUCTOR"),
//     requireOwnership("training"), handler);
//   router.post("/start", firebaseAuthMiddleware, requireRole(...), requireEnrollment, handler);
//
// Uporaba (controller-level, čiste funkcije):
//   const { assertEnrollment, scopedListWhere, isTrainingOwner } = require("../middleware/scopeMiddleware");
//   const where = scopedListWhere(req.user, "question"); // null => 403
//   const enrollment = await assertEnrollment(req.user.id, assessmentId);
// =============================================================================

const prisma = require("../prisma/client");

// --- Konstante vlog (vir resnice: prisma/schema.prisma enumi) ----------------

const USER_ROLES = Object.freeze({
  ADMIN: "ADMIN",
  INSTRUCTOR: "INSTRUCTOR",
  PARTICIPANT: "PARTICIPANT",
});

const TRAINING_ROLES = Object.freeze({
  INSTRUCTOR: "INSTRUCTOR",
  PARTICIPANT: "PARTICIPANT",
});

// Resource tipi, ki jih requireOwnership/scopedListWhere razumeta.
const RESOURCE_TYPES = Object.freeze({
  TRAINING: "training",
  TOPIC: "topic",
  QUESTION: "question",
  ASSESSMENT: "assessment",
  EQUIVALENCE_GROUP: "equivalenceGroup",
});

const NOT_FOUND_LABEL = Object.freeze({
  training: "Training not found",
  topic: "Topic not found",
  question: "Question not found",
  assessment: "Assessment not found",
  equivalenceGroup: "Equivalence group not found",
});

// --- Čiste funkcije (za klic iz controllerjev — Dev 2/3) ---------------------

/**
 * Ali ima user UserTraining(role=INSTRUCTOR) za dani training?
 */
const isTrainingOwner = async (userId, trainingId) => {
  const membership = await prisma.userTraining.findUnique({
    where: {
      userId_trainingId: { userId: Number(userId), trainingId: Number(trainingId) },
    },
    select: { role: true },
  });

  return membership?.role === TRAINING_ROLES.INSTRUCTOR;
};

/**
 * Ali ima user UserTraining(role=PARTICIPANT) za dani training?
 */
const isTrainingParticipant = async (userId, trainingId) => {
  const membership = await prisma.userTraining.findUnique({
    where: {
      userId_trainingId: { userId: Number(userId), trainingId: Number(trainingId) },
    },
    select: { role: true },
  });

  return membership?.role === TRAINING_ROLES.PARTICIPANT;
};

/**
 * ID-ji treningov, kjer je user INSTRUCTOR-lastnik.
 */
const instructorTrainingIds = async (userId) => {
  const memberships = await prisma.userTraining.findMany({
    where: { userId: Number(userId), role: TRAINING_ROLES.INSTRUCTOR },
    select: { trainingId: true },
  });

  return memberships.map((m) => m.trainingId);
};

/**
 * Izpelji trainingId za resource (Training direktno; Topic/Assessment/
 * EquivalenceGroup prek trainingId; Question prek topic.trainingId).
 * Vrne null, če resource ne obstaja.
 */
const resolveTrainingId = async (resourceType, resourceId) => {
  const id = Number(resourceId);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  switch (resourceType) {
    case RESOURCE_TYPES.TRAINING: {
      const training = await prisma.training.findUnique({ where: { id }, select: { id: true } });
      return training ? training.id : null;
    }
    case RESOURCE_TYPES.TOPIC: {
      const topic = await prisma.topic.findUnique({ where: { id }, select: { trainingId: true } });
      return topic ? topic.trainingId : null;
    }
    case RESOURCE_TYPES.QUESTION: {
      const question = await prisma.question.findUnique({
        where: { id },
        select: { topic: { select: { trainingId: true } } },
      });
      return question ? question.topic.trainingId : null;
    }
    case RESOURCE_TYPES.ASSESSMENT: {
      const assessment = await prisma.assessment.findUnique({
        where: { id },
        select: { trainingId: true },
      });
      return assessment ? assessment.trainingId : null;
    }
    case RESOURCE_TYPES.EQUIVALENCE_GROUP: {
      const group = await prisma.equivalenceGroup.findUnique({
        where: { id },
        select: { trainingId: true },
      });
      return group ? group.trainingId : null;
    }
    default:
      throw new Error(`Unknown resource type for ownership scoping: ${resourceType}`);
  }
};

/**
 * Prisma `where` fragment za sezname po matriki vlog.
 *   - INSTRUCTOR: samo resource-i treningov, kjer je lastnik.
 *   - ADMIN: {} (vse) SAMO za "training"; za vsebino vrne null.
 *   - null pomeni: klicatelj teh seznamov ne sme videti (controller naj vrne 403
 *     ali prazen seznam — route naj bi to sicer preprečil z requireRole).
 */
const scopedListWhere = (user, resourceType) => {
  if (!user) {
    return null;
  }

  if (user.role === USER_ROLES.ADMIN) {
    return resourceType === RESOURCE_TYPES.TRAINING ? {} : null;
  }

  if (user.role !== USER_ROLES.INSTRUCTOR) {
    return null;
  }

  const membership = { some: { userId: user.id, role: TRAINING_ROLES.INSTRUCTOR } };

  switch (resourceType) {
    case RESOURCE_TYPES.TRAINING:
      return { members: membership };
    case RESOURCE_TYPES.TOPIC:
    case RESOURCE_TYPES.ASSESSMENT:
    case RESOURCE_TYPES.EQUIVALENCE_GROUP:
      return { training: { members: membership } };
    case RESOURCE_TYPES.QUESTION:
      return { topic: { training: { members: membership } } };
    default:
      throw new Error(`Unknown resource type for list scoping: ${resourceType}`);
  }
};

/**
 * App-invarianta #1 (NOTES §5): /start dovoljen samo, če assessment obstaja,
 * je PUBLISHED in ima klicatelj UserTraining(PARTICIPANT) za njegov training.
 * Vrne { ok: true, assessment } ali { ok: false, status, error }.
 * Vsi neuspehi so 404 (ne razkrivamo obstoja/statusa tujih assessmentov).
 */
const assertEnrollment = async (userId, assessmentId) => {
  const id = Number(assessmentId);
  const notFound = { ok: false, status: 404, error: NOT_FOUND_LABEL.assessment };

  if (!Number.isInteger(id) || id <= 0) {
    return notFound;
  }

  const assessment = await prisma.assessment.findUnique({ where: { id } });

  if (!assessment || assessment.status !== "PUBLISHED") {
    return notFound;
  }

  const enrolled = await isTrainingParticipant(userId, assessment.trainingId);

  if (!enrolled) {
    return notFound;
  }

  return { ok: true, assessment };
};

// --- Express middleware -------------------------------------------------------

/**
 * requireOwnership(resourceType, { param = "id", allowAdmin } = {})
 *
 * Guard za /:id route. Izpelje training resource-a in preveri
 * UserTraining(INSTRUCTOR) klicatelja. Tuj/neobstoječ resource => 404.
 *
 * ADMIN: privzeto dovoljen SAMO za resourceType="training" (upravljanje
 * treningov/članstev); za vsebinske tipe dobi 403 (matrika: ADMIN ni
 * content-collaborator). Override prek opts.allowAdmin.
 *
 * Ob uspehu nastavi req.scopedTrainingId (controller si prihrani ponovni lookup).
 */
const requireOwnership = (resourceType, opts = {}) => {
  if (!Object.values(RESOURCE_TYPES).includes(resourceType)) {
    throw new Error(`Unknown resource type for ownership scoping: ${resourceType}`);
  }

  const param = opts.param || "id";
  const allowAdmin =
    opts.allowAdmin !== undefined ? opts.allowAdmin : resourceType === RESOURCE_TYPES.TRAINING;

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const trainingId = await resolveTrainingId(resourceType, req.params[param]);

      if (trainingId === null) {
        return res.status(404).json({ error: NOT_FOUND_LABEL[resourceType] });
      }

      if (req.user.role === USER_ROLES.ADMIN) {
        if (allowAdmin) {
          req.scopedTrainingId = trainingId;
          return next();
        }
        return res.status(403).json({ error: "Forbidden" });
      }

      const owner = await isTrainingOwner(req.user.id, trainingId);

      if (!owner) {
        return res.status(404).json({ error: NOT_FOUND_LABEL[resourceType] });
      }

      req.scopedTrainingId = trainingId;
      return next();
    } catch (error) {
      console.error("requireOwnership failed:", error);
      return res.status(500).json({ error: "Something went wrong" });
    }
  };
};

/**
 * requireEnrollment — guard za POST /assessment-attempts/start.
 * Bere assessmentId iz req.body.assessmentId. Ob uspehu nastavi
 * req.enrolledAssessment (PUBLISHED assessment vrstica).
 */
const requireEnrollment = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const result = await assertEnrollment(req.user.id, req.body?.assessmentId);

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    req.enrolledAssessment = result.assessment;
    return next();
  } catch (error) {
    console.error("requireEnrollment failed:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

module.exports = {
  USER_ROLES,
  TRAINING_ROLES,
  RESOURCE_TYPES,
  isTrainingOwner,
  isTrainingParticipant,
  instructorTrainingIds,
  resolveTrainingId,
  scopedListWhere,
  assertEnrollment,
  requireOwnership,
  requireEnrollment,
};
