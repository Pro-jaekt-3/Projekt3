const prisma = require("../prisma/client");
const {
  AI_PROVIDERS,
  DEFAULT_LOCAL_MODEL,
  getDefaultAiModelConfig,
  getProviderConfig,
} = require("../config/ai");
const { buildPrePostSeriesAnalytics } = require("./analyticsController");

const AI_MODEL_SELECT = {
  id: true,
  provider: true,
  modelName: true,
  displayName: true,
  baseUrl: true,
  isLocal: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

function missingRequiredFields(body) {
  return ["topic", "learningObjective", "questionType", "difficulty"].filter((field) => {
    const value = body[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
}

function getRequesterId(req) {
  const requesterId = Number(req.user?.id);
  return Number.isInteger(requesterId) && requesterId > 0
    ? requesterId
    : null;
}

function buildQuestionDraftPrompt({
  topic,
  learningObjective,
  questionType,
  difficulty,
  instructions,
}) {
  return [
    "Generate a question draft for an informatics/computer science assessment.",
    "",
    `Topic: ${topic}`,
    `Learning objective: ${learningObjective}`,
    `Question type: ${questionType}`,
    `Difficulty: ${difficulty}`,
    instructions ? `Additional instructions: ${instructions}` : null,
    "",
    "Return a structured JSON-like draft with these fields:",
    "- title or questionText",
    "- questionType",
    "- difficulty",
    "- suggestedAnswer or answerOptions when relevant",
    "- shortExplanation",
    "",
    "The result is only a draft suggestion for human review. Do not mark it as approved.",
  ]
    .filter(Boolean)
    .join("\n");
}

function parsePositiveIntegerId(value) {
  const parsedId = Number(value);
  return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
}

function formatQuestionForPrompt(label, question) {
  const answerOptions = question.answerOptions.length
    ? question.answerOptions
        .map((option) => {
          const correctness = option.isCorrect ? "correct" : "not marked correct";
          return `  - ${option.orderIndex}. ${option.text} (${correctness})`;
        })
        .join("\n")
    : "  - None";

  return [
    `${label}:`,
    `Id: ${question.id}`,
    `Title: ${question.title}`,
    `Description: ${question.description}`,
    `Question type: ${question.type}`,
    `Difficulty: ${question.difficulty}`,
    `Topic: ${question.topic?.name || "None"}`,
    `Learning objective: ${question.learningObjective?.title || "None"}`,
    question.learningObjective?.description
      ? `Learning objective description: ${question.learningObjective.description}`
      : null,
    question.equivalentGroup
      ? `Existing equivalent group: ${question.equivalentGroup.name} (id ${question.equivalentGroup.id})`
      : "Existing equivalent group: None",
    "Answer options:",
    answerOptions,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEquivalenceSuggestionPrompt({ questionA, questionB, instructions }) {
  return [
    "Compare two existing assessment questions and suggest whether they are equivalent.",
    "Equivalent means they assess substantially the same concept, learning objective, difficulty, and expected student competency.",
    "",
    formatQuestionForPrompt("Question A", questionA),
    "",
    formatQuestionForPrompt("Question B", questionB),
    instructions ? `\nAdditional instructor instructions: ${instructions}` : null,
    "",
    "Return a structured JSON-like response with these fields:",
    "- suggestedSimilarityScore from 0 to 1",
    "- isLikelyEquivalent as true or false",
    "- explanation",
    "- keySimilarities",
    "- keyDifferences",
    "- caution: final decision must be made by the instructor",
    "",
    "Do not make the final equivalence decision. Do not approve or modify either question.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrePostInsightsPrompt(analytics) {
  const topicLines = analytics.byTopic
    .map(
      (topic) =>
        `- ${topic.topicName}: pre ${topic.prePercentage}%, post ${topic.postPercentage}%, improvement ${topic.improvement} points`
    )
    .join("\n");
  const objectiveLines = analytics.byLearningObjective
    .map(
      (objective) =>
        `- ${objective.title}: pre ${objective.prePercentage}%, post ${objective.postPercentage}%, improvement ${objective.improvement} points`
    )
    .join("\n");
  const participantLines = analytics.participants
    .map(
      (participant) =>
        `- ${participant.name} (${participant.email}): ${participant.preScore} to ${participant.postScore}, ${participant.status}`
    )
    .join("\n");

  return [
    "You are helping an instructor review linked pre-test and post-test analytics.",
    "Produce concise instructor-facing insights. The output is advisory only and must say it should be reviewed by an instructor.",
    "",
    `Series: ${analytics.series.title}`,
    `Training: ${analytics.series.training?.title || "Unknown"}`,
    `Pre-test: ${analytics.preAssessment.title}`,
    `Post-test: ${analytics.postAssessment.title}`,
    "",
    "Summary:",
    `- Participants with both attempts: ${analytics.summary.participantCount}`,
    `- Average pre score: ${analytics.summary.averagePreScore}`,
    `- Average post score: ${analytics.summary.averagePostScore}`,
    `- Average score improvement: ${analytics.summary.averageImprovement}`,
    `- Average pre percentage: ${analytics.summary.averagePrePercentage}%`,
    `- Average post percentage: ${analytics.summary.averagePostPercentage}%`,
    `- Average percentage improvement: ${analytics.summary.averagePercentageImprovement} points`,
    `- Strongest topic: ${analytics.summary.strongestTopic || "N/A"}`,
    `- Weakest pre-test topic: ${analytics.summary.weakestPreTopic || "N/A"}`,
    `- Most improved topic: ${analytics.summary.mostImprovedTopic || "N/A"}`,
    "",
    "Topic performance:",
    topicLines || "- No topic data",
    "",
    "Learning objective performance:",
    objectiveLines || "- No objective data",
    "",
    "Participant progress:",
    participantLines || "- No participant data",
    "",
    "Return sections for:",
    "1. Overall improvement",
    "2. Weak topics",
    "3. Strongest improvement",
    "4. Recommended next teaching actions",
    "5. Advisory caution",
    "",
    "Do not suggest changing recorded scores. Do not modify assessments, questions, or results.",
  ].join("\n");
}

async function callOllama({ baseUrl, modelName, prompt }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Ollama returned ${response.status}: ${responseText}`);
  }

  const data = await response.json();
  return data.response || "";
}

async function getOllamaTags(baseUrl) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`);

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Ollama returned ${response.status}: ${responseText}`);
  }

  const data = await response.json();
  return Array.isArray(data.models)
    ? data.models.map((model) => model.name).filter(Boolean)
    : [];
}

function getModelBaseUrl(aiModel) {
  const providerConfig = getProviderConfig(aiModel.provider);
  return aiModel.baseUrl || providerConfig.baseUrl;
}

async function ensureOllamaModelIsInstalled(aiModel) {
  const baseUrl = getModelBaseUrl(aiModel);

  try {
    const installedModels = await getOllamaTags(baseUrl);

    if (installedModels.length > 0 && !installedModels.includes(aiModel.modelName)) {
      return {
        error: `Ollama model ${aiModel.modelName} is active in the database but is not installed locally. Install it with ollama pull ${aiModel.modelName}, choose another model, or mark it inactive.`,
        status: 400,
      };
    }
  } catch (error) {
    return {
      error: "Ollama is unavailable. Confirm Ollama is running and OLLAMA_BASE_URL is correct.",
      details: error.message,
      status: 502,
    };
  }

  return null;
}

async function resolveAiModel(body = {}) {
  const requestedAiModelId = parsePositiveIntegerId(body.aiModelId);
  const requestedModelName =
    typeof body.modelName === "string" && body.modelName.trim()
      ? body.modelName.trim()
      : null;
  const defaultConfig = getDefaultAiModelConfig();

  let aiModel = null;

  if (requestedAiModelId) {
    aiModel = await prisma.aiModel.findFirst({
      where: {
        id: requestedAiModelId,
        isActive: true,
      },
      select: AI_MODEL_SELECT,
    });

    if (!aiModel) {
      return {
        error: `AI model ${requestedAiModelId} is missing or inactive.`,
        status: 400,
      };
    }
  } else if (requestedModelName) {
    aiModel = await prisma.aiModel.findFirst({
      where: {
        modelName: requestedModelName,
        isActive: true,
      },
      orderBy: [
        {
          provider: "asc",
        },
        {
          isLocal: "desc",
        },
      ],
      select: AI_MODEL_SELECT,
    });

    if (!aiModel) {
      return {
        error: `AI model ${requestedModelName} is missing or inactive.`,
        status: 400,
      };
    }
  } else if (defaultConfig.modelName) {
    aiModel = await prisma.aiModel.findFirst({
      where: {
        provider: defaultConfig.provider,
        modelName: defaultConfig.modelName,
        isActive: true,
      },
      select: AI_MODEL_SELECT,
    });

    if (!aiModel) {
      return {
        error: `AI_DEFAULT_MODEL ${defaultConfig.modelName} is missing or inactive in the database.`,
        status: 400,
      };
    }
  } else {
    const localOllamaModels = await prisma.aiModel.findMany({
      where: {
        provider: AI_PROVIDERS.OLLAMA,
        isLocal: true,
        isActive: true,
      },
      orderBy: [
        {
          modelName: "asc",
        },
      ],
      select: AI_MODEL_SELECT,
    });
    aiModel =
      localOllamaModels.find((model) => model.modelName === DEFAULT_LOCAL_MODEL) ||
      localOllamaModels[0];

    if (!aiModel) {
      aiModel = await prisma.aiModel.findFirst({
        where: {
          isActive: true,
        },
        orderBy: [
          {
            isLocal: "desc",
          },
          {
            provider: "asc",
          },
          {
            modelName: "asc",
          },
        ],
        select: AI_MODEL_SELECT,
      });
    }
  }

  if (!aiModel) {
    return {
      error: "No active AI model is configured.",
      status: 400,
    };
  }

  if (aiModel.provider !== AI_PROVIDERS.OLLAMA) {
    return {
      aiModel,
      error: "Only Ollama generation is currently implemented.",
      status: 501,
    };
  }

  const ollamaError = await ensureOllamaModelIsInstalled(aiModel);

  if (ollamaError) {
    return {
      aiModel,
      ...ollamaError,
    };
  }

  return {
    aiModel,
    provider: aiModel.provider,
    modelName: aiModel.modelName,
    providerConfig: {
      ...getProviderConfig(aiModel.provider),
      baseUrl: getModelBaseUrl(aiModel),
    },
  };
}

function sendModelResolutionError(res, resolution) {
  return res.status(resolution.status || 500).json({
    error: resolution.error,
    ...(resolution.details ? { details: resolution.details } : {}),
  });
}

const generateQuestionDraft = async (req, res) => {
  try {
    const missingFields = missingRequiredFields(req.body);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const requesterId = getRequesterId(req);

    if (!requesterId) {
      return res.status(400).json({
        error: "Authenticated requester user is required.",
      });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester) {
      return res.status(400).json({
        error: `Requester user ${requesterId} was not found.`,
      });
    }

    const modelResolution = await resolveAiModel(req.body);

    if (modelResolution.error) {
      return sendModelResolutionError(res, modelResolution);
    }

    const { aiModel, provider, modelName, providerConfig } = modelResolution;
    const prompt = buildQuestionDraftPrompt(req.body);
    let suggestion;

    try {
      suggestion = await callOllama({
        baseUrl: providerConfig.baseUrl,
        modelName,
        prompt,
      });
    } catch (error) {
      return res.status(502).json({
        error: "AI provider request failed.",
        details: error.message,
      });
    }

    const aiInteraction = await prisma.aiInteraction.create({
      data: {
        aiModelId: aiModel.id,
        requestedById: requesterId,
        action: "GENERATE_QUESTION",
        prompt,
        resultText: suggestion,
        reviewStatus: "PENDING",
      },
    });

    res.status(201).json({
      suggestion,
      aiModelId: aiModel.id,
      aiInteractionId: aiInteraction.id,
      provider,
      model: modelName,
      reviewStatus: aiInteraction.reviewStatus,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const suggestQuestionEquivalence = async (req, res) => {
  try {
    const questionAId = parsePositiveIntegerId(req.body.questionAId);
    const questionBId = parsePositiveIntegerId(req.body.questionBId);

    if (!questionAId || !questionBId) {
      return res.status(400).json({
        error: "questionAId and questionBId are required and must be positive numeric ids.",
      });
    }

    if (questionAId === questionBId) {
      return res.status(400).json({
        error: "questionAId and questionBId must refer to different questions.",
      });
    }

    const requesterId = getRequesterId(req);

    if (!requesterId) {
      return res.status(400).json({
        error: "Authenticated requester user is required.",
      });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester) {
      return res.status(400).json({
        error: `Requester user ${requesterId} was not found.`,
      });
    }

    const questionInclude = {
      topic: true,
      learningObjective: true,
      equivalentGroup: true,
      answerOptions: {
        orderBy: {
          orderIndex: "asc",
        },
      },
    };

    const [questionA, questionB] = await Promise.all([
      prisma.question.findUnique({
        where: { id: questionAId },
        include: questionInclude,
      }),
      prisma.question.findUnique({
        where: { id: questionBId },
        include: questionInclude,
      }),
    ]);

    if (!questionA || !questionB) {
      const missingQuestionIds = [
        !questionA ? questionAId : null,
        !questionB ? questionBId : null,
      ].filter(Boolean);

      return res.status(404).json({
        error: `Question not found: ${missingQuestionIds.join(", ")}`,
      });
    }

    const modelResolution = await resolveAiModel(req.body);

    if (modelResolution.error) {
      return sendModelResolutionError(res, modelResolution);
    }

    const { aiModel, provider, modelName, providerConfig } = modelResolution;
    const prompt = buildEquivalenceSuggestionPrompt({
      questionA,
      questionB,
      instructions: req.body.instructions,
    });
    let suggestion;

    try {
      suggestion = await callOllama({
        baseUrl: providerConfig.baseUrl,
        modelName,
        prompt,
      });
    } catch (error) {
      return res.status(502).json({
        error: "AI provider request failed.",
        details: error.message,
      });
    }

    const aiInteraction = await prisma.aiInteraction.create({
      data: {
        aiModelId: aiModel.id,
        requestedById: requesterId,
        action: "CHECK_EQUIVALENCE",
        prompt,
        resultText: suggestion,
        sourceQuestionId: questionAId,
        reviewStatus: "PENDING",
      },
    });

    res.status(201).json({
      aiInteractionId: aiInteraction.id,
      aiModelId: aiModel.id,
      provider,
      model: modelName,
      reviewStatus: aiInteraction.reviewStatus,
      questionAId,
      questionBId,
      suggestion,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const generatePrePostInsights = async (req, res) => {
  try {
    const seriesId = parsePositiveIntegerId(req.body.seriesId);

    if (!seriesId) {
      return res.status(400).json({
        error: "seriesId is required and must be a positive numeric id.",
      });
    }

    const requesterId = getRequesterId(req);

    if (!requesterId) {
      return res.status(400).json({
        error: "Authenticated requester user is required.",
      });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
    });

    if (!requester) {
      return res.status(400).json({
        error: `Requester user ${requesterId} was not found.`,
      });
    }

    const analytics = await buildPrePostSeriesAnalytics(seriesId);
    const modelResolution = await resolveAiModel(req.body);

    if (modelResolution.error) {
      return sendModelResolutionError(res, modelResolution);
    }

    const { aiModel, modelName, providerConfig } = modelResolution;
    const prompt = buildPrePostInsightsPrompt(analytics);
    let insightsText;

    try {
      insightsText = await callOllama({
        baseUrl: providerConfig.baseUrl,
        modelName,
        prompt,
      });
    } catch (error) {
      return res.status(502).json({
        error: "AI provider request failed.",
        details: error.message,
      });
    }

    const aiInteraction = await prisma.aiInteraction.create({
      data: {
        aiModelId: aiModel.id,
        requestedById: requesterId,
        action: "REVIEW_TEST",
        prompt,
        resultText: insightsText,
        reviewStatus: "PENDING",
      },
    });

    res.status(201).json({
      aiInteractionId: aiInteraction.id,
      model: modelName,
      reviewStatus: aiInteraction.reviewStatus,
      insightsText,
      analyticsSummary: analytics.summary,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message,
    });
  }
};

const reviewAiInteraction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewStatus } = req.body;
    const allowedReviewStatuses = ["ACCEPTED", "REJECTED"];

    if (!reviewStatus) {
      return res.status(400).json({
        error: "reviewStatus is required",
      });
    }

    if (!allowedReviewStatuses.includes(reviewStatus)) {
      return res.status(400).json({
        error: "Invalid reviewStatus. Allowed values: ACCEPTED, REJECTED",
      });
    }

    const aiInteractionId = Number(id);

    if (!Number.isInteger(aiInteractionId) || aiInteractionId <= 0) {
      return res.status(400).json({
        error: "Invalid AiInteraction id",
      });
    }

    const aiInteraction = await prisma.aiInteraction.findUnique({
      where: { id: aiInteractionId },
    });

    if (!aiInteraction) {
      return res.status(404).json({
        error: "AiInteraction not found",
      });
    }

    if (aiInteraction.reviewStatus !== "PENDING") {
      return res.status(409).json({
        error: `AiInteraction has already been reviewed with status ${aiInteraction.reviewStatus}`,
      });
    }

    const reviewerId = getRequesterId(req);

    if (!reviewerId) {
      return res.status(400).json({
        error: "Reviewer user is required",
      });
    }

    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
    });

    if (!reviewer) {
      return res.status(400).json({
        error: `Reviewer user ${reviewerId} was not found.`,
      });
    }

    const updatedAiInteraction = await prisma.aiInteraction.update({
      where: { id: aiInteractionId },
      data: {
        reviewStatus,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });

    res.json({
      aiInteractionId: updatedAiInteraction.id,
      reviewStatus: updatedAiInteraction.reviewStatus,
      reviewedById: updatedAiInteraction.reviewedById,
      reviewedAt: updatedAiInteraction.reviewedAt,
      message: `AI suggestion ${reviewStatus.toLowerCase()}`,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const getAiModels = async (req, res) => {
  try {
    const models = await prisma.aiModel.findMany({
      orderBy: [
        {
          isActive: "desc",
        },
        {
          provider: "asc",
        },
        {
          modelName: "asc",
        },
      ],
      select: AI_MODEL_SELECT,
    });

    res.json(models);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const getOllamaStatus = async (req, res) => {
  const defaultConfig = getDefaultAiModelConfig();
  const providerConfig = getProviderConfig(AI_PROVIDERS.OLLAMA);
  const baseUrl = providerConfig.baseUrl;

  try {
    const [models, activeDatabaseModels] = await Promise.all([
      getOllamaTags(baseUrl),
      prisma.aiModel.findMany({
        where: {
          provider: AI_PROVIDERS.OLLAMA,
          isActive: true,
        },
        orderBy: [
          {
            isLocal: "desc",
          },
          {
            modelName: "asc",
          },
        ],
        select: AI_MODEL_SELECT,
      }),
    ]);

    res.json({
      reachable: true,
      baseUrl,
      models,
      configuredDefaultModel: defaultConfig.modelName || DEFAULT_LOCAL_MODEL,
      activeDatabaseModels,
    });
  } catch (error) {
    const activeDatabaseModels = await prisma.aiModel.findMany({
      where: {
        provider: AI_PROVIDERS.OLLAMA,
        isActive: true,
      },
      orderBy: [
        {
          isLocal: "desc",
        },
        {
          modelName: "asc",
        },
      ],
      select: AI_MODEL_SELECT,
    });

    res.json({
      reachable: false,
      baseUrl,
      models: [],
      configuredDefaultModel: defaultConfig.modelName || DEFAULT_LOCAL_MODEL,
      activeDatabaseModels,
      error: `Ollama is not reachable at ${baseUrl}. ${error.message}`,
    });
  }
};

const testAiModel = async (req, res) => {
  try {
    const aiModelId = parsePositiveIntegerId(req.params.id);

    if (!aiModelId) {
      return res.status(400).json({
        error: "AI model id must be a positive integer.",
      });
    }

    const aiModel = await prisma.aiModel.findUnique({
      where: {
        id: aiModelId,
      },
      select: AI_MODEL_SELECT,
    });

    if (!aiModel || !aiModel.isActive) {
      return res.status(400).json({
        error: `AI model ${aiModelId} is missing or inactive.`,
      });
    }

    if (aiModel.provider !== AI_PROVIDERS.OLLAMA) {
      return res.status(501).json({
        error: "Only Ollama generation is currently implemented.",
      });
    }

    const ollamaError = await ensureOllamaModelIsInstalled(aiModel);

    if (ollamaError) {
      return res.status(ollamaError.status).json({
        error: ollamaError.error,
        ...(ollamaError.details ? { details: ollamaError.details } : {}),
      });
    }

    const responseText = await callOllama({
      baseUrl: getModelBaseUrl(aiModel),
      modelName: aiModel.modelName,
      prompt: "Reply with exactly: OK",
    });

    res.json({
      success: true,
      model: aiModel.modelName,
      provider: aiModel.provider,
      responsePreview: responseText.slice(0, 240),
    });
  } catch (error) {
    res.status(502).json({
      error: "AI model test failed.",
      details: error.message,
    });
  }
};

module.exports = {
  generateQuestionDraft,
  suggestQuestionEquivalence,
  generatePrePostInsights,
  reviewAiInteraction,
  getAiModels,
  getOllamaStatus,
  testAiModel,
};
