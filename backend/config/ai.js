const AI_PROVIDERS = Object.freeze({
  OLLAMA: "OLLAMA",
  OPENAI: "OPENAI",
  DEEPSEEK: "DEEPSEEK",
  OTHER: "OTHER",
});

const DEFAULT_PROVIDER = AI_PROVIDERS.OLLAMA;
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_LOCAL_MODEL = "qwen3:8b";

function readEnv(name, fallback = undefined) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function normalizeProvider(provider) {
  const normalized = String(provider || DEFAULT_PROVIDER).trim().toUpperCase();
  return AI_PROVIDERS[normalized] || DEFAULT_PROVIDER;
}

function buildProviderConfigs() {
  return {
    [AI_PROVIDERS.OLLAMA]: {
      provider: AI_PROVIDERS.OLLAMA,
      baseUrl: readEnv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL),
      apiKey: undefined,
      isLocal: true,
    },
    [AI_PROVIDERS.OPENAI]: {
      provider: AI_PROVIDERS.OPENAI,
      baseUrl: readEnv("OPENAI_BASE_URL"),
      apiKey: readEnv("OPENAI_API_KEY"),
      isLocal: false,
    },
    [AI_PROVIDERS.DEEPSEEK]: {
      provider: AI_PROVIDERS.DEEPSEEK,
      baseUrl: readEnv("DEEPSEEK_BASE_URL"),
      apiKey: readEnv("DEEPSEEK_API_KEY"),
      isLocal: false,
    },
    [AI_PROVIDERS.OTHER]: {
      provider: AI_PROVIDERS.OTHER,
      baseUrl: readEnv("AI_OTHER_BASE_URL"),
      apiKey: readEnv("AI_OTHER_API_KEY"),
      isLocal: false,
    },
  };
}

function getProviderConfig(provider) {
  const providerConfigs = buildProviderConfigs();
  return providerConfigs[normalizeProvider(provider)];
}

function getDefaultAiModelConfig() {
  const provider = normalizeProvider(
    readEnv("AI_DEFAULT_PROVIDER", readEnv("AI_PROVIDER", DEFAULT_PROVIDER))
  );
  const providerConfig = getProviderConfig(provider);

  return {
    provider,
    modelName: readEnv("AI_DEFAULT_MODEL"),
    providerConfig,
  };
}

function getAiConfig() {
  return {
    providers: buildProviderConfigs(),
    defaultModel: getDefaultAiModelConfig(),
  };
}

// TODO: Later AI endpoint issues should select the active AiModel from the database.
module.exports = {
  AI_PROVIDERS,
  DEFAULT_LOCAL_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  getAiConfig,
  getProviderConfig,
  getDefaultAiModelConfig,
};
