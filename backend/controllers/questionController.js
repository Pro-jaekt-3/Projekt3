const prisma = require("../prisma/client");

const getQuestions = async (req, res) => {
  try {
    const questions = await prisma.question.findMany();

    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createQuestion = async (req, res) => {
  try {
    const { title, description, difficulty } = req.body;

    const question = await prisma.question.create({
      data: {
        title,
        description,
        difficulty,
      },
    });

    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteQuestion = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.question.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      message: "Question deleted",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Something went wrong",
    });
  }
};

module.exports = {
  getQuestions,
  createQuestion,
  deleteQuestion,
};