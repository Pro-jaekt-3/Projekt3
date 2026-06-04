import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAssessments } from "../services/assessmentService";

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
      const data = await getAssessments();

      setAssessments(data);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <div className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          Participant assessment flow
        </p>

        <h1 className="text-5xl font-bold mb-4">
          My assessments
        </h1>

        <p className="max-w-3xl text-lg leading-8 text-slate-600">
          Start an available assessment from this page. Progress and
          completed-result grouping will be added when the API exposes
          attempt status for the current participant.
        </p>
      </div>

      {assessments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">
            No assessments available
          </h2>

          <p className="mt-2 text-slate-600">
            There are no assessments ready for you yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {assessments.map(
            (assessment) => (
              <div
                key={assessment.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
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

                  <span className="w-fit bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                    {assessment.type}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link
                    to={`/solve-assessment/${assessment.id}`}
                    className="inline-block bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg transition"
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
