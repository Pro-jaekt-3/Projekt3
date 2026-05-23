const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // TOPICS
  const uml = await prisma.topic.create({
    data: {
      name: "UML",
    },
  });

  const sql = await prisma.topic.create({
    data: {
      name: "SQL",
    },
  });

  const networking = await prisma.topic.create({
    data: {
      name: "Networking",
    },
  });

  // LEARNING OBJECTIVES
  const lo1 = await prisma.learningObjective.create({
    data: {
      title: "Understand UML diagrams",
      description: "Student understands UML class diagrams.",
    },
  });

  const lo2 = await prisma.learningObjective.create({
    data: {
      title: "Write SQL queries",
      description: "Student can write basic SQL queries.",
    },
  });

  // QUESTIONS
  await prisma.question.createMany({
    data: [
      {
        title: "What is UML?",
        description: "Explain UML and its purpose.",
        difficulty: 2,
        type: "OPEN",
        topicId: uml.id,
        learningObjectiveId: lo1.id,
      },
      {
        title: "What is a class diagram?",
        description: "Describe UML class diagrams.",
        difficulty: 3,
        type: "OPEN",
        topicId: uml.id,
        learningObjectiveId: lo1.id,
      },
      {
        title: "SQL SELECT",
        description: "Write a SELECT query.",
        difficulty: 2,
        type: "CODE",
        topicId: sql.id,
        learningObjectiveId: lo2.id,
      },
      {
        title: "Primary Key",
        description: "Explain primary keys in SQL.",
        difficulty: 1,
        type: "OPEN",
        topicId: sql.id,
        learningObjectiveId: lo2.id,
      },
      {
        title: "What is TCP/IP?",
        description: "Explain TCP/IP protocol.",
        difficulty: 3,
        type: "OPEN",
        topicId: networking.id,
      },
    ],
  });

  console.log("Seed data inserted.");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });