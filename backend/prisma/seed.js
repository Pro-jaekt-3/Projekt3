const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
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
