const prisma = require("../prisma/client");
const { AI_PROVIDERS, getDefaultAiModelConfig, getProviderConfig } = require("../config/ai");
const { computePrePostComparison } = require("./analyticsController");
const { generateWithOllama } = require("../lib/ollama");
const { generateWithOpenAiCompatible } = require("../lib/openaiCompatible");

// Fallback base URLs for OpenAI-compatible providers when neither the AiModel
// row nor the provider env var (OPENAI_BASE_URL/DEEPSEEK_BASE_URL) sets one.
const PROVIDER_BASE_URL_FALLBACKS = {
  [AI_PROVIDERS.OPENAI]: "https://api.openai.com/v1",
  [AI_PROVIDERS.DEEPSEEK]: "https://api.deepseek.com/v1",
};

function resolveProviderBaseUrl(provider, aiModelBaseUrl, providerConfig) {
  return aiModelBaseUrl || providerConfig.baseUrl || PROVIDER_BASE_URL_FALLBACKS[provider];
}

// Single entry point for text generation: Ollama keeps its existing path,
// every other provider goes through the generic OpenAI-compatible client.
async function generateText({ provider, baseUrl, apiKey, modelName, prompt, timeoutMs }) {
  if (provider === AI_PROVIDERS.OLLAMA) {
    return generateWithOllama({ baseUrl, modelName, prompt, timeoutMs });
  }
  return generateWithOpenAiCompatible({ baseUrl, apiKey, modelName, prompt, timeoutMs });
}

const AI_ACTIONS = [
  "GENERATE_QUESTION",
  "EDIT_QUESTION",
  "GENERATE_EQUIVALENT_QUESTION",
  "CHECK_EQUIVALENCE",
  "CHECK_QUESTION_QUALITY",
  "REVIEW_TEST",
  "GENERATE_SYNTHETIC_DATA",
];
const AI_REVIEW_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"];

function missingRequiredFields(body) {
  return ["topic", "questionType", "difficulty"].filter((field) => {
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

// Difficulty is stored as an Int in the schema; the app convention is 1=EASY,
// 2=MEDIUM, 3=HARD (see analyticsController + frontend min(1).max(3)).
const DIFFICULTY_LABEL_TO_INT = { EASY: 1, MEDIUM: 2, HARD: 3 };
const DIFFICULTY_MIN = 1;
const DIFFICULTY_MAX = 3;
const DEFAULT_DIFFICULTY = 2;
const QUESTION_TYPES = ["OPEN", "MULTIPLE_CHOICE", "CODE"];

// Accepts an Int (1-3) or a label (easy/medium/hard). Returns null if unusable.
function mapDifficultyToInt(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numeric = Number(value);
  if (Number.isInteger(numeric)) {
    return numeric >= DIFFICULTY_MIN && numeric <= DIFFICULTY_MAX ? numeric : null;
  }
  const label = String(value).trim().toUpperCase();
  return DIFFICULTY_LABEL_TO_INT[label] ?? null;
}

function normalizeQuestionType(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim().toUpperCase().replace(/[\s-]+/g, "_");
  return QUESTION_TYPES.includes(normalized) ? normalized : null;
}

// T3: instruct the model to return STRICT JSON matching the persisted schema.
function buildQuestionDraftPrompt({
  topic,
  questionType,
  difficulty,
  instructions,
}) {
  const normalizedType = normalizeQuestionType(questionType) || "OPEN";
  return [
    "You generate a single assessment question draft for an informatics/computer science course.",
    "Respond with STRICT JSON ONLY — no markdown, no code fences, no commentary, no <think> text.",
    "",
    "Context:",
    `- Topic: ${topic}`,
    `- Requested question type: ${normalizedType}`,
    `- Requested difficulty: ${difficulty}`,
    instructions ? `- Additional instructions: ${instructions}` : null,
    "",
    "Output JSON shape (exactly these keys):",
    "{",
    '  "title": string,            // short question title',
    '  "description": string,      // full question text / prompt',
    '  "difficulty": integer,      // 1=easy, 2=medium, 3=hard',
    '  "type": "OPEN" | "MULTIPLE_CHOICE" | "CODE",',
    '  "answerOptions": [          // ONLY for MULTIPLE_CHOICE; use [] otherwise',
    '    { "text": string, "isCorrect": boolean, "orderIndex": integer }',
    "  ]",
    "}",
    "",
    `Use type "${normalizedType}".`,
    'If type is MULTIPLE_CHOICE: provide at least 2 options with at least 1 correct.',
    'If type is OPEN or CODE: set "answerOptions" to an empty array [].',
    "This is only a draft for human review. Do not mark it approved.",
  ]
    .filter(Boolean)
    .join("\n");
}

// T2: instruct the model to generate a NEW, equivalent question (not compare).
function buildEquivalentQuestionPrompt({ sourceQuestion, instructions }) {
  return [
    "You generate a NEW assessment question that is EQUIVALENT to the source question below.",
    "Equivalent means it assesses substantially the same concept, learning objective, difficulty",
    "and expected competency, but is NOT a copy — reword it and change surface details.",
    "Respond with STRICT JSON ONLY — no markdown, no code fences, no commentary, no <think> text.",
    "",
    formatQuestionForPrompt("Source question", sourceQuestion),
    instructions ? `\nAdditional instructor instructions: ${instructions}` : null,
    "",
    "Output JSON shape (exactly these keys):",
    "{",
    '  "title": string,',
    '  "description": string,',
    '  "difficulty": integer,      // 1=easy, 2=medium, 3=hard',
    '  "type": "OPEN" | "MULTIPLE_CHOICE" | "CODE",',
    '  "answerOptions": [ { "text": string, "isCorrect": boolean, "orderIndex": integer } ]',
    "}",
    "",
    `Keep the same type ("${sourceQuestion.type}") and a comparable difficulty (${sourceQuestion.difficulty}).`,
    'If type is MULTIPLE_CHOICE: provide at least 2 options with at least 1 correct.',
    'If type is OPEN or CODE: set "answerOptions" to an empty array [].',
    "This is only a draft for human review. Do not mark it approved.",
  ]
    .filter(Boolean)
    .join("\n");
}

// --- Structured-output parsing/validation (T3 + T2) -------------------------

// Strip <think>...</think> reasoning blocks and ```json ...``` fences that
// local models (e.g. qwen3) tend to wrap around JSON.
function stripModelNoise(text) {
  let out = String(text || "");
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const fence = out.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    out = fence[1];
  }
  return out.trim();
}

// Extract the first balanced { ... } object, ignoring braces inside strings.
function extractBalancedJson(text) {
  const start = text.indexOf("{");
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

// Parse model output into an object, attempting a light repair on failure.
// Returns the parsed object or undefined (caller emits 422).
function parseStructuredDraft(rawText) {
  const cleaned = stripModelNoise(rawText);
  const candidate = extractBalancedJson(cleaned) || cleaned;

  const attempts = [
    candidate,
    // Repair pass: drop trailing commas before } or ].
    candidate.replace(/,\s*([}\]])/g, "$1"),
  ];

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      // try next attempt
    }
  }
  return undefined;
}

// Validate + normalize a parsed draft into the persisted question shape.
// Returns { value } or { error } (caller emits 422 on error).
function buildStructuredQuestion(parsed, { requestedType, requestedDifficulty }) {
  if (!parsed || typeof parsed !== "object") {
    return { error: "Model did not return a JSON object." };
  }

  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";

  if (!title) {
    return { error: "Generated question is missing a non-empty 'title'." };
  }
  if (!description) {
    return { error: "Generated question is missing a non-empty 'description'." };
  }

  // Honor the requested type (instructor/source choice) first; fall back to the
  // model's type, then OPEN.
  const type =
    normalizeQuestionType(requestedType) || normalizeQuestionType(parsed.type) || "OPEN";

  const difficulty =
    mapDifficultyToInt(parsed.difficulty) ??
    mapDifficultyToInt(requestedDifficulty) ??
    DEFAULT_DIFFICULTY;

  const result = { title, description, difficulty, type, answerOptions: [] };

  if (type === "MULTIPLE_CHOICE") {
    const rawOptions = Array.isArray(parsed.answerOptions) ? parsed.answerOptions : [];
    const options = rawOptions
      .filter((option) => option && typeof option.text === "string" && option.text.trim())
      .map((option, index) => ({
        text: option.text.trim(),
        isCorrect: Boolean(option.isCorrect),
        orderIndex: index,
      }));

    if (options.length < 2) {
      return {
        error: "Multiple choice question must have at least two answer options.",
      };
    }
    if (!options.some((option) => option.isCorrect)) {
      return {
        error: "Multiple choice question must have at least one correct answer option.",
      };
    }
    result.answerOptions = options;
  }

  return { value: result };
}

// --- Generation model resolution (T1) ---------------------------------------

// Resolves the local Ollama model to run a generation with.
// - aiModelId provided  -> must exist and be isActive && isLocal (else 400).
// - aiModelId omitted    -> env-configured default model (existing behavior).
// Returns { aiModel, baseUrl, modelName, provider } or { error: { status, message } }.
async function resolveGenerationModel(aiModelIdRaw) {
  const hasOverride =
    aiModelIdRaw !== undefined &&
    aiModelIdRaw !== null &&
    String(aiModelIdRaw).trim() !== "";

  if (hasOverride) {
    const aiModelId = parsePositiveIntegerId(aiModelIdRaw);
    if (!aiModelId) {
      return { error: { status: 400, message: "aiModelId must be a positive integer." } };
    }

    const aiModel = await prisma.aiModel.findUnique({ where: { id: aiModelId } });
    if (!aiModel) {
      return { error: { status: 400, message: `AI model ${aiModelId} was not found.` } };
    }
    if (!aiModel.isActive) {
      return {
        error: {
          status: 400,
          message: `AI model ${aiModelId} must be active to be used for generation.`,
        },
      };
    }

    const providerConfig = getProviderConfig(aiModel.provider);
    return {
      aiModel,
      baseUrl: resolveProviderBaseUrl(aiModel.provider, aiModel.baseUrl, providerConfig),
      apiKey: providerConfig.apiKey,
      modelName: aiModel.modelName,
      provider: aiModel.provider,
    };
  }

  // Default: env-configured model (unchanged existing behavior for Ollama;
  // other providers are now resolved instead of rejected with 501).
  const { provider, modelName, providerConfig } = getDefaultAiModelConfig();
  const aiModel = await prisma.aiModel.findUnique({
    where: { provider_modelName: { provider, modelName } },
  });

  if (!aiModel || !aiModel.isActive) {
    return {
      error: {
        status: 500,
        message: `Configured AI model is missing or inactive: ${provider}/${modelName}. Seed or configure AiModel before using this endpoint.`,
      },
    };
  }

  return {
    aiModel,
    baseUrl: resolveProviderBaseUrl(provider, aiModel.baseUrl, providerConfig),
    apiKey: providerConfig.apiKey,
    modelName,
    provider,
  };
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
    question.equivalenceGroup
      ? `Existing equivalence group: ${question.equivalenceGroup.title ?? "(untitled)"} (id ${question.equivalenceGroup.id})`
      : "Existing equivalence group: None",
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

    const resolved = await resolveGenerationModel(req.body.aiModelId);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ error: resolved.error.message });
    }
    const { aiModel, baseUrl, apiKey, modelName, provider } = resolved;

    const prompt = buildQuestionDraftPrompt(req.body);
    let rawText;

    try {
      rawText = await generateText({ provider, baseUrl, apiKey, modelName, prompt });
    } catch (error) {
      console.error("[AI ERROR]", {
        provider,
        baseUrl,
        model: modelName,
        message: error?.message,
        status: error?.response?.status,
        body: error?.response?.data ?? error?.cause?.message,
      });
      return res.status(502).json({
        error: "AI provider request failed.",
        details: error.message,
      });
    }

    // T3: parse + validate strict JSON; never return raw garbage.
    const parsed = parseStructuredDraft(rawText);
    if (!parsed) {
      return res.status(422).json({
        error: "AI model did not return valid JSON for the question draft.",
        resultText: rawText,
      });
    }

    const built = buildStructuredQuestion(parsed, {
      requestedType: req.body.questionType,
      requestedDifficulty: req.body.difficulty,
    });
    if (built.error) {
      return res.status(422).json({
        error: `AI model returned an invalid question draft: ${built.error}`,
        resultText: rawText,
      });
    }

    const aiInteraction = await prisma.aiInteraction.create({
      data: {
        aiModelId: aiModel.id,
        requestedById: requesterId,
        action: "GENERATE_QUESTION",
        prompt,
        resultText: rawText,
        resultJson: built.value,
        reviewStatus: "PENDING",
      },
    });

    res.status(201).json({
      aiInteractionId: aiInteraction.id,
      provider,
      model: modelName,
      reviewStatus: aiInteraction.reviewStatus,
      question: built.value,
      resultText: rawText,
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
      equivalenceGroup: true,
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

    const resolved = await resolveGenerationModel(req.body.aiModelId);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ error: resolved.error.message });
    }
    const { aiModel, baseUrl, apiKey, modelName, provider } = resolved;

    const prompt = buildEquivalenceSuggestionPrompt({
      questionA,
      questionB,
      instructions: req.body.instructions,
    });
    let suggestion;

    try {
      suggestion = await generateText({ provider, baseUrl, apiKey, modelName, prompt });
    } catch (error) {
      console.error("[AI ERROR]", {
        provider,
        baseUrl,
        model: modelName,
        message: error?.message,
        status: error?.response?.status,
        body: error?.response?.data ?? error?.cause?.message,
      });
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

// T2: generate a NEW question equivalent to an existing source question.
// This is distinct from CHECK_EQUIVALENCE (which compares two existing ones).
const generateEquivalentQuestion = async (req, res) => {
  try {
    const sourceQuestionId = parsePositiveIntegerId(req.body.sourceQuestionId);

    if (!sourceQuestionId) {
      return res.status(400).json({
        error: "sourceQuestionId is required and must be a positive numeric id.",
      });
    }

    const requesterId = getRequesterId(req);

    if (!requesterId) {
      return res.status(400).json({
        error: "Authenticated requester user is required.",
      });
    }

    const requester = await prisma.user.findUnique({ where: { id: requesterId } });

    if (!requester) {
      return res.status(400).json({
        error: `Requester user ${requesterId} was not found.`,
      });
    }

    const sourceQuestion = await prisma.question.findUnique({
      where: { id: sourceQuestionId },
      include: {
        topic: true,
        equivalenceGroup: true,
        answerOptions: { orderBy: { orderIndex: "asc" } },
      },
    });

    if (!sourceQuestion) {
      return res.status(404).json({ error: `Question not found: ${sourceQuestionId}` });
    }

    const resolved = await resolveGenerationModel(req.body.aiModelId);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ error: resolved.error.message });
    }
    const { aiModel, baseUrl, apiKey, modelName, provider } = resolved;

    const prompt = buildEquivalentQuestionPrompt({
      sourceQuestion,
      instructions: req.body.instructions,
    });
    let rawText;

    try {
      rawText = await generateText({ provider, baseUrl, apiKey, modelName, prompt });
    } catch (error) {
      console.error("[AI ERROR]", {
        provider,
        baseUrl,
        model: modelName,
        message: error?.message,
        status: error?.response?.status,
        body: error?.response?.data ?? error?.cause?.message,
      });
      return res.status(502).json({
        error: "AI provider request failed.",
        details: error.message,
      });
    }

    const parsed = parseStructuredDraft(rawText);
    if (!parsed) {
      return res.status(422).json({
        error: "AI model did not return valid JSON for the equivalent question.",
        resultText: rawText,
      });
    }

    // Inherit type/difficulty from the source question by default.
    const built = buildStructuredQuestion(parsed, {
      requestedType: sourceQuestion.type,
      requestedDifficulty: sourceQuestion.difficulty,
    });
    if (built.error) {
      return res.status(422).json({
        error: `AI model returned an invalid equivalent question: ${built.error}`,
        resultText: rawText,
      });
    }

    // Persist the draft plus inherited placement so the Accept flow can save it.
    const draft = {
      ...built.value,
      topicId: sourceQuestion.topicId,
    };

    const aiInteraction = await prisma.aiInteraction.create({
      data: {
        aiModelId: aiModel.id,
        requestedById: requesterId,
        action: "GENERATE_EQUIVALENT_QUESTION",
        prompt,
        resultText: rawText,
        resultJson: draft,
        sourceQuestionId,
        reviewStatus: "PENDING",
      },
    });

    res.status(201).json({
      aiInteractionId: aiInteraction.id,
      provider,
      model: modelName,
      reviewStatus: aiInteraction.reviewStatus,
      sourceQuestionId,
      question: draft,
      resultText: rawText,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    // T2 accept-flow: accepting a generated equivalent question SAVES it as a
    // DRAFT question and (T4) links it into the source's equivalent group.
    const shouldSaveEquivalent =
      reviewStatus === "ACCEPTED" &&
      aiInteraction.action === "GENERATE_EQUIVALENT_QUESTION" &&
      !aiInteraction.generatedQuestionId;

    if (shouldSaveEquivalent) {
      const draft = aiInteraction.resultJson;

      if (!draft || typeof draft !== "object" || !draft.topicId) {
        return res.status(422).json({
          error:
            "Stored draft is missing or invalid; cannot save the equivalent question.",
        });
      }

      const source = aiInteraction.sourceQuestionId
        ? await prisma.question.findUnique({
            where: { id: aiInteraction.sourceQuestionId },
            include: { topic: true },
          })
        : null;

      const optionsData =
        draft.type === "MULTIPLE_CHOICE" && Array.isArray(draft.answerOptions)
          ? draft.answerOptions
          : [];

      const { created, updatedInteraction } = await prisma.$transaction(async (tx) => {
        // Resolve the equivalent group the new question joins.
        // - source already grouped  -> reuse that group.
        // - source ungrouped/deleted -> create a fresh group and (if source
        //   still exists) link the source into it too, so the pair is linked.
        let groupId = source?.equivalenceGroupId ?? null;

        if (!groupId && source) {
          const group = await tx.equivalenceGroup.create({
            data: {
              title: `Equivalent: ${source.title}`.slice(0, 191),
              trainingId: source.topic.trainingId,
            },
          });
          groupId = group.id;
          await tx.question.update({
            where: { id: source.id },
            data: { equivalenceGroupId: groupId },
          });
        }

        const createdQuestion = await tx.question.create({
          data: {
            title: draft.title,
            description: draft.description,
            difficulty: draft.difficulty,
            type: draft.type,
            topicId: draft.topicId,
            createdById: reviewerId,
            status: "DRAFT",
            ...(groupId ? { equivalenceGroupId: groupId } : {}),
            ...(optionsData.length
              ? {
                  answerOptions: {
                    create: optionsData.map((option, index) => ({
                      text: option.text,
                      isCorrect: Boolean(option.isCorrect),
                      orderIndex: index,
                    })),
                  },
                }
              : {}),
          },
        });

        const interaction = await tx.aiInteraction.update({
          where: { id: aiInteractionId },
          data: {
            reviewStatus,
            reviewedAt: new Date(),
            generatedQuestionId: createdQuestion.id,
          },
        });

        return { created: createdQuestion, updatedInteraction: interaction };
      });

      return res.json({
        aiInteractionId: updatedInteraction.id,
        reviewStatus: updatedInteraction.reviewStatus,
        reviewedAt: updatedInteraction.reviewedAt,
        generatedQuestionId: created.id,
        equivalenceGroupId: created.equivalenceGroupId,
        message: `AI suggestion accepted; equivalent question ${created.id} created as DRAFT`,
      });
    }

    const updatedAiInteraction = await prisma.aiInteraction.update({
      where: { id: aiInteractionId },
      data: {
        reviewStatus,
        reviewedAt: new Date(),
      },
    });

    res.json({
      aiInteractionId: updatedAiInteraction.id,
      reviewStatus: updatedAiInteraction.reviewStatus,
      reviewedAt: updatedAiInteraction.reviewedAt,
      generatedQuestionId: updatedAiInteraction.generatedQuestionId,
      message: `AI suggestion ${reviewStatus.toLowerCase()}`,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const listAiInteractions = async (req, res) => {
  try {
    const { action, reviewStatus, requestedById } = req.query;

    if (action !== undefined && !AI_ACTIONS.includes(action)) {
      return res.status(400).json({
        error: `Invalid action. Allowed values: ${AI_ACTIONS.join(", ")}`,
      });
    }

    if (reviewStatus !== undefined && !AI_REVIEW_STATUSES.includes(reviewStatus)) {
      return res.status(400).json({
        error: `Invalid reviewStatus. Allowed values: ${AI_REVIEW_STATUSES.join(", ")}`,
      });
    }

    const where = {};
    if (action !== undefined) {
      where.action = action;
    }
    if (reviewStatus !== undefined) {
      where.reviewStatus = reviewStatus;
    }
    if (requestedById !== undefined) {
      const parsedRequestedById = parsePositiveIntegerId(requestedById);
      if (!parsedRequestedById) {
        return res.status(400).json({ error: "requestedById must be a positive integer" });
      }
      where.requestedById = parsedRequestedById;
    }

    const parsedLimit = Number(req.query.limit);
    const limit =
      Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 50;
    const parsedOffset = Number(req.query.offset);
    const offset = Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

    const [total, items] = await Promise.all([
      prisma.aiInteraction.count({ where }),
      prisma.aiInteraction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          action: true,
          reviewStatus: true,
          sourceQuestionId: true,
          generatedQuestionId: true,
          createdAt: true,
          reviewedAt: true,
          aiModel: {
            select: {
              id: true,
              provider: true,
              modelName: true,
              displayName: true,
            },
          },
          requestedBy: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
    ]);

    res.json({ items, total, limit, offset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function buildPrePostInsightsPrompt(comparison) {
  return [
    "You are assisting an instructor by interpreting pre-test vs post-test results for a training.",
    "This is advisory only; the instructor makes all final decisions.",
    "",
    "Numeric comparison (averages are percentages):",
    `- Pre-test: ${comparison.preTest.attemptCount} attempts, average ${comparison.preTest.averagePercentage}%`,
    `- Post-test: ${comparison.postTest.attemptCount} attempts, average ${comparison.postTest.averagePercentage}%`,
    `- Improvement (post minus pre): ${comparison.improvement} percentage points`,
    "",
    "Write a short narrative (3-5 sentences) for the instructor that:",
    "- summarizes whether the training appears to have improved performance,",
    "- notes caveats (e.g. small attempt counts, no data),",
    "- suggests what the instructor might look into next.",
    "Do not invent numbers beyond those provided. Do not make any final decision.",
  ].join("\n");
}

const getPrePostInsights = async (req, res) => {
  try {
    const source = { ...req.query, ...req.body };
    const trainingId = parsePositiveIntegerId(source.trainingId);
    const preAssessmentId = parsePositiveIntegerId(source.preAssessmentId);
    const postAssessmentId = parsePositiveIntegerId(source.postAssessmentId);

    const requesterId = getRequesterId(req);

    if (!requesterId) {
      return res.status(400).json({ error: "Authenticated requester user is required." });
    }

    const comparison = await computePrePostComparison({
      trainingId,
      preAssessmentId,
      postAssessmentId,
    });

    const advisoryNotice =
      "Advisory only. These insights must be reviewed by an instructor before any decision.";

    // Use the active, local Ollama model from the database (per the AI rules).
    const aiModel = await prisma.aiModel.findFirst({
      where: {
        provider: AI_PROVIDERS.OLLAMA,
        isLocal: true,
        isActive: true,
      },
      orderBy: { id: "asc" },
    });

    if (!aiModel) {
      return res.json({
        advisory: true,
        notice: advisoryNotice,
        filters: { trainingId, preAssessmentId, postAssessmentId },
        comparison,
        narrative: null,
        narrativeAvailable: false,
        narrativeUnavailableReason:
          "No active local Ollama model is configured. Activate one under AI Models.",
        aiInteractionId: null,
      });
    }

    const baseUrl =
      aiModel.baseUrl || getProviderConfig(AI_PROVIDERS.OLLAMA).baseUrl;
    const prompt = buildPrePostInsightsPrompt(comparison);

    let narrative = null;
    let narrativeUnavailableReason = null;

    try {
      narrative = await generateText({
        provider: aiModel.provider,
        baseUrl,
        modelName: aiModel.modelName,
        prompt,
      });
    } catch (error) {
      narrativeUnavailableReason = `Ollama request failed: ${error.message}`;
    }

    // Log the advisory request as a PENDING AiInteraction; nothing is auto-applied.
    const aiInteraction = await prisma.aiInteraction.create({
      data: {
        aiModelId: aiModel.id,
        requestedById: requesterId,
        action: "REVIEW_TEST",
        prompt,
        resultText: narrative,
        resultJson: comparison,
        reviewStatus: "PENDING",
      },
    });

    res.json({
      advisory: true,
      notice: advisoryNotice,
      filters: { trainingId, preAssessmentId, postAssessmentId },
      comparison,
      narrative,
      narrativeAvailable: narrative !== null,
      narrativeUnavailableReason,
      aiInteractionId: aiInteraction.id,
      provider: aiModel.provider,
      model: aiModel.modelName,
      reviewStatus: aiInteraction.reviewStatus,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  generateQuestionDraft,
  suggestQuestionEquivalence,
  generateEquivalentQuestion,
  reviewAiInteraction,
  listAiInteractions,
  getPrePostInsights,
};
