import { useEffect, useState } from "react";

import {
  getAiModels,
  getOllamaStatus,
  testAiModel,
} from "../services/aiService";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "../components/ui";

type AiModel = {
  id: number;
  provider: string;
  modelName: string;
  displayName?: string | null;
  baseUrl?: string | null;
  isLocal: boolean;
  isActive: boolean;
  updatedAt?: string;
};

type OllamaStatus = {
  reachable: boolean;
  baseUrl: string;
  models: string[];
  configuredDefaultModel?: string;
  activeDatabaseModels: AiModel[];
  error?: string;
};

type TestResult = {
  message: string;
  tone: "success" | "error";
};

function AdminAiModelsPage() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [ollamaStatus, setOllamaStatus] =
    useState<OllamaStatus | null>(null);
  const [error, setError] = useState("");
  const [testResults, setTestResults] = useState<
    Record<number, TestResult>
  >({});
  const [testingModelId, setTestingModelId] =
    useState<number | null>(null);

  useEffect(() => {
    const loadAiState = async () => {
      try {
        setError("");
        const [modelData, statusData] = await Promise.all([
          getAiModels(),
          getOllamaStatus(),
        ]);

        setModels(modelData);
        setOllamaStatus(statusData);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load AI models.");
      }
    };

    loadAiState();
  }, []);

  const handleTestModel = async (model: AiModel) => {
    try {
      setTestingModelId(model.id);
      setTestResults((current) => ({
        ...current,
        [model.id]: {
          tone: "success",
          message: "Testing model...",
        },
      }));

      const result = await testAiModel(model.id);

      setTestResults((current) => ({
        ...current,
        [model.id]: {
          tone: "success",
          message: `Success: ${result.responsePreview || "Model responded."}`,
        },
      }));
    } catch (testError) {
      setTestResults((current) => ({
        ...current,
        [model.id]: {
          tone: "error",
          message:
            testError instanceof Error
              ? testError.message
              : "AI model test failed.",
        },
      }));
    } finally {
      setTestingModelId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <PageHeader
        eyebrow="Admin AI"
        title="AI Models"
        description="Local AI readiness for the MVP. Only Ollama generation is implemented; AI output remains review-only."
        actions={
          <button type="button" disabled className="app-button-primary opacity-50">
            Add Model
          </button>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionCard
        title="Ollama status"
        description="Checks the local Ollama service configured for backend AI generation."
      >
        {!ollamaStatus ? (
          <EmptyState
            title="Ollama status unavailable"
            description="The status endpoint has not returned data yet."
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="app-card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">
                    {ollamaStatus.reachable
                      ? "Ollama reachable"
                      : "Ollama not reachable"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {ollamaStatus.baseUrl}
                  </p>
                </div>
                <StatusBadge
                  status={ollamaStatus.reachable ? "Reachable" : "Offline"}
                  tone={ollamaStatus.reachable ? "success" : "danger"}
                />
              </div>

              <div className="grid gap-2 text-sm text-slate-600">
                <p>
                  <strong>Configured default:</strong>{" "}
                  {ollamaStatus.configuredDefaultModel || "Not set"}
                </p>
                <p>
                  <strong>Active DB Ollama models:</strong>{" "}
                  {ollamaStatus.activeDatabaseModels.length}
                </p>
              </div>

              {ollamaStatus.activeDatabaseModels.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {ollamaStatus.activeDatabaseModels.map((model) => (
                    <span
                      key={model.id}
                      className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"
                    >
                      {model.modelName}
                    </span>
                  ))}
                </div>
              )}

              {ollamaStatus.error && (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {ollamaStatus.error}
                </p>
              )}
            </div>

            <div className="app-card p-5">
              <h2 className="text-xl font-bold text-slate-950">
                Local models returned by Ollama
              </h2>
              {ollamaStatus.models.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  No local models were returned by Ollama.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {ollamaStatus.models.map((modelName) => (
                    <span
                      key={modelName}
                      className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                    >
                      {modelName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <div className="my-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Only Ollama generation is implemented in this MVP. OpenAI, DeepSeek
        and other providers can be listed as metadata but cannot generate
        suggestions yet.
      </div>

      <SectionCard
        title="Configured models"
        description="API keys and provider secrets are never sent to the client. Use Test for active local Ollama models."
      >
        {models.length === 0 ? (
          <EmptyState
            title="No AI models configured"
            description="Seed or configure AiModel records before using contextual AI draft and equivalence endpoints."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {models.map((model) => (
              <div key={model.id} className="app-card p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">
                      {model.displayName || model.modelName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {model.provider} / {model.modelName}
                    </p>
                  </div>
                  <StatusBadge status={model.isActive ? "Active" : "Disabled"} />
                </div>

                <div className="grid gap-2 text-sm text-slate-600">
                  <p>
                    <strong>Runtime:</strong> {model.isLocal ? "Local" : "Remote"}
                  </p>
                  <p>
                    <strong>Base URL:</strong> {model.baseUrl || "Not exposed"}
                  </p>
                  <p>
                    <strong>Updated:</strong>{" "}
                    {model.updatedAt ? new Date(model.updatedAt).toLocaleDateString() : "N/A"}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge
                    status={model.isLocal ? "Local" : "Cloud"}
                    tone={model.isLocal ? "success" : "primary"}
                  />
                  <StatusBadge status={model.provider} tone="primary" />
                </div>

                {testResults[model.id] && (
                  <p
                    className={`mt-4 rounded-lg border p-3 text-sm ${
                      testResults[model.id].tone === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {testResults[model.id].message}
                  </p>
                )}

                <button
                  type="button"
                  disabled={
                    testingModelId === model.id ||
                    !model.isActive ||
                    model.provider !== "OLLAMA"
                  }
                  onClick={() => handleTestModel(model)}
                  className="app-button-secondary mt-5 w-full disabled:opacity-50"
                >
                  {testingModelId === model.id ? "Testing..." : "Test Model"}
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default AdminAiModelsPage;
