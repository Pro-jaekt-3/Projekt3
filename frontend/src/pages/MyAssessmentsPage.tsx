import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAvailableAssessments } from "../services/assessmentService";
import { EmptyState, PageHeader, StatusBadge } from "../components/ui";

type Assessment = {
  id: number;
  title: string;
  description?: string | null;
  type: string;
};

function MyAssessmentsPage() {
  const [assessments, setAssessments] =
    useState<Assessment[]>([]);

  useEffect(() => {
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    try {
      const data = await getAvailableAssessments();

      setAssessments(data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <PageHeader
        eyebrow="Participant assessment flow"
        title="My Assessments"
        description={
          <>
            Assessments available to you. Start an assessment when you are
            ready to submit an attempt.
          </>
        }
      />

      <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This MVP shows published assessments. Specific participant
          assignment is planned next.
      </div>

      {assessments.length === 0 ? (
        <EmptyState
          title="No assessments available"
          description="There are no published assessments ready for you yet."
        />
      ) : (
        <div className="grid gap-6">
          {assessments.map(
            (assessment) => (
              <div
                key={assessment.id}
                className="app-card p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">
                      {assessment.title}
                    </h2>

                    {assessment.description && (
                      <p className="text-gray-600 mt-2">
                        {
                          assessment.description
                        }
                      </p>
                    )}
                  </div>

                  <StatusBadge status={assessment.type} tone="primary" />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    to={`/solve-assessment/${assessment.id}`}
                    className="app-button-success"
                  >
                    Start Assessment
                  </Link>

                  <span className="text-sm text-slate-500">
                    Opens the solving page and starts an attempt.
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default MyAssessmentsPage;
