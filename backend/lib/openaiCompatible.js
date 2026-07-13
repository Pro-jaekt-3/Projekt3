// Shared helper for talking to any OpenAI-compatible /chat/completions endpoint
// (OpenAI, DeepSeek, ...). Mirrors ollama.js's contract: returns a plain string.

const DEFAULT_GENERATE_TIMEOUT_MS = 120000;

function resolveGenerateTimeoutMs(timeoutMs) {
  return timeoutMs && timeoutMs > 0 ? timeoutMs : DEFAULT_GENERATE_TIMEOUT_MS;
}

const normalizeBaseUrl = (baseUrl) => String(baseUrl || "").replace(/\/$/, "");

async function generateWithOpenAiCompatible({ baseUrl, apiKey, modelName, prompt, timeoutMs }) {
  if (!apiKey) {
    throw new Error("Missing API key for OpenAI-compatible provider request.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveGenerateTimeoutMs(timeoutMs));

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`OpenAI-compatible provider returned ${response.status}: ${responseText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  generateWithOpenAiCompatible,
};
