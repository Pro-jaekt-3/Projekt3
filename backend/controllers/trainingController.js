const prisma = require("../prisma/client");

const getTrainings = async (req, res) => {
  try {
    const trainings = await prisma.training.findMany();
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
    const { title, description } = req.body;

    // Validation
    if (!title || title.trim() === "") {
      return res.status(400).json({
        error: "Title is required and cannot be empty",
      });
    }

    const training = await prisma.training.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
      },
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
