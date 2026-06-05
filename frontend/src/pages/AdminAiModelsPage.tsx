import { useEffect, useState } from "react";

import { getAiModels } from "../services/aiService";
import { EmptyState, PageHeader, SectionCard, StatusBadge } from "../components/ui";

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

function AdminAiModelsPage() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadModels = async () => {
      try {
        setError("");
        setModels(await getAiModels());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load AI models.");
      }
    };

    loadModels();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <PageHeader
        eyebrow="Admin AI"
        title="AI Models"
        description="Read-only overview of configured AI models. Model creation, secrets and live testing are intentionally not exposed in this MVP."
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
        title="Configured models"
        description="The frontend displays model metadata only. API keys and provider secrets are never sent to the client."
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

                <button type="button" disabled className="app-button-secondary mt-5 w-full opacity-50">
                  Test Model Coming Soon
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
