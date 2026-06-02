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
      <h1 className="text-5xl font-bold mb-10">
        My Assessments
      </h1>

      <div className="grid gap-6">
        {assessments.map(
          (assessment) => (
            <div
              key={assessment.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex justify-between items-start mb-4">
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

                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                  {assessment.type}
                </span>
              </div>

              <Link
                to={`/solve-assessment/${assessment.id}`}
                className="inline-block bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg transition"
              >
                Start Assessment
              </Link>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default MyAssessmentsPage;