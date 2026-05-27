const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const findOrCreateTopic = async (name, trainingId) => {
    const existingTopic = await prisma.topic.findFirst({
      where: {
        name,
        trainingId,
      },
    });

    if (existingTopic) {
      return existingTopic;
    }

    return prisma.topic.create({
      data: {
        name,
        trainingId,
      },
    });
  };

  const findOrCreateLearningObjective = async (
    title,
    description,
    topicId
  ) => {
    const existingLearningObjective =
      await prisma.learningObjective.findFirst({
        where: {
          title,
        },
      });

    if (existingLearningObjective) {
      return prisma.learningObjective.update({
        where: {
          id: existingLearningObjective.id,
        },
        data: {
          description,
          topicId,
        },
      });
    }

    return prisma.learningObjective.create({
      data: {
        title,
        description,
        topicId,
      },
    });
  };

  // USERS
  await prisma.user.upsert({
    where: {
      email: "admin@example.com",
    },
    update: {
      name: "Demo Admin",
      externalAuthId: "demo-admin-auth-id",
      role: "ADMIN",
    },
    create: {
      email: "admin@example.com",
      name: "Demo Admin",
      externalAuthId: "demo-admin-auth-id",
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: {
      email: "instructor@example.com",
    },
    update: {
      name: "Demo Instructor",
      externalAuthId: "demo-instructor-auth-id",
      role: "INSTRUCTOR",
    },
    create: {
      email: "instructor@example.com",
      name: "Demo Instructor",
      externalAuthId: "demo-instructor-auth-id",
      role: "INSTRUCTOR",
    },
  });

  await prisma.user.upsert({
    where: {
      email: "participant@example.com",
    },
    update: {
      name: "Demo Participant",
      externalAuthId: "demo-participant-auth-id",
      role: "PARTICIPANT",
    },
    create: {
      email: "participant@example.com",
      name: "Demo Participant",
      externalAuthId: "demo-participant-auth-id",
      role: "PARTICIPANT",
    },
  });

  // TRAININGS
  let training = await prisma.training.findFirst({
    where: {
      title: "Osnove informatike",
    },
  });

  if (!training) {
    training = await prisma.training.create({
      data: {
        title: "Osnove informatike",
        description: "Demo izobraževanje za MVP testne podatke",
      },
    });
  }

  // TOPICS
  const uml = await findOrCreateTopic("UML", training.id);

  const sql = await findOrCreateTopic("SQL", training.id);

  const networking = await findOrCreateTopic(
    "Networking",
    training.id
  );

  // LEARNING OBJECTIVES
  const lo1 = await findOrCreateLearningObjective(
    "Understand UML diagrams",
    "Student understands UML class diagrams.",
    uml.id
  );

  const lo2 = await findOrCreateLearningObjective(
    "Write SQL queries",
    "Student can write basic SQL queries.",
    sql.id
  );

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
