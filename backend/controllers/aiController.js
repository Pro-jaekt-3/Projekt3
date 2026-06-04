const prisma = require("../prisma/client");
const { AI_PROVIDERS, getDefaultAiModelConfig } = require("../config/ai");

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

    const { provider, modelName, providerConfig } = getDefaultAiModelConfig();

    const aiModel = await prisma.aiModel.findUnique({
      where: {
        provider_modelName: {
          provider,
          modelName,
        },
      },
    });

    if (!aiModel || !aiModel.isActive) {
      return res.status(500).json({
        error: `Configured AI model is missing or inactive: ${provider}/${modelName}. Seed or configure AiModel before using this endpoint.`,
      });
    }

    if (provider !== AI_PROVIDERS.OLLAMA) {
      return res.status(501).json({
        error: `AI provider ${provider} is not implemented for question drafts yet.`,
      });
    }

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

    const { provider, modelName, providerConfig } = getDefaultAiModelConfig();

    const aiModel = await prisma.aiModel.findUnique({
      where: {
        provider_modelName: {
          provider,
          modelName,
        },
      },
    });

    if (!aiModel || !aiModel.isActive) {
      return res.status(500).json({
        error: `Configured AI model is missing or inactive: ${provider}/${modelName}. Seed or configure AiModel before using this endpoint.`,
      });
    }

    if (provider !== AI_PROVIDERS.OLLAMA) {
      return res.status(501).json({
        error: `AI provider ${provider} is not implemented for equivalence suggestions yet.`,
      });
    }

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

module.exports = {
  generateQuestionDraft,
  suggestQuestionEquivalence,
  reviewAiInteraction,
};
