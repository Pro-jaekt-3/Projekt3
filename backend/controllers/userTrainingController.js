// =============================================================================
// userTrainingController.js — UserTraining CRUD (lastništvo + enrollment) in
// QR/token enrollment flow. Vsi handlerji predpostavljajo firebaseAuthMiddleware
// (req.user) in — kjer je navedeno — requireOwnership("training") pred sabo.
// =============================================================================

const crypto = require("crypto");
const prisma = require("../prisma/client");
const { USER_ROLES, TRAINING_ROLES } = require("../middleware/scopeMiddleware");

// Varen izbor User polj za odgovore (brez firebaseUid/externalAuthId).
const MEMBER_USER_SELECT = { id: true, email: true, name: true, role: true };

const membershipInclude = { user: { select: MEMBER_USER_SELECT } };

const generateEnrollmentToken = () => crypto.randomBytes(24).toString("base64url");

/**
 * GET /trainings/mine — treningi, kjer ima klicatelj katerokoli članstvo.
 * Za instructorja "moji treningi", za participanta "vpisani treningi".
 */
const getMyTrainings = async (req, res) => {
  try {
    const memberships = await prisma.userTraining.findMany({
      where: { userId: req.user.id },
      include: { training: true },
      orderBy: { enrolledAt: "desc" },
    });

    res.json(
      memberships.map((m) => ({
        id: m.id,
        trainingId: m.trainingId,
        role: m.role,
        enrolledAt: m.enrolledAt,
        training: m.training,
      })),
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /trainings/:id/members — članstva traininga (lastnik ali ADMIN).
 * Predpogoj: requireOwnership("training").
 */
const getTrainingMembers = async (req, res) => {
  try {
    const members = await prisma.userTraining.findMany({
      where: { trainingId: req.scopedTrainingId },
      include: membershipInclude,
      orderBy: [{ role: "asc" }, { enrolledAt: "asc" }],
    });

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /trainings/:id/members — dodaj članstvo.
 * Body: { userId } ALI { email }, role: "INSTRUCTOR" | "PARTICIPANT".
 * Predpogoj: requireOwnership("training") — torej klicatelj je ADMIN ali
 * INSTRUCTOR-lastnik tega traininga.
 *   - role=INSTRUCTOR: ADMIN podeli lastništvo komurkoli; lastnik lahko doda
 *     so-inštruktorja (co-teaching) na svoj training.
 *   - role=PARTICIPANT: ADMIN ali lastnik dodata udeleženca.
 */
const addTrainingMember = async (req, res) => {
  try {
    const { userId, email, role } = req.body || {};

    if (!role || !Object.values(TRAINING_ROLES).includes(role)) {
      return res.status(400).json({
        error: `role is required and must be one of: ${Object.values(TRAINING_ROLES).join(", ")}`,
      });
    }

    if (!userId && !email) {
      return res.status(400).json({ error: "Provide userId or email of the user to add" });
    }

    const user = userId
      ? await prisma.user.findUnique({ where: { id: Number(userId) } })
      : await prisma.user.findUnique({ where: { email: String(email).trim() } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const existing = await prisma.userTraining.findUnique({
      where: { userId_trainingId: { userId: user.id, trainingId: req.scopedTrainingId } },
    });

    if (existing) {
      return res.status(409).json({
        error: `User already has role ${existing.role} on this training`,
      });
    }

    const membership = await prisma.userTraining.create({
      data: {
        userId: user.id,
        trainingId: req.scopedTrainingId,
        role,
      },
      include: membershipInclude,
    });

    res.status(201).json(membership);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /trainings/:id/members/:userId — odstrani članstvo.
 * Predpogoj: requireOwnership("training").
 *   - PARTICIPANT članstvo: ADMIN ali lastnik.
 *   - INSTRUCTOR članstvo (odvzem lastništva): samo ADMIN.
 */
const removeTrainingMember = async (req, res) => {
  try {
    const memberUserId = Number(req.params.userId);

    if (!Number.isInteger(memberUserId) || memberUserId <= 0) {
      return res.status(404).json({ error: "Membership not found" });
    }

    const membership = await prisma.userTraining.findUnique({
      where: { userId_trainingId: { userId: memberUserId, trainingId: req.scopedTrainingId } },
    });

    if (!membership) {
      return res.status(404).json({ error: "Membership not found" });
    }

    if (membership.role === TRAINING_ROLES.INSTRUCTOR && req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({ error: "Only an admin can revoke instructor ownership" });
    }

    await prisma.userTraining.delete({ where: { id: membership.id } });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /trainings/:id/enroll — QR/token self-enrollment (app-invarianta #7).
 * Body: { enrollmentToken }. Katerikoli avtenticiran uporabnik; ob veljavnem
 * tokenu nastane UserTraining(PARTICIPANT). Neveljaven id/token => enoten 404
 * (ne razkrivamo obstoja traininga).
 */
const enrollWithToken = async (req, res) => {
  try {
    const trainingId = Number(req.params.id);
    const { enrollmentToken } = req.body || {};
    const invalid = () => res.status(404).json({ error: "Invalid enrollment link" });

    if (!Number.isInteger(trainingId) || trainingId <= 0 || !enrollmentToken) {
      return invalid();
    }

    const training = await prisma.training.findUnique({ where: { id: trainingId } });

    if (!training || !training.enrollmentToken || training.enrollmentToken !== enrollmentToken) {
      return invalid();
    }

    const existing = await prisma.userTraining.findUnique({
      where: { userId_trainingId: { userId: req.user.id, trainingId } },
      include: membershipInclude,
    });

    if (existing) {
      if (existing.role === TRAINING_ROLES.INSTRUCTOR) {
        return res.status(409).json({ error: "You are an instructor of this training" });
      }
      return res.json({ membership: existing, training, alreadyEnrolled: true });
    }

    const membership = await prisma.userTraining.create({
      data: { userId: req.user.id, trainingId, role: TRAINING_ROLES.PARTICIPANT },
      include: membershipInclude,
    });

    res.status(201).json({ membership, training, alreadyEnrolled: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /trainings/:id/regenerate-token — nov enrollmentToken (stari QR s tem
 * postane neveljaven). Predpogoj: requireOwnership("training") (lastnik/ADMIN).
 */
const regenerateEnrollmentToken = async (req, res) => {
  try {
    const training = await prisma.training.update({
      where: { id: req.scopedTrainingId },
      data: { enrollmentToken: generateEnrollmentToken() },
    });

    res.json({ id: training.id, enrollmentToken: training.enrollmentToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getMyTrainings,
  getTrainingMembers,
  addTrainingMember,
  removeTrainingMember,
  enrollWithToken,
  regenerateEnrollmentToken,
  generateEnrollmentToken,
};
