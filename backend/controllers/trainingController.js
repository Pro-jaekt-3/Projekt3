const prisma = require("../prisma/client");
const {
  USER_ROLES,
  TRAINING_ROLES,
  RESOURCE_TYPES,
  scopedListWhere,
} = require("../middleware/scopeMiddleware");
const { generateEnrollmentToken } = require("./userTrainingController");

const getTrainings = async (req, res) => {
  try {
    // Matrika vlog: ADMIN vidi vse (upravljanje članstev), INSTRUCTOR samo svoje.
    const where = scopedListWhere(req.user, RESOURCE_TYPES.TRAINING);

    if (where === null) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const trainings = await prisma.training.findMany({
      where,
      include: {
        _count: {
          select: {
            members: { where: { role: "PARTICIPANT" } },
          },
        },
      },
    });
    res.json(trainings);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const getTrainingById = async (req, res) => {
  const { id } = req.params;

  try {
    const training = await prisma.training.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!training) {
      return res.status(404).json({
        error: "Training not found",
      });
    }

    res.json(training);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const createTraining = async (req, res) => {
  try {
    const { title, description, ownerUserId } = req.body;

    // Validation
    if (!title || title.trim() === "") {
      return res.status(400).json({
        error: "Title is required and cannot be empty",
      });
    }

    // Lastništvo ob kreaciji (dvojni model, brief-dev1 §Nove datoteke):
    //   INSTRUCTOR ustvari -> sam postane lastnik (ownerUserId se ignorira);
    //   ADMIN ustvari -> opcijsko takoj podeli lastništvo izbranemu userju
    //   (brez ownerUserId je training dovoljeno vmesno stanje brez lastnika).
    let ownerId = null;

    if (req.user.role === USER_ROLES.INSTRUCTOR) {
      ownerId = req.user.id;
    } else if (ownerUserId !== undefined && ownerUserId !== null) {
      const owner = await prisma.user.findUnique({ where: { id: Number(ownerUserId) } });

      if (!owner) {
        return res.status(404).json({ error: "Owner user not found" });
      }

      ownerId = owner.id;
    }

    const training = await prisma.$transaction(async (tx) => {
      const created = await tx.training.create({
        data: {
          title: title.trim(),
          description: description ? description.trim() : null,
          enrollmentToken: generateEnrollmentToken(),
        },
      });

      if (ownerId !== null) {
        await tx.userTraining.create({
          data: {
            userId: ownerId,
            trainingId: created.id,
            role: TRAINING_ROLES.INSTRUCTOR,
          },
        });
      }

      return created;
    });

    res.status(201).json(training);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const updateTraining = async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  try {
    // Validation
    if (title !== undefined && (title === null || title.trim() === "")) {
      return res.status(400).json({
        error: "Title cannot be empty",
      });
    }

    // Check if training exists
    const existingTraining = await prisma.training.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!existingTraining) {
      return res.status(404).json({
        error: "Training not found",
      });
    }

    const training = await prisma.training.update({
      where: {
        id: Number(id),
      },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && {
          description: description ? description.trim() : null,
        }),
      },
    });

    res.json(training);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const deleteTraining = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if training exists
    const existingTraining = await prisma.training.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!existingTraining) {
      return res.status(404).json({
        error: "Training not found",
      });
    }

    await prisma.training.delete({
      where: {
        id: Number(id),
      },
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

module.exports = {
  getTrainings,
  getTrainingById,
  createTraining,
  updateTraining,
  deleteTraining,
};
