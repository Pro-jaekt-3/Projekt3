import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAssessments } from "../services/assessmentService";
import { EmptyState, PageHeader, SectionCard, StatusBadge } from "../components/ui";

type Assessment = {
  id: number;
  title: string;
  description?: string | null;
  type: string;
  status?: string;
  training?: {
    id: number;
    title: string;
  };
  trainingId?: number;
  questions?: unknown[];
};

function AdminAssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAssessments = async () => {
      try {
        setError("");
        setAssessments(await getAssessments());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load assessments.");
      }
    };

    loadAssessments();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <PageHeader
        eyebrow="Admin delivery"
        title="All Assessments"
        description="Admin view over draft, published and archived assessments using the real assessment API."
        actions={
          <Link to="/assessments" className="app-button-primary">
            Manage Assessments
          </Link>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <SectionCard title="Assessment inventory" description={`${assessments.length} assessment${assessments.length === 1 ? "" : "s"} found.`}>
        {assessments.length === 0 ? (
          <EmptyState
            title="No assessments"
            description="Create a draft assessment from approved questions before publishing."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table min-w-[760px]">
              <thead>
                <tr>
                  <th className="text-left">Assessment</th>
                  <th className="text-left">Training</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Questions</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>
                      <div className="font-semibold text-slate-950">{assessment.title}</div>
                      <div className="text-sm text-slate-500">{assessment.description || "No description"}</div>
                    </td>
                    <td className="text-slate-600">
                      {assessment.training?.title || (assessment.trainingId ? `Training ${assessment.trainingId}` : "N/A")}
                    </td>
                    <td><StatusBadge status={assessment.type} tone="primary" /></td>
                    <td><StatusBadge status={assessment.status || "DRAFT"} /></td>
                    <td className="text-slate-600">{assessment.questions?.length || 0}</td>
                    <td className="text-right">
                      <Link to={`/assessments/${assessment.id}/results`} className="app-button-secondary">
                        View Results
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

export default AdminAssessmentsPage;
