// Shared helpers for talking to a local Ollama server.
// Kept provider-agnostic and small; controllers decide status codes/logging.

// Quick reachability checks (models list, status) keep a short timeout so they stay snappy.
const DEFAULT_OLLAMA_TAGS_TIMEOUT_MS = 15000;

// Real structured generation on slow local models can take well over a minute; default
// generously and let OLLAMA_TIMEOUT_MS override for even slower hardware/models.
const DEFAULT_OLLAMA_GENERATE_TIMEOUT_MS = 120000;

function resolveGenerateTimeoutMs(timeoutMs) {
  if (timeoutMs) {
    return timeoutMs;
  }

  const envValue = Number(process.env.OLLAMA_TIMEOUT_MS);
  return Number.isFinite(envValue) && envValue > 0 ? envValue : DEFAULT_OLLAMA_GENERATE_TIMEOUT_MS;
}

const normalizeBaseUrl = (baseUrl) => String(baseUrl || "").replace(/\/$/, "");

async function fetchOllamaTags(baseUrl, { timeoutMs = DEFAULT_OLLAMA_TAGS_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/tags`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data.models) ? data.models : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithOllama({ baseUrl, modelName, prompt, options, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveGenerateTimeoutMs(timeoutMs));

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        prompt,
        stream: false,
        ...(options ? { options } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Ollama returned ${response.status}: ${responseText}`);
    }

    const data = await response.json();
    return data.response || "";
  } finally {
    clearTimeout(timeout);
  }
}

// Ollama tags use "name" like "qwen3:8b"; treat a bare name without ":" as matching ":latest".
function isModelInstalled(tags, modelName) {
  if (!modelName) {
    return false;
  }

  const wanted = modelName.includes(":") ? modelName : `${modelName}:latest`;

  return tags.some((tag) => {
    const name = tag?.name || tag?.model;
    if (!name) {
      return false;
    }
    return name === modelName || name === wanted;
  });
}

module.exports = {
  fetchOllamaTags,
  generateWithOllama,
  isModelInstalled,
};
