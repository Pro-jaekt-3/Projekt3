import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getTrainings } from "../services/trainingService";
import { EmptyState, PageHeader, SectionCard } from "../components/ui";

type Training = {
  id: number;
  title: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function AdminTrainingsPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTrainings = async () => {
      try {
        setError("");
        setTrainings(await getTrainings());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load trainings.");
      }
    };

    loadTrainings();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <PageHeader
        eyebrow="Admin content"
        title="All Trainings"
        description="Admin view over every training workspace backed by the real trainings API."
        actions={
          <Link to="/trainings" className="app-button-primary">
            Manage Trainings
          </Link>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionCard title="Training inventory" description={`${trainings.length} training workspace${trainings.length === 1 ? "" : "s"} found.`}>
        {trainings.length === 0 ? (
          <EmptyState
            title="No trainings"
            description="Create trainings from the main training management flow."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table min-w-[720px]">
              <thead>
                <tr>
                  <th className="text-left">Training</th>
                  <th className="text-left">Description</th>
                  <th className="text-left">Updated</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {trainings.map((training) => (
                  <tr key={training.id}>
                    <td className="font-semibold text-slate-950">{training.title}</td>
                    <td className="max-w-xl text-slate-600">{training.description || "No description"}</td>
                    <td className="text-slate-600">
                      {training.updatedAt ? new Date(training.updatedAt).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="text-right">
                      <Link to={`/trainings/${training.id}`} className="app-button-secondary">
                        Open Workspace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default AdminTrainingsPage;
