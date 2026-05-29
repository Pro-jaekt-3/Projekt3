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

  const findOrCreateAssessment = async ({
    title,
    description,
    trainingId,
    type,
    status,
    timeLimitMinutes,
  }) => {
    const existingAssessment = await prisma.assessment.findFirst({
      where: {
        title,
        trainingId,
      },
    });

    const data = {
      description,
      trainingId,
      type,
      status,
      timeLimitMinutes,
    };

    if (existingAssessment) {
      return prisma.assessment.update({
        where: {
          id: existingAssessment.id,
        },
        data,
      });
    }

    return prisma.assessment.create({
      data: {
        title,
        ...data,
      },
    });
  };

  const findOrCreateAssessmentAttempt = async ({
    assessmentId,
    userId,
    startedAt,
    submittedAt,
    score,
    status,
  }) => {
    const existingAttempt = await prisma.assessmentAttempt.findFirst({
      where: {
        assessmentId,
        userId,
        startedAt,
      },
    });

    const data = {
      assessmentId,
      userId,
      startedAt,
      submittedAt,
      score,
      status,
    };

    if (existingAttempt) {
      return prisma.assessmentAttempt.update({
        where: {
          id: existingAttempt.id,
        },
        data,
      });
    }

    return prisma.assessmentAttempt.create({
      data,
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

  const participant = await prisma.user.upsert({
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

  const sqlSelectQuestion = await findOrCreateQuestion({
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

  const primaryKeyQuestion = await findOrCreateQuestion({
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

  const tcpIpQuestion = await findOrCreateQuestion({
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

  const demoAssessment = await findOrCreateAssessment({
    title: "Demo predtest - Osnove informatike",
    description: "Demo preverjanje za testiranje MVP modela preverjanj.",
    type: "PRE_TEST",
    status: "PUBLISHED",
    timeLimitMinutes: 30,
    trainingId: training.id,
  });

  const demoAssessmentQuestions = [
    {
      questionId: sqlSelectQuestion.id,
      orderIndex: 1,
      points: 2,
    },
    {
      questionId: primaryKeyQuestion.id,
      orderIndex: 2,
      points: 1,
    },
    {
      questionId: tcpIpQuestion.id,
      orderIndex: 3,
      points: 2,
    },
    {
      questionId: sqlMultipleChoice.id,
      orderIndex: 4,
      points: 1,
    },
    {
      questionId: umlMultipleChoice.id,
      orderIndex: 5,
      points: 1,
    },
  ];

  const approvedDemoQuestions = await prisma.question.findMany({
    where: {
      id: {
        in: demoAssessmentQuestions.map((question) => question.questionId),
      },
      status: "APPROVED",
    },
    select: {
      id: true,
    },
  });

  const approvedQuestionIds = new Set(
    approvedDemoQuestions.map((question) => question.id)
  );

  await prisma.assessmentQuestion.deleteMany({
    where: {
      assessmentId: demoAssessment.id,
    },
  });

  await prisma.assessmentQuestion.createMany({
    data: demoAssessmentQuestions
      .filter((question) => approvedQuestionIds.has(question.questionId))
      .map((question) => ({
        assessmentId: demoAssessment.id,
        questionId: question.questionId,
        orderIndex: question.orderIndex,
        points: question.points,
      })),
  });

  const sqlSelectedOption = await prisma.answerOption.findFirst({
    where: {
      questionId: sqlMultipleChoice.id,
      orderIndex: 1,
    },
  });

  const umlSelectedOption = await prisma.answerOption.findFirst({
    where: {
      questionId: umlMultipleChoice.id,
      orderIndex: 1,
    },
  });

  const demoAttemptAnswers = [
    {
      questionId: sqlSelectQuestion.id,
      answerText: "SELECT * FROM Students;",
      isCorrect: true,
      pointsAwarded: 2,
    },
    {
      questionId: primaryKeyQuestion.id,
      answerText: "A primary key uniquely identifies each row in a table.",
      isCorrect: true,
      pointsAwarded: 1,
    },
    {
      questionId: tcpIpQuestion.id,
      answerText: "TCP/IP is a set of network protocols used for communication between devices.",
      isCorrect: false,
      pointsAwarded: 0,
    },
    {
      questionId: sqlMultipleChoice.id,
      selectedOptionId: sqlSelectedOption?.id,
      isCorrect: true,
      pointsAwarded: 1,
    },
    {
      questionId: umlMultipleChoice.id,
      selectedOptionId: umlSelectedOption?.id,
      isCorrect: true,
      pointsAwarded: 1,
    },
  ];

  const seededAssessmentQuestionIds = new Set(
    (
      await prisma.assessmentQuestion.findMany({
        where: {
          assessmentId: demoAssessment.id,
        },
        select: {
          questionId: true,
        },
      })
    ).map((assessmentQuestion) => assessmentQuestion.questionId)
  );

  const validDemoAttemptAnswers = demoAttemptAnswers.filter((answer) =>
    seededAssessmentQuestionIds.has(answer.questionId)
  );

  const demoAttemptScore = validDemoAttemptAnswers.reduce(
    (total, answer) => total + (answer.pointsAwarded ?? 0),
    0
  );

  const demoAttempt = await findOrCreateAssessmentAttempt({
    assessmentId: demoAssessment.id,
    userId: participant.id,
    startedAt: new Date("2026-05-29T08:00:00.000Z"),
    submittedAt: new Date("2026-05-29T08:22:00.000Z"),
    score: demoAttemptScore,
    status: "GRADED",
  });

  await prisma.participantAnswer.deleteMany({
    where: {
      attemptId: demoAttempt.id,
    },
  });

  await prisma.participantAnswer.createMany({
    data: validDemoAttemptAnswers.map((answer) => ({
      attemptId: demoAttempt.id,
      questionId: answer.questionId,
      selectedOptionId: answer.selectedOptionId,
      answerText: answer.answerText,
      isCorrect: answer.isCorrect,
      pointsAwarded: answer.pointsAwarded,
    })),
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
