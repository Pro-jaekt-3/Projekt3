const prisma = require("../prisma/client");
const {
  RESOURCE_TYPES,
  scopedListWhere,
  isTrainingOwner,
} = require("../middleware/scopeMiddleware");

const getTopics = async (req, res) => {
  try {
    // Instructor vidi samo topice svojih treningov (app-invarianta #2).
    const where = scopedListWhere(req.user, RESOURCE_TYPES.TOPIC);

    if (where === null) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const topics = await prisma.topic.findMany({
      where,
      include: {
        training: true,
      },
    });

    res.json(topics);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const getTopic = async (req, res) => {
  try {
    const { id } = req.params;

    const topic = await prisma.topic.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        training: true,
      },
    });

    if (!topic) {
      return res.status(404).json({
        error: "Topic not found",
      });
    }

    res.json(topic);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const createTopic = async (req, res) => {
  try {
    const { name, trainingId } = req.body;

    // Validate name
    if (!name || name.trim() === "") {
      return res.status(400).json({
        error: "Topic name is required",
      });
    }

    // Validate trainingId
    if (!trainingId) {
      return res.status(400).json({
        error: "trainingId is required",
      });
    }

    // Check if training exists
    const training = await prisma.training.findUnique({
      where: {
        id: Number(trainingId),
      },
    });

    // 404 tudi za tuj training (ne razkrivaj obstoja — 404-namesto-403 konvencija).
    if (!training || !(await isTrainingOwner(req.user.id, training.id))) {
      return res.status(404).json({
        error: "Training not found",
      });
    }

    const topic = await prisma.topic.create({
      data: {
        name,
        trainingId: Number(trainingId),
      },
      include: {
        training: true,
      },
    });

    res.status(201).json(topic);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const updateTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, trainingId } = req.body;

    // Check if topic exists
    const topic = await prisma.topic.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!topic) {
      return res.status(404).json({
        error: "Topic not found",
      });
    }

    // If trainingId is provided, validate it (tudi lastništvo CILJNEGA traininga
    // — premik topica v tuj training mora vrniti 404, ne uspeti).
    if (trainingId) {
      const training = await prisma.training.findUnique({
        where: {
          id: Number(trainingId),
        },
      });

      if (!training || !(await isTrainingOwner(req.user.id, training.id))) {
        return res.status(404).json({
          error: "Training not found",
        });
      }
    }

    // Validate name if provided
    if (name !== undefined && name.trim() === "") {
      return res.status(400).json({
        error: "Topic name cannot be empty",
      });
    }

    const updatedTopic = await prisma.topic.update({
      where: {
        id: Number(id),
      },
      data: {
        ...(name && { name }),
        ...(trainingId && { trainingId: Number(trainingId) }),
      },
      include: {
        training: true,
      },
    });

    res.json(updatedTopic);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const deleteTopic = async (req, res) => {
  const { id } = req.params;

  try {
    const topic = await prisma.topic.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!topic) {
      return res.status(404).json({
        error: "Topic not found",
      });
    }

    await prisma.topic.delete({
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
  getTopics,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic,
};