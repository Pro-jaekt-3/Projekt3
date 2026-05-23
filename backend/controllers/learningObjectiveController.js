const prisma = require("../prisma/client");

const getLearningObjectives = async (req, res) => {
  try {
    const learningObjectives =
      await prisma.learningObjective.findMany();

    res.json(learningObjectives);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const createLearningObjective = async (req, res) => {
  try {
    const { title, description } = req.body;

    const learningObjective =
      await prisma.learningObjective.create({
        data: {
          title,
          description,
        },
      });

    res.status(201).json(learningObjective);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const deleteLearningObjective = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.learningObjective.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      message: "Learning objective deleted",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

module.exports = {
  getLearningObjectives,
  createLearningObjective,
  deleteLearningObjective,
};