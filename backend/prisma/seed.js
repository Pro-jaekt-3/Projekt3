const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const OLLAMA_BASE_URL = "http://localhost:11434";
const REVIEWED_AT = new Date("2026-06-01T10:00:00.000Z");
const DEMO_STARTED_AT = new Date("2026-06-03T08:00:00.000Z");
const COMPLETED_STATUSES = ["SUBMITTED", "GRADED"];

async function upsertUser({ email, name, externalAuthId, role }) {
  return prisma.user.upsert({
    where: { email },
    update: { name, externalAuthId, role },
    create: { email, name, externalAuthId, role },
  });
}

async function upsertByFirst(model, where, data) {
  const existing = await prisma[model].findFirst({ where });

  if (existing) {
    return prisma[model].update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma[model].create({
    data: {
      ...where,
      ...data,
    },
  });
}

async function upsertTopic(name, trainingId) {
  return upsertByFirst("topic", { name, trainingId }, {});
}

async function upsertLearningObjective({ title, description, topicId }) {
  return upsertByFirst(
    "learningObjective",
    { title },
    { description, topicId }
  );
}

async function upsertEquivalentGroup({ name, description }) {
  return upsertByFirst("equivalentQuestionGroup", { name }, { description });
}

async function upsertQuestion({
  title,
  description,
  difficulty,
  topicId,
  learningObjectiveId,
  createdById,
  reviewedById,
  equivalentGroupId,
  answerOptions,
}) {
  const correctCount = answerOptions.filter((option) => option.isCorrect).length;

  if (answerOptions.length < 4 || correctCount !== 1) {
    throw new Error(`Question "${title}" must have 4+ options and exactly 1 correct option.`);
  }

  const question = await upsertByFirst(
    "question",
    { title },
    {
      description,
      difficulty,
      type: "MULTIPLE_CHOICE",
      status: "APPROVED",
      topicId,
      learningObjectiveId,
      createdById,
      reviewedById,
      reviewedAt: REVIEWED_AT,
      equivalentGroupId,
    }
  );

  for (const option of answerOptions) {
    await prisma.answerOption.upsert({
      where: {
        questionId_orderIndex: {
          questionId: question.id,
          orderIndex: option.orderIndex,
        },
      },
      update: {
        text: option.text,
        isCorrect: option.isCorrect,
      },
      create: {
        questionId: question.id,
        text: option.text,
        isCorrect: option.isCorrect,
        orderIndex: option.orderIndex,
      },
    });
  }

  return question;
}

async function upsertAiModel({
  modelName,
  displayName,
  isActive = true,
  isLocal = true,
}) {
  return prisma.aiModel.upsert({
    where: {
      provider_modelName: {
        provider: "OLLAMA",
        modelName,
      },
    },
    update: {
      displayName,
      baseUrl: OLLAMA_BASE_URL,
      isLocal,
      isActive,
    },
    create: {
      provider: "OLLAMA",
      modelName,
      displayName,
      baseUrl: OLLAMA_BASE_URL,
      isLocal,
      isActive,
    },
  });
}

async function upsertAssessmentQuestion({
  assessmentId,
  questionId,
  orderIndex,
  points,
}) {
  return prisma.assessmentQuestion.upsert({
    where: {
      assessmentId_questionId: {
        assessmentId,
        questionId,
      },
    },
    update: {
      orderIndex,
      points,
    },
    create: {
      assessmentId,
      questionId,
      orderIndex,
      points,
    },
  });
}

async function syncAssessmentQuestions(assessmentId, questions) {
  const questionIds = questions.map((question) => question.id);

  await prisma.assessmentQuestion.deleteMany({
    where: {
      assessmentId,
      questionId: {
        notIn: questionIds,
      },
    },
  });

  for (const [index, question] of questions.entries()) {
    await upsertAssessmentQuestion({
      assessmentId,
      questionId: question.id,
      orderIndex: index,
      points: 1,
    });
  }
}

async function getOptionByCorrectness(questionId, shouldBeCorrect) {
  const option = await prisma.answerOption.findFirst({
    where: {
      questionId,
      isCorrect: shouldBeCorrect,
    },
    orderBy: {
      orderIndex: "asc",
    },
  });

  if (!option) {
    throw new Error(`Missing ${shouldBeCorrect ? "correct" : "incorrect"} option for question ${questionId}.`);
  }

  return option;
}

async function upsertSolvedAttempt({
  assessmentId,
  userId,
  questions,
  correctCount,
  submittedAt,
}) {
  const attempts = await prisma.assessmentAttempt.findMany({
    where: {
      assessmentId,
      userId,
    },
    orderBy: {
      id: "asc",
    },
  });

  const existingAttempt = attempts[0];
  const duplicateAttemptIds = attempts.slice(1).map((attempt) => attempt.id);

  if (duplicateAttemptIds.length > 0) {
    await prisma.assessmentAttempt.deleteMany({
      where: {
        id: {
          in: duplicateAttemptIds,
        },
      },
    });
  }

  const attempt = existingAttempt
    ? await prisma.assessmentAttempt.update({
        where: { id: existingAttempt.id },
        data: {
          startedAt: DEMO_STARTED_AT,
          submittedAt,
          score: correctCount,
          maxScore: questions.length,
          status: "GRADED",
        },
      })
    : await prisma.assessmentAttempt.create({
        data: {
          assessmentId,
          userId,
          startedAt: DEMO_STARTED_AT,
          submittedAt,
          score: correctCount,
          maxScore: questions.length,
          status: "GRADED",
        },
      });

  for (const [index, question] of questions.entries()) {
    const isCorrect = index < correctCount;
    const selectedOption = await getOptionByCorrectness(question.id, isCorrect);

    await prisma.participantAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId: attempt.id,
          questionId: question.id,
        },
      },
      update: {
        selectedOptionId: selectedOption.id,
        answerText: null,
        isCorrect,
        pointsAwarded: isCorrect ? 1 : 0,
        needsManualReview: false,
      },
      create: {
        attemptId: attempt.id,
        questionId: question.id,
        selectedOptionId: selectedOption.id,
        answerText: null,
        isCorrect,
        pointsAwarded: isCorrect ? 1 : 0,
        needsManualReview: false,
      },
    });
  }

  await prisma.participantAnswer.deleteMany({
    where: {
      attemptId: attempt.id,
      questionId: {
        notIn: questions.map((question) => question.id),
      },
    },
  });

  return attempt;
}

function questionSpec({
  title,
  description,
  difficulty,
  topic,
  objective,
  group,
  correct,
  distractors,
}) {
  return {
    title,
    description,
    difficulty,
    topic,
    objective,
    group,
    answerOptions: [
      { orderIndex: 1, text: correct, isCorrect: true },
      ...distractors.map((text, index) => ({
        orderIndex: index + 2,
        text,
        isCorrect: false,
      })),
    ],
  };
}

async function main() {
  const admin = await upsertUser({
    email: "admin@example.com",
    name: "Demo Admin",
    externalAuthId: "demo-admin-auth-id",
    role: "ADMIN",
  });

  const instructor = await upsertUser({
    email: "instructor@example.com",
    name: "Demo Instructor",
    externalAuthId: "demo-instructor-auth-id",
    role: "INSTRUCTOR",
  });

  const participants = await Promise.all([
    upsertUser({
      email: "participant@example.com",
      name: "Demo Participant",
      externalAuthId: "demo-participant-auth-id",
      role: "PARTICIPANT",
    }),
    upsertUser({
      email: "ana.student@example.com",
      name: "Ana Student",
      externalAuthId: "demo-ana-student-auth-id",
      role: "PARTICIPANT",
    }),
    upsertUser({
      email: "marko.student@example.com",
      name: "Marko Student",
      externalAuthId: "demo-marko-student-auth-id",
      role: "PARTICIPANT",
    }),
    upsertUser({
      email: "sara.student@example.com",
      name: "Sara Student",
      externalAuthId: "demo-sara-student-auth-id",
      role: "PARTICIPANT",
    }),
    upsertUser({
      email: "luka.student@example.com",
      name: "Luka Student",
      externalAuthId: "demo-luka-student-auth-id",
      role: "PARTICIPANT",
    }),
    upsertUser({
      email: "nina.student@example.com",
      name: "Nina Student",
      externalAuthId: "demo-nina-student-auth-id",
      role: "PARTICIPANT",
    }),
  ]);

  await upsertAiModel({
    modelName: "qwen3:8b",
    displayName: "Qwen 3 8B Local - Recommended Default",
  });
  await upsertAiModel({
    modelName: "gpt-oss:20b",
    displayName: "GPT OSS 20B Local",
  });
  await upsertAiModel({
    modelName: "llama3.1:8b",
    displayName: "Llama 3.1 8B Local",
  });
  await upsertAiModel({
    modelName: "mistral-nemo:12b",
    displayName: "Mistral Nemo 12B Local",
  });
  await upsertAiModel({
    modelName: "gemma3n:e4b",
    displayName: "Gemma 3n E4B Local",
  });
  await upsertAiModel({
    modelName: "gpt-oss:120b",
    displayName: "GPT OSS 120B Local - Not Installed",
    isActive: false,
  });

  const training = await upsertByFirst(
    "training",
    { title: "Introduction to Databases" },
    {
      description:
        "Demo training for database fundamentals: SQL basics, joins, and normalization.",
    }
  );

  const sqlBasics = await upsertTopic("SQL Basics", training.id);
  const joins = await upsertTopic("Joins", training.id);
  const normalization = await upsertTopic("Normalization", training.id);

  const selectObjective = await upsertLearningObjective({
    title: "Write basic SELECT queries",
    description:
      "Use SELECT, FROM, WHERE, ORDER BY, and aggregate functions in simple queries.",
    topicId: sqlBasics.id,
  });
  const keysObjective = await upsertLearningObjective({
    title: "Explain primary and foreign keys",
    description:
      "Identify primary keys and foreign keys and explain how they preserve relationships.",
    topicId: sqlBasics.id,
  });
  const joinObjective = await upsertLearningObjective({
    title: "Use INNER JOIN correctly",
    description:
      "Combine related rows from two tables using matching key columns.",
    topicId: joins.id,
  });
  const normalizeObjective = await upsertLearningObjective({
    title: "Normalize a table to 3NF",
    description:
      "Recognize partial and transitive dependencies and restructure tables to third normal form.",
    topicId: normalization.id,
  });

  const context = {
    topics: {
      sqlBasics,
      joins,
      normalization,
    },
    objectives: {
      selectObjective,
      keysObjective,
      joinObjective,
      normalizeObjective,
    },
  };

  const groupNames = [
    ["select-columns", "SELECT column selection"],
    ["select-all", "SELECT all columns"],
    ["where-filter", "WHERE filtering"],
    ["primary-key", "Primary key purpose"],
    ["foreign-key", "Foreign key relationship"],
    ["join-keyword", "JOIN keyword"],
    ["inner-join", "INNER JOIN semantics"],
    ["join-condition", "Join condition"],
    ["normalization-purpose", "Normalization purpose"],
    ["third-normal-form", "Third normal form"],
    ["transitive-dependency", "Transitive dependency"],
    ["group-by", "GROUP BY aggregation"],
    ["order-by", "ORDER BY sorting"],
    ["referential-integrity", "Referential integrity"],
    ["partial-dependency", "Partial dependency"],
    ["many-to-many", "Many-to-many relationship"],
  ];

  const groups = {};
  for (const [key, name] of groupNames) {
    groups[key] = await upsertEquivalentGroup({
      name: `Database Fundamentals - ${name}`,
      description: `Comparable pre/post demo group for ${name}.`,
    });
  }

  const preSpecs = [
    questionSpec({
      title: "Pre-test: Which SQL clause lists returned columns?",
      description: "Choose the clause that defines which columns appear in a query result.",
      difficulty: 1,
      topic: context.topics.sqlBasics,
      objective: context.objectives.selectObjective,
      group: groups["select-columns"],
      correct: "SELECT",
      distractors: ["FROM", "WHERE", "GROUP BY"],
    }),
    questionSpec({
      title: "Pre-test: Which query returns every column from Students?",
      description: "Select the valid SQL statement returning all rows and all columns from Students.",
      difficulty: 1,
      topic: context.topics.sqlBasics,
      objective: context.objectives.selectObjective,
      group: groups["select-all"],
      correct: "SELECT * FROM Students;",
      distractors: ["GET * FROM Students;", "SELECT Students FROM *;", "FROM Students SELECT *;"],
    }),
    questionSpec({
      title: "Pre-test: What does a WHERE clause do?",
      description: "Choose the purpose of WHERE in a SELECT statement.",
      difficulty: 1,
      topic: context.topics.sqlBasics,
      objective: context.objectives.selectObjective,
      group: groups["where-filter"],
      correct: "Filters rows that meet a condition",
      distractors: ["Renames a table permanently", "Creates a database user", "Deletes duplicate columns"],
    }),
    questionSpec({
      title: "Pre-test: What is the role of a primary key?",
      description: "Choose the best description of a primary key in a relational table.",
      difficulty: 1,
      topic: context.topics.sqlBasics,
      objective: context.objectives.keysObjective,
      group: groups["primary-key"],
      correct: "It uniquely identifies each row in a table",
      distractors: ["It stores the longest text value", "It sorts every query by default", "It blocks SELECT queries"],
    }),
    questionSpec({
      title: "Pre-test: What does a foreign key reference?",
      description: "Choose what a foreign key normally points to in a relational database.",
      difficulty: 2,
      topic: context.topics.sqlBasics,
      objective: context.objectives.keysObjective,
      group: groups["foreign-key"],
      correct: "A candidate or primary key in another related table",
      distractors: ["The database server hostname", "A backup file", "The color of a table diagram"],
    }),
    questionSpec({
      title: "Pre-test: Which SQL keyword combines related rows from two tables?",
      description: "Choose the keyword commonly used with ON to combine rows from related tables.",
      difficulty: 2,
      topic: context.topics.joins,
      objective: context.objectives.joinObjective,
      group: groups["join-keyword"],
      correct: "JOIN",
      distractors: ["MERGEFILE", "CONNECTDB", "PACK"],
    }),
    questionSpec({
      title: "Pre-test: What does an INNER JOIN return?",
      description: "Choose the result produced by an INNER JOIN between two tables.",
      difficulty: 2,
      topic: context.topics.joins,
      objective: context.objectives.joinObjective,
      group: groups["inner-join"],
      correct: "Only rows where the join condition matches in both tables",
      distractors: ["Every row from both tables", "Only rows with no matching key", "A table with no columns"],
    }),
    questionSpec({
      title: "Pre-test: Which condition joins Orders to Customers by id?",
      description: "Orders has customer_id and Customers has id. Choose the correct join condition.",
      difficulty: 2,
      topic: context.topics.joins,
      objective: context.objectives.joinObjective,
      group: groups["join-condition"],
      correct: "Orders.customer_id = Customers.id",
      distractors: ["Orders.id = Customers.customer_id", "Orders.customer_id > Customers.id", "Orders.name = Customers.total"],
    }),
    questionSpec({
      title: "Pre-test: What problem does normalization primarily reduce?",
      description: "Choose the database design problem normalization is meant to reduce.",
      difficulty: 2,
      topic: context.topics.normalization,
      objective: context.objectives.normalizeObjective,
      group: groups["normalization-purpose"],
      correct: "Redundant data and update anomalies",
      distractors: ["The need for primary keys", "All network latency", "Every SQL syntax error"],
    }),
    questionSpec({
      title: "Pre-test: Which statement best describes third normal form?",
      description: "Choose the statement that best describes a table in third normal form.",
      difficulty: 3,
      topic: context.topics.normalization,
      objective: context.objectives.normalizeObjective,
      group: groups["third-normal-form"],
      correct: "Non-key attributes depend on the key, the whole key, and nothing but the key",
      distractors: ["Every table must contain exactly three columns", "Foreign keys are not allowed", "All text fields must be stored in one table"],
    }),
    questionSpec({
      title: "Pre-test: Which dependency creates a 3NF problem?",
      description: "In Course(id, instructor_id, instructor_name), instructor_name depends on instructor_id. Choose the issue.",
      difficulty: 3,
      topic: context.topics.normalization,
      objective: context.objectives.normalizeObjective,
      group: groups["transitive-dependency"],
      correct: "A transitive dependency",
      distractors: ["A valid primary key dependency", "A missing JOIN keyword", "A required ORDER BY clause"],
    }),
  ];

  const postSpecs = [
    questionSpec({
      title: "Post-test: Which clause chooses the output columns?",
      description: "Pick the SQL clause that controls which columns are shown in the result.",
      difficulty: 1,
      topic: context.topics.sqlBasics,
      objective: context.objectives.selectObjective,
      group: groups["select-columns"],
      correct: "SELECT",
      distractors: ["HAVING", "FROM", "ORDER BY"],
    }),
    questionSpec({
      title: "Post-test: Which statement reads all Product columns?",
      description: "Choose the valid SQL statement returning all columns from Products.",
      difficulty: 1,
      topic: context.topics.sqlBasics,
      objective: context.objectives.selectObjective,
      group: groups["select-all"],
      correct: "SELECT * FROM Products;",
      distractors: ["READ * FROM Products;", "SELECT Products FROM *;", "FROM Products GET *;"],
    }),
    questionSpec({
      title: "Post-test: Which clause filters employees with salary over 2000?",
      description: "Choose the clause that limits rows to employees matching a salary condition.",
      difficulty: 1,
      topic: context.topics.sqlBasics,
      objective: context.objectives.selectObjective,
      group: groups["where-filter"],
      correct: "WHERE salary > 2000",
      distractors: ["FROM salary > 2000", "SELECT salary > 2000", "TABLE salary > 2000"],
    }),
    questionSpec({
      title: "Post-test: Why should Customer.id be a primary key?",
      description: "Choose why Customer.id works as a primary key.",
      difficulty: 1,
      topic: context.topics.sqlBasics,
      objective: context.objectives.keysObjective,
      group: groups["primary-key"],
      correct: "It uniquely identifies each customer row",
      distractors: ["It stores every customer order", "It removes the need for joins", "It encrypts customer names"],
    }),
    questionSpec({
      title: "Post-test: What is the purpose of Orders.customer_id?",
      description: "Choose the purpose of a customer_id column in Orders.",
      difficulty: 2,
      topic: context.topics.sqlBasics,
      objective: context.objectives.keysObjective,
      group: groups["foreign-key"],
      correct: "It links each order to a customer row",
      distractors: ["It stores the customer's full address", "It sorts orders alphabetically", "It prevents indexes"],
    }),
    questionSpec({
      title: "Post-test: Which keyword joins Enrollments to Students?",
      description: "Choose the SQL keyword used to combine matching rows from Enrollments and Students.",
      difficulty: 2,
      topic: context.topics.joins,
      objective: context.objectives.joinObjective,
      group: groups["join-keyword"],
      correct: "JOIN",
      distractors: ["APPEND", "CHAIN", "ZIP"],
    }),
    questionSpec({
      title: "Post-test: What rows appear in an INNER JOIN result?",
      description: "Choose which rows are returned when an INNER JOIN condition is applied.",
      difficulty: 2,
      topic: context.topics.joins,
      objective: context.objectives.joinObjective,
      group: groups["inner-join"],
      correct: "Rows with matching values on both sides of the join",
      distractors: ["All rows from the left table only", "Rows that fail the ON condition", "Rows from neither table"],
    }),
    questionSpec({
      title: "Post-test: Which ON condition joins LineItems to Products?",
      description: "LineItems has product_id and Products has id. Choose the correct ON condition.",
      difficulty: 2,
      topic: context.topics.joins,
      objective: context.objectives.joinObjective,
      group: groups["join-condition"],
      correct: "LineItems.product_id = Products.id",
      distractors: ["LineItems.id = Products.product_id", "LineItems.product_id <> Products.id", "LineItems.quantity = Products.name"],
    }),
    questionSpec({
      title: "Post-test: What problem does normalization reduce?",
      description: "Choose the design problem normalization is meant to reduce.",
      difficulty: 2,
      topic: context.topics.normalization,
      objective: context.objectives.normalizeObjective,
      group: groups["normalization-purpose"],
      correct: "Redundant data and update anomalies",
      distractors: ["The need for primary keys", "All network latency", "Every SQL syntax error"],
    }),
    questionSpec({
      title: "Post-test: Which statement describes third normal form?",
      description: "Choose the statement that best describes a table in third normal form.",
      difficulty: 3,
      topic: context.topics.normalization,
      objective: context.objectives.normalizeObjective,
      group: groups["third-normal-form"],
      correct: "Non-key attributes depend on the key, the whole key, and nothing but the key",
      distractors: ["Every table has exactly three columns", "Foreign keys are forbidden", "All text fields live in one table"],
    }),
    questionSpec({
      title: "Post-test: Which dependency violates third normal form?",
      description: "In Student(id, department_id, department_name), department_name depends on department_id. Choose the issue.",
      difficulty: 3,
      topic: context.topics.normalization,
      objective: context.objectives.normalizeObjective,
      group: groups["transitive-dependency"],
      correct: "A transitive dependency",
      distractors: ["A valid primary key dependency", "A missing SELECT clause", "A natural join requirement"],
    }),
    questionSpec({
      title: "Post-test: Which clause groups rows for aggregate results?",
      description: "Choose the clause used before applying aggregate summaries by category.",
      difficulty: 2,
      topic: context.topics.sqlBasics,
      objective: context.objectives.selectObjective,
      group: groups["group-by"],
      correct: "GROUP BY",
      distractors: ["ORDER BY", "WHERE", "DISTINCT DATABASE"],
    }),
  ];

  const allSpecs = [...preSpecs, ...postSpecs];
  const questionsByTitle = {};

  for (const spec of allSpecs) {
    questionsByTitle[spec.title] = await upsertQuestion({
      title: spec.title,
      description: spec.description,
      difficulty: spec.difficulty,
      topicId: spec.topic.id,
      learningObjectiveId: spec.objective.id,
      createdById: instructor.id,
      reviewedById: admin.id,
      equivalentGroupId: spec.group.id,
      answerOptions: spec.answerOptions,
    });
  }

  const preAssessmentQuestionTitles = [
    "Pre-test: Which SQL clause lists returned columns?",
    "Pre-test: Which query returns every column from Students?",
    "Pre-test: What is the role of a primary key?",
    "Pre-test: What does a foreign key reference?",
    "Pre-test: What does an INNER JOIN return?",
    "Pre-test: Which condition joins Orders to Customers by id?",
    "Pre-test: What problem does normalization primarily reduce?",
    "Pre-test: Which statement best describes third normal form?",
  ];
  const postAssessmentQuestionTitles = [
    "Post-test: Which clause chooses the output columns?",
    "Post-test: Which statement reads all Product columns?",
    "Post-test: Why should Customer.id be a primary key?",
    "Post-test: What is the purpose of Orders.customer_id?",
    "Post-test: What rows appear in an INNER JOIN result?",
    "Post-test: Which ON condition joins LineItems to Products?",
    "Post-test: What problem does normalization reduce?",
    "Post-test: Which statement describes third normal form?",
  ];
  const preQuestions = preAssessmentQuestionTitles.map((title) => questionsByTitle[title]);
  const postQuestions = postAssessmentQuestionTitles.map((title) => questionsByTitle[title]);

  const preAssessment = await upsertByFirst(
    "assessment",
    {
      title: "Database Fundamentals Pre-test",
      trainingId: training.id,
    },
    {
      description:
        "Published demo pre-test covering SQL basics, joins, keys, and normalization.",
      type: "PRE_TEST",
      status: "PUBLISHED",
      timeLimitMinutes: 30,
    }
  );

  const postAssessment = await upsertByFirst(
    "assessment",
    {
      title: "Database Fundamentals Post-test",
      trainingId: training.id,
    },
    {
      description:
        "Published demo post-test with comparable questions for measuring progress.",
      type: "POST_TEST",
      status: "PUBLISHED",
      timeLimitMinutes: 30,
    }
  );

  await syncAssessmentQuestions(preAssessment.id, preQuestions);
  await syncAssessmentQuestions(postAssessment.id, postQuestions);

  const scorePlan = {
    "participant@example.com": { pre: 4, post: 6 },
    "ana.student@example.com": { pre: 3, post: 7 },
    "marko.student@example.com": { pre: 5, post: 6 },
    "sara.student@example.com": { pre: 2, post: 6 },
    "luka.student@example.com": { pre: 4, post: 5 },
    "nina.student@example.com": { pre: 6, post: 8 },
  };

  for (const participant of participants) {
    const plan = scorePlan[participant.email];

    await upsertSolvedAttempt({
      assessmentId: preAssessment.id,
      userId: participant.id,
      questions: preQuestions,
      correctCount: plan.pre,
      submittedAt: new Date("2026-06-03T09:00:00.000Z"),
    });

    await upsertSolvedAttempt({
      assessmentId: postAssessment.id,
      userId: participant.id,
      questions: postQuestions,
      correctCount: plan.post,
      submittedAt: new Date("2026-06-04T09:00:00.000Z"),
    });
  }

  const topicIds = [sqlBasics.id, joins.id, normalization.id];
  const learningObjectiveIds = [
    selectObjective.id,
    keysObjective.id,
    joinObjective.id,
    normalizeObjective.id,
  ];

  await upsertByFirst(
    "assessmentBlueprint",
    {
      title: "Database Fundamentals Pre/Post Series",
      trainingId: training.id,
    },
    {
      description: "Demo linked pre/post series for final presentation",
      targetQuestionCount: 8,
      configJson: {
        kind: "PRE_POST_SERIES",
        seriesKey: "database-fundamentals",
        preAssessmentId: preAssessment.id,
        postAssessmentId: postAssessment.id,
        topicIds,
        learningObjectiveIds,
        description: "Demo linked pre/post series for final presentation",
      },
    }
  );

  const completedAttempts = await prisma.assessmentAttempt.count({
    where: {
      assessmentId: {
        in: [preAssessment.id, postAssessment.id],
      },
      status: {
        in: COMPLETED_STATUSES,
      },
    },
  });

  console.log(
    `Demo seed data upserted: ${participants.length} participants, ${allSpecs.length} approved questions, 2 assessments, ${completedAttempts} completed attempts.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
