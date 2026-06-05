import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getAssessmentResults } from "../services/assessmentService";

type AssessmentResults = {
  assessment: {
    id: number;
    title: string;
    type: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    training?: {
      id: number;
      title: string;
    } | null;
  };
  summary: {
    assignedParticipants?: number | null;
    submittedAttempts: number;
    averageScore?: number | null;
    averagePercentage?: number | null;
  };
  attempts: {
    id: number;
    user?: {
      id: number;
      name?: string | null;
      email?: string | null;
    } | null;
    status: string;
    score?: number | null;
    maxScore?: number | null;
    submittedAt?: string | null;
    answersCount: number;
  }[];
  questionStats?: {
    questionId: number;
    title?: string | null;
    attemptsCount: number;
    correctCount: number;
    correctRate?: number | null;
    averagePoints?: number | null;
  }[];
};

const statusBadgeClasses: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-amber-100 text-amber-800",
};

const formatNumber = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(value);
};

const formatPercentage = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return `${formatNumber(value)}%`;
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "Not submitted";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not submitted";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatScore = (
  score?: number | null,
  maxScore?: number | null
) => {
  if (score == null) {
    return "N/A";
  }

  if (maxScore == null) {
    return formatNumber(score);
  }

  return `${formatNumber(score)} / ${formatNumber(maxScore)}`;
};

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-950">
        {value}
      </p>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {helper}
      </p>
    </div>
  );
}

function AssessmentResultsPage() {
  const { id } = useParams();

  const [results, setResults] =
    useState<AssessmentResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadResults();
  }, [id]);

  const loadResults = async () => {
    try {
      setIsLoading(true);
      setError("");

      const assessmentId = Number(id);

      if (
        !Number.isInteger(assessmentId) ||
        assessmentId <= 0
      ) {
        setResults(null);
        setError("Assessment id is invalid.");
        return;
      }

      const data =
        await getAssessmentResults(assessmentId);

      setResults(data);
    } catch (loadError) {
      console.error(loadError);
      setResults(null);
      setError(
        "Failed to load assessment results. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const submittedAttempts = useMemo(
    () =>
      results?.attempts.filter(
        (attempt) => attempt.status === "SUBMITTED"
      ) || [],
    [results]
  );

  const answeredQuestionCount = useMemo(() => {
    if (!results?.questionStats) {
      return 0;
    }

    return results.questionStats.filter(
      (question) => question.attemptsCount > 0
    ).length;
  }, [results]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-950">
            Loading assessment results
          </h1>

          <p className="mt-3 text-slate-600">
            Gathering submitted attempts and question statistics...
          </p>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-10">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-700">
            Results unavailable
          </p>

          <h1 className="text-3xl font-bold text-slate-950">
            Could not load results
          </h1>

          <p className="mt-4 text-slate-700">
            {error || "This assessment result set could not be found."}
          </p>

          <Link
            to="/assessments"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
          >
            Back to Assessments
          </Link>
        </div>
      </div>
    );
  }

  const hasSubmittedAttempts = submittedAttempts.length > 0;
  const questionStats = results.questionStats || [];

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <div className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          Assessment results
        </p>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-5xl font-bold text-slate-950">
              {results.assessment.title}
            </h1>

            <p className="mt-4 text-lg leading-8 text-slate-600">
              {results.assessment.training?.title
                ? `${results.assessment.training.title} | ${results.assessment.type}`
                : results.assessment.type}
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${
              statusBadgeClasses[results.assessment.status] ||
              statusBadgeClasses.DRAFT
            }`}
          >
            {results.assessment.status}
          </span>
        </div>
      </div>

      {!hasSubmittedAttempts && (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-2xl font-semibold text-slate-950">
            No submitted results yet
          </h2>

          <p className="mt-2 text-amber-800">
            Results will appear after participants submit this assessment.
          </p>
        </div>
      )}

      <div className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Submitted attempts"
          value={results.summary.submittedAttempts}
          helper="Attempts with submitted status."
        />

        <SummaryCard
          label="Average score"
          value={formatNumber(results.summary.averageScore)}
          helper="Average across submitted attempts with scores."
        />

        <SummaryCard
          label="Average percentage"
          value={formatPercentage(results.summary.averagePercentage)}
          helper="Calculated when submitted attempts include max score."
        />

        <SummaryCard
          label="Questions answered"
          value={`${answeredQuestionCount} / ${questionStats.length}`}
          helper="Questions with at least one submitted answer."
        />
      </div>

      <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">
              Attempts
            </h2>

            <p className="mt-2 text-slate-600">
              Training assignment counts are not implemented yet, so this
              table lists recorded attempts only.
            </p>
          </div>
        </div>

        {results.attempts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-600">
            Results will appear after participants submit this assessment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b text-sm text-slate-500">
                  <th className="py-3 text-left">
                    Participant
                  </th>
                  <th className="py-3 text-left">
                    Score
                  </th>
                  <th className="py-3 text-left">
                    Status
                  </th>
                  <th className="py-3 text-left">
                    Submitted
                  </th>
                  <th className="py-3 text-left">
                    Answers
                  </th>
                  <th className="py-3 text-left">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {results.attempts.map((attempt) => (
                  <tr
                    key={attempt.id}
                    className="border-b last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="py-4 font-medium text-slate-950">
                      {attempt.user?.name ||
                        attempt.user?.email ||
                        "Unknown participant"}
                    </td>
                    <td className="py-4 text-slate-700">
                      {formatScore(attempt.score, attempt.maxScore)}
                    </td>
                    <td className="py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                        {attempt.status}
                      </span>
                    </td>
                    <td className="py-4 text-slate-700">
                      {formatDate(attempt.submittedAt)}
                    </td>
                    <td className="py-4 text-slate-700">
                      {attempt.answersCount}
                    </td>
                    <td className="py-4 text-sm text-slate-500">
                      Detail view not available yet
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {questionStats.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-slate-950">
              Question statistics
            </h2>

            <p className="mt-2 text-slate-600">
              Based on submitted answers for this assessment.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b text-sm text-slate-500">
                  <th className="py-3 text-left">
                    Question
                  </th>
                  <th className="py-3 text-left">
                    Attempts
                  </th>
                  <th className="py-3 text-left">
                    Correct
                  </th>
                  <th className="py-3 text-left">
                    Correct rate
                  </th>
                  <th className="py-3 text-left">
                    Average points
                  </th>
                </tr>
              </thead>

              <tbody>
                {questionStats.map((question) => (
                  <tr
                    key={question.questionId}
                    className="border-b last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="py-4 font-medium text-slate-950">
                      {question.title || "Untitled question"}
                    </td>
                    <td className="py-4 text-slate-700">
                      {question.attemptsCount}
                    </td>
                    <td className="py-4 text-slate-700">
                      {question.correctCount}
                    </td>
                    <td className="py-4">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                        {formatPercentage(question.correctRate)}
                      </span>
                    </td>
                    <td className="py-4 text-slate-700">
                      {formatNumber(question.averagePoints)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Link
        to="/assessments"
        className="mt-8 inline-flex rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
      >
        Back to Assessments
      </Link>
    </div>
  );
}

export default AssessmentResultsPage;
