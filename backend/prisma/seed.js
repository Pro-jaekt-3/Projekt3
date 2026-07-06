const { PrismaClient } = require("@prisma/client");
const {
  generateEnrollmentToken,
} = require("../controllers/userTrainingController");

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

  const findOrCreateQuestion = async ({
    title,
    description,
    difficulty,
    type,
    status,
    topicId,
    createdById,
    reviewedAt,
    equivalenceGroupId,
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
      createdById,
      reviewedAt,
      equivalenceGroupId,
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

  const findOrCreateEquivalenceGroup = async (
    title,
    description,
    trainingId
  ) => {
    const existingGroup = await prisma.equivalenceGroup.findFirst({
      where: { title, trainingId },
    });

    if (existingGroup) {
      return prisma.equivalenceGroup.update({
        where: { id: existingGroup.id },
        data: { description },
      });
    }

    return prisma.equivalenceGroup.create({
      data: { title, description, trainingId },
    });
  };

  // Vpis/lastništvo (UserTraining): idempotenten prek @@unique([userId, trainingId]).
  const upsertUserTraining = async (userId, trainingId, role) =>
    prisma.userTraining.upsert({
      where: {
        userId_trainingId: {
          userId,
          trainingId,
        },
      },
      update: {
        role,
      },
      create: {
        userId,
        trainingId,
        role,
      },
    });

  // enrollmentToken nastavi samo, če manjka — obstoječi token ostane, da je
  // seed ponovljiv (QR/link za enrollment se ob ponovnem seedu ne razveljavi).
  const ensureEnrollmentToken = async (training) => {
    if (training.enrollmentToken) {
      return training;
    }

    return prisma.training.update({
      where: { id: training.id },
      data: { enrollmentToken: generateEnrollmentToken() },
    });
  };

  const findOrCreateAssessment = async ({
    title,
    description,
    trainingId,
    type,
    status,
    timeLimitMinutes,
    pairedAssessmentId = null,
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
      pairedAssessmentId,
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

  const upsertAiModel = async ({
    provider,
    modelName,
    displayName,
    baseUrl,
    isLocal,
    isActive,
  }) =>
    prisma.aiModel.upsert({
      where: {
        provider_modelName: {
          provider,
          modelName,
        },
      },
      update: {
        displayName,
        baseUrl,
        isLocal,
        isActive,
      },
      create: {
        provider,
        modelName,
        displayName,
        baseUrl,
        isLocal,
        isActive,
      },
    });

  const findOrCreateAiInteraction = async ({
    aiModelId,
    requestedById,
    action,
    prompt,
    resultText,
    resultJson,
    sourceQuestionId,
    generatedQuestionId,
    reviewStatus,
    reviewedAt,
  }) => {
    const existingInteraction = await prisma.aiInteraction.findFirst({
      where: {
        aiModelId,
        requestedById,
        action,
        prompt,
      },
    });

    const data = {
      aiModelId,
      requestedById,
      action,
      prompt,
      resultText,
      resultJson,
      sourceQuestionId,
      generatedQuestionId,
      reviewStatus,
      reviewedAt,
    };

    if (existingInteraction) {
      return prisma.aiInteraction.update({
        where: {
          id: existingInteraction.id,
        },
        data,
      });
    }

    return prisma.aiInteraction.create({
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

  // Vsak seedan training dobi enrollmentToken (če ga še nima), da je enrollment
  // po tokenu (QR/link) testabilen takoj po seedu.
  training = await ensureEnrollmentToken(training);

  // USER-TRAINING (lastništvo + enrollment): brez teh vrstic instruktor po seedu
  // nima lastništva (prazni seznami/404 prek scopeMiddleware), participant pa ni
  // vpisan (POST /assessment-attempts/start -> 404 na requireEnrollment).
  await upsertUserTraining(instructor.id, training.id, "INSTRUCTOR");
  await upsertUserTraining(participant.id, training.id, "PARTICIPANT");

  // TOPICS
  const uml = await findOrCreateTopic("UML", training.id);

  const sql = await findOrCreateTopic("SQL", training.id);

  const networking = await findOrCreateTopic(
    "Networking",
    training.id
  );

  // QUESTIONS
  const reviewedAt = new Date("2026-05-28T00:00:00.000Z");

  const sqlSelectGroup = await findOrCreateEquivalenceGroup(
    "SQL SELECT osnovne variante",
    "Primerljive variante vprasanj za preverjanje osnovnega razumevanja stavka SELECT.",
    training.id
  );

  await findOrCreateQuestion({
    title: "What is UML?",
    description: "Explain UML and its purpose.",
    difficulty: 2,
    type: "OPEN",
    status: "APPROVED",
    topicId: uml.id,
    createdById: instructor.id,
    reviewedAt,
  });

  await findOrCreateQuestion({
    title: "What is a class diagram?",
    description: "Describe UML class diagrams.",
    difficulty: 3,
    type: "OPEN",
    status: "APPROVED",
    topicId: uml.id,
    createdById: instructor.id,
    reviewedAt,
  });

  const sqlSelectQuestion = await findOrCreateQuestion({
    title: "SQL SELECT",
    description: "Write a SELECT query.",
    difficulty: 2,
    type: "CODE",
    status: "APPROVED",
    topicId: sql.id,
    createdById: instructor.id,
    reviewedAt,
    equivalenceGroupId: sqlSelectGroup.id,
  });

  const primaryKeyQuestion = await findOrCreateQuestion({
    title: "Primary Key",
    description: "Explain primary keys in SQL.",
    difficulty: 1,
    type: "OPEN",
    status: "APPROVED",
    topicId: sql.id,
    createdById: instructor.id,
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
    reviewedAt,
  });

  const sqlMultipleChoice = await findOrCreateQuestion({
    title: "Which SQL statement is used to read data from a table?",
    description: "Select the SQL statement used to read data from a table.",
    difficulty: 1,
    type: "MULTIPLE_CHOICE",
    status: "APPROVED",
    topicId: sql.id,
    createdById: instructor.id,
    reviewedAt,
    equivalenceGroupId: sqlSelectGroup.id,
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
    createdById: instructor.id,
    reviewedAt,
    equivalenceGroupId: sqlSelectGroup.id,
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
    createdById: instructor.id,
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

  // AI MODELS AND INTERACTION TRACE EXAMPLES
  const ollamaModel = await upsertAiModel({
    provider: "OLLAMA",
    modelName: "gpt-oss:120b",
    displayName: "Ollama gpt-oss:120b",
    baseUrl: "http://localhost:11434",
    isLocal: true,
    isActive: true,
  });

  const openAiModel = await upsertAiModel({
    provider: "OPENAI",
    modelName: "gpt-4.1",
    displayName: "OpenAI GPT-4.1",
    baseUrl: null,
    isLocal: false,
    isActive: true,
  });

  const deepSeekModel = await upsertAiModel({
    provider: "DEEPSEEK",
    modelName: "deepseek-chat",
    displayName: "DeepSeek Chat",
    baseUrl: null,
    isLocal: false,
    isActive: true,
  });

  await findOrCreateAiInteraction({
    aiModelId: ollamaModel.id,
    requestedById: instructor.id,
    action: "GENERATE_QUESTION",
    prompt:
      "Demo AI trace: propose one draft SQL question about SELECT with expected answer guidance.",
    resultText: null,
    resultJson: {
      title: "SQL SELECT projection",
      description:
        "Write a query that returns the name and email columns from the Students table.",
      type: "CODE",
      difficulty: 2,
      suggestedStatus: "DRAFT",
      expectedAnswer: "SELECT name, email FROM Students;",
    },
    sourceQuestionId: null,
    generatedQuestionId: null,
    reviewStatus: "PENDING",
    reviewedAt: null,
  });

  await findOrCreateAiInteraction({
    aiModelId: openAiModel.id,
    requestedById: instructor.id,
    action: "CHECK_QUESTION_QUALITY",
    prompt:
      "Demo AI trace: review the quality of the approved SQL SELECT question for clarity and assessment fit.",
    resultText:
      "The question is clear for basic SQL recall, but the expected table structure should be stated before use in an assessment.",
    resultJson: {
      clarity: "good",
      difficultyFit: "appropriate",
      recommendation:
        "Keep as approved demo content; add schema context in future revisions.",
    },
    sourceQuestionId: sqlSelectQuestion.id,
    generatedQuestionId: null,
    reviewStatus: "ACCEPTED",
    reviewedAt: new Date("2026-05-30T10:00:00.000Z"),
  });

  await findOrCreateAiInteraction({
    aiModelId: deepSeekModel.id,
    requestedById: instructor.id,
    action: "GENERATE_EQUIVALENT_QUESTION",
    prompt:
      "Demo AI trace: propose an equivalent variant of the approved SQL SELECT question without creating a question record.",
    resultText: null,
    resultJson: {
      title: "SQL SELECT all rows",
      description:
        "Write a query that returns all rows and columns from a table named Courses.",
      type: "CODE",
      difficulty: 2,
      suggestedStatus: "NEEDS_REVIEW",
      equivalenceRationale:
        "The proposal checks the same basic SELECT syntax skill with a different table name.",
    },
    sourceQuestionId: sqlSelectQuestion.id,
    generatedQuestionId: null,
    reviewStatus: "PENDING",
    reviewedAt: null,
  });

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

  // PRE/POST PAIRING DEMO: POST_TEST istega traininga, POST.pairedAssessmentId=PRE.id
  // (konvencija iz schema-v2-NOTES). PUBLISHED + samo MC vprašanja, da lahko
  // participant takoj testira /start -> submit -> samodejni GRADED (PRE ima že
  // seedan poskus, zato je zaradi pravila en-poskus POST edini prosti /start).
  const demoPostAssessment = await findOrCreateAssessment({
    title: "Demo posttest - Osnove informatike",
    description: "Demo POST_TEST, paran na demo predtest za testiranje pairinga.",
    type: "POST_TEST",
    status: "PUBLISHED",
    timeLimitMinutes: 30,
    trainingId: training.id,
    pairedAssessmentId: demoAssessment.id,
  });

  const demoPostAssessmentQuestions = [
    {
      questionId: sqlMultipleChoice.id,
      orderIndex: 1,
      points: 1,
    },
    {
      questionId: umlMultipleChoice.id,
      orderIndex: 2,
      points: 1,
    },
  ];

  await prisma.assessmentQuestion.deleteMany({
    where: {
      assessmentId: demoPostAssessment.id,
    },
  });

  await prisma.assessmentQuestion.createMany({
    data: demoPostAssessmentQuestions
      .filter((question) => approvedQuestionIds.has(question.questionId))
      .map((question) => ({
        assessmentId: demoPostAssessment.id,
        questionId: question.questionId,
        orderIndex: question.orderIndex,
        points: question.points,
      })),
  });

  // VALIDACIJA MC OPCIJ: vsak seedan MULTIPLE_CHOICE mora imeti >=2 AnswerOption
  // in natanko eno isCorrect=true, sicer je za participanta nerešljiv (bug:
  // MC brez opcij v demo predtestu). Seed pade glasno, da delno seedano stanje
  // ne obvelja kot uspeh.
  const multipleChoiceQuestions = await prisma.question.findMany({
    where: { type: "MULTIPLE_CHOICE" },
    include: { answerOptions: true },
  });

  const invalidMultipleChoice = multipleChoiceQuestions.filter((question) => {
    const correctCount = question.answerOptions.filter(
      (option) => option.isCorrect
    ).length;
    return question.answerOptions.length < 2 || correctCount !== 1;
  });

  if (invalidMultipleChoice.length > 0) {
    const details = invalidMultipleChoice
      .map(
        (question) =>
          `id=${question.id} "${question.title}" (options=${question.answerOptions.length}, correct=${question.answerOptions.filter((option) => option.isCorrect).length})`
      )
      .join("; ");
    throw new Error(
      `Seed validation failed: MULTIPLE_CHOICE questions without valid answer options: ${details}`
    );
  }

  console.log("Seed data inserted.");
}

main()
  .catch((e) => {
    console.error(e);
    // Brez tega seed ob napaki konča z exit code 0 in delni seed (npr. MC brez
    // AnswerOption) navzven izgleda kot uspešen.
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
