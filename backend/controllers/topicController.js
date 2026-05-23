const prisma = require("../prisma/client");

const getTopics = async (req, res) => {
  try {
    const topics = await prisma.topic.findMany();

    res.json(topics);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const createTopic = async (req, res) => {
  try {
    const { name } = req.body;

    const topic = await prisma.topic.create({
      data: {
        name,
      },
    });

    res.status(201).json(topic);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const deleteTopic = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.topic.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      message: "Topic deleted",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

module.exports = {
  getTopics,
  createTopic,
  deleteTopic,
};