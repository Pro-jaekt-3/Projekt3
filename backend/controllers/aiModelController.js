const prisma = require("../prisma/client");
const { AI_PROVIDERS, getProviderConfig } = require("../config/ai");
const {
  fetchOllamaTags,
  generateWithOllama,
  isModelInstalled,
} = require("../lib/ollama");

const VALID_PROVIDERS = Object.values(AI_PROVIDERS);

const AI_MODEL_SELECT = {
  id: true,
  provider: true,
  modelName: true,
  displayName: true,
  isLocal: true,
  isActive: true,
  baseUrl: true,
  createdAt: true,
  updatedAt: true,
};

const parsePositiveIntegerId = (value) => {
  const parsedId = Number(value);
  return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
};

const resolveOllamaBaseUrl = (model) =>
  (model && model.baseUrl) || getProviderConfig(AI_PROVIDERS.OLLAMA).baseUrl;

const listAiModels = async (req, res) => {
  try {
    const models = await prisma.aiModel.findMany({
      select: AI_MODEL_SELECT,
      orderBy: [{ provider: "asc" }, { modelName: "asc" }],
    });

    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createAiModel = async (req, res) => {
  try {
    const { provider, modelName, displayName, baseUrl, isLocal, isActive } = req.body;

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        error: `provider is required and must be one of: ${VALID_PROVIDERS.join(", ")}`,
      });
    }

    if (!modelName || String(modelName).trim() === "") {
      return res.status(400).json({ error: "modelName is required" });
    }

    const model = await prisma.aiModel.create({
      data: {
        provider,
        modelName: String(modelName).trim(),
        displayName: displayName ?? null,
        baseUrl: baseUrl ?? null,
        ...(isLocal !== undefined ? { isLocal: Boolean(isLocal) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
      select: AI_MODEL_SELECT,
    });

    res.status(201).json(model);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "An AI model with this provider and modelName already exists",
      });
    }
    res.status(500).json({ error: error.message });
  }
};

const updateAiModel = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid AiModel id" });
    }

    const { provider, modelName, displayName, baseUrl, isLocal, isActive } = req.body;

    if (provider !== undefined && !VALID_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}`,
      });
    }

    if (modelName !== undefined && String(modelName).trim() === "") {
      return res.status(400).json({ error: "modelName cannot be empty" });
    }

    const existing = await prisma.aiModel.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: "AiModel not found" });
    }

    const updated = await prisma.aiModel.update({
      where: { id },
      data: {
        ...(provider !== undefined ? { provider } : {}),
        ...(modelName !== undefined ? { modelName: String(modelName).trim() } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(baseUrl !== undefined ? { baseUrl } : {}),
        ...(isLocal !== undefined ? { isLocal: Boolean(isLocal) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
      select: AI_MODEL_SELECT,
    });

    res.json(updated);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "An AI model with this provider and modelName already exists",
      });
    }
    res.status(500).json({ error: error.message });
  }
};

const deleteAiModel = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid AiModel id" });
    }

    const existing = await prisma.aiModel.findUnique({ where: { id } });

    if (!existing) {
      return res.status(404).json({ error: "AiModel not found" });
    }

    const interactionCount = await prisma.aiInteraction.count({
      where: { aiModelId: id },
    });

    if (interactionCount > 0) {
      return res.status(409).json({
        error: `Cannot delete AI model: it is referenced by ${interactionCount} AI interaction(s). Deactivate it instead (isActive: false).`,
      });
    }

    await prisma.aiModel.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(409).json({
        error: "Cannot delete AI model: it is referenced by existing AI interactions.",
      });
    }
    res.status(500).json({ error: error.message });
  }
};

const testAiModel = async (req, res) => {
  try {
    const id = parsePositiveIntegerId(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid AiModel id" });
    }

    const model = await prisma.aiModel.findUnique({ where: { id } });

    if (!model) {
      return res.status(404).json({ error: "AiModel not found" });
    }

    if (model.provider !== AI_PROVIDERS.OLLAMA) {
      return res.status(501).json({
        error: `Testing provider ${model.provider} is not implemented. Only OLLAMA models can be tested.`,
      });
    }

    const baseUrl = resolveOllamaBaseUrl(model);

    let tags;
    try {
      tags = await fetchOllamaTags(baseUrl);
    } catch (error) {
      // Reachability is the thing being tested, so report it as a result (200), not a 5xx.
      return res.json({
        ok: false,
        message: `Ollama is not reachable at ${baseUrl}: ${error.message}`,
      });
    }

    if (!isModelInstalled(tags, model.modelName)) {
      return res.json({
        ok: false,
        message: `Model "${model.modelName}" is not installed on Ollama. Run: ollama pull ${model.modelName}`,
      });
    }

    try {
      const sample = await generateWithOllama({
        baseUrl,
        modelName: model.modelName,
        prompt: "Reply with the single word: OK",
        options: { num_predict: 8 },
        timeoutMs: 30000,
      });

      return res.json({
        ok: true,
        message: `Model "${model.modelName}" is installed and responded.`,
        sample: sample.trim().slice(0, 200),
      });
    } catch (error) {
      return res.json({
        ok: false,
        message: `Model "${model.modelName}" is installed but generation failed: ${error.message}`,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getOllamaStatus = async (req, res) => {
  const baseUrl = getProviderConfig(AI_PROVIDERS.OLLAMA).baseUrl;

  try {
    const tags = await fetchOllamaTags(baseUrl);

    res.json({
      reachable: true,
      baseUrl,
      models: tags.map((tag) => tag.name || tag.model).filter(Boolean),
    });
  } catch (error) {
    // Keep 200 so the UI can render an "offline" status instead of an error page.
    res.json({
      reachable: false,
      baseUrl,
      models: [],
      message: error.message,
    });
  }
};

module.exports = {
  listAiModels,
  createAiModel,
  updateAiModel,
  deleteAiModel,
  testAiModel,
  getOllamaStatus,
};
