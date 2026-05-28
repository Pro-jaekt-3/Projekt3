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

  const findOrCreateQuestion = async ({
    title,
    description,
    difficulty,
    type,
    status,
    topicId,
    learningObjectiveId,
    createdById,
    reviewedById,
    reviewedAt,
    equivalentGroupId,
  }) => {
    const existingQuestion = await prisma.question.findFirst({
      where: {
        title,
      },
    });

    const data = {
      description,
      difficulty,
      type,
      status,
      topicId,
      learningObjectiveId,
      createdById,
      reviewedById,
      reviewedAt,
      equivalentGroupId,
    };

    if (existingQuestion) {
      return prisma.question.update({
        where: {
          id: existingQuestion.id,
        },
        data,
      });
    }

    return prisma.question.create({
      data: {
        title,
        ...data,
      },
    });
  };

  const upsertAnswerOptions = async (questionId, options) => {
    for (const option of options) {
      await prisma.answerOption.upsert({
        where: {
          questionId_orderIndex: {
            questionId,
            orderIndex: option.orderIndex,
          },
        },
        update: {
          text: option.text,
          isCorrect: option.isCorrect,
        },
        create: {
          questionId,
          text: option.text,
          isCorrect: option.isCorrect,
          orderIndex: option.orderIndex,
        },
      });
    }
  };

  const findOrCreateEquivalentQuestionGroup = async (
    name,
    description
  ) => {
    const existingGroup =
      await prisma.equivalentQuestionGroup.findFirst({
        where: {
          name,
        },
      });

    if (existingGroup) {
      return prisma.equivalentQuestionGroup.update({
        where: {
          id: existingGroup.id,
        },
        data: {
          description,
        },
      });
    }

    return prisma.equivalentQuestionGroup.create({
      data: {
        name,
        description,
      },
    });
  };

  // USERS
  const admin = await prisma.user.upsert({
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

  const instructor = await prisma.user.upsert({
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
  const reviewedAt = new Date("2026-05-28T00:00:00.000Z");

  const sqlSelectGroup = await findOrCreateEquivalentQuestionGroup(
    "SQL SELECT osnovne variante",
    "Primerljive variante vprasanj za preverjanje osnovnega razumevanja stavka SELECT."
  );

  await findOrCreateQuestion({
    title: "What is UML?",
    description: "Explain UML and its purpose.",
    difficulty: 2,
    type: "OPEN",
    status: "APPROVED",
    topicId: uml.id,
    learningObjectiveId: lo1.id,
    createdById: instructor.id,
    reviewedById: admin.id,
    reviewedAt,
  });

  await findOrCreateQuestion({
    title: "What is a class diagram?",
    description: "Describe UML class diagrams.",
    difficulty: 3,
    type: "OPEN",
    status: "APPROVED",
    topicId: uml.id,
    learningObjectiveId: lo1.id,
    createdById: instructor.id,
    reviewedById: admin.id,
    reviewedAt,
  });

  await findOrCreateQuestion({
    title: "SQL SELECT",
    description: "Write a SELECT query.",
    difficulty: 2,
    type: "CODE",
    status: "APPROVED",
    topicId: sql.id,
    learningObjectiveId: lo2.id,
    createdById: instructor.id,
    reviewedById: admin.id,
    reviewedAt,
    equivalentGroupId: sqlSelectGroup.id,
  });

  await findOrCreateQuestion({
    title: "Primary Key",
    description: "Explain primary keys in SQL.",
    difficulty: 1,
    type: "OPEN",
    status: "APPROVED",
    topicId: sql.id,
    learningObjectiveId: lo2.id,
    createdById: instructor.id,
    reviewedById: admin.id,
    reviewedAt,
  });

  await findOrCreateQuestion({
    title: "What is TCP/IP?",
    description: "Explain TCP/IP protocol.",
    difficulty: 3,
    type: "OPEN",
    status: "APPROVED",
    topicId: networking.id,
    createdById: instructor.id,
    reviewedById: admin.id,
    reviewedAt,
  });

  const sqlMultipleChoice = await findOrCreateQuestion({
    title: "Which SQL statement is used to read data from a table?",
    description: "Select the SQL statement used to read data from a table.",
    difficulty: 1,
    type: "MULTIPLE_CHOICE",
    status: "APPROVED",
    topicId: sql.id,
    learningObjectiveId: lo2.id,
    createdById: instructor.id,
    reviewedById: admin.id,
    reviewedAt,
    equivalentGroupId: sqlSelectGroup.id,
  });

  await upsertAnswerOptions(sqlMultipleChoice.id, [
    {
      text: "SELECT",
      isCorrect: true,
      orderIndex: 1,
    },
    {
      text: "INSERT",
      isCorrect: false,
      orderIndex: 2,
    },
    {
      text: "UPDATE",
      isCorrect: false,
      orderIndex: 3,
    },
    {
      text: "DELETE",
      isCorrect: false,
      orderIndex: 4,
    },
  ]);

  await findOrCreateQuestion({
    title: "SQL SELECT basic variant",
    description: "Write a query that returns all columns from a table named Students.",
    difficulty: 2,
    type: "CODE",
    status: "APPROVED",
    topicId: sql.id,
    learningObjectiveId: lo2.id,
    createdById: instructor.id,
    reviewedById: admin.id,
    reviewedAt,
    equivalentGroupId: sqlSelectGroup.id,
  });

  const umlMultipleChoice = await findOrCreateQuestion({
    title:
      "Which UML diagram is commonly used to show classes and their relationships?",
    description:
      "Select the UML diagram commonly used to show classes and their relationships.",
    difficulty: 2,
    type: "MULTIPLE_CHOICE",
    status: "APPROVED",
    topicId: uml.id,
    learningObjectiveId: lo1.id,
    createdById: instructor.id,
    reviewedById: admin.id,
    reviewedAt,
  });

  await upsertAnswerOptions(umlMultipleChoice.id, [
    {
      text: "Class diagram",
      isCorrect: true,
      orderIndex: 1,
    },
    {
      text: "Sequence diagram",
      isCorrect: false,
      orderIndex: 2,
    },
    {
      text: "Deployment diagram",
      isCorrect: false,
      orderIndex: 3,
    },
    {
      text: "Activity diagram",
      isCorrect: false,
      orderIndex: 4,
    },
  ]);

  console.log("Seed data inserted.");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
