import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getAssessmentResults } from "../services/assessmentService";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "../components/ui";

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
      <PageHeader
        eyebrow="Assessment results"
        title={results.assessment.title}
        description={
          results.assessment.training?.title
            ? `${results.assessment.training.title} | ${results.assessment.type}`
            : results.assessment.type
        }
        actions={<StatusBadge status={results.assessment.status} />}
      />

      {!hasSubmittedAttempts && (
        <div className="mb-8">
          <EmptyState
            title="No submitted results yet"
            description="Results will appear after participants submit this assessment."
          />
        </div>
      )}

      <div className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Submitted attempts"
          value={results.summary.submittedAttempts}
          helper="Attempts with submitted status."
        />

        <MetricCard
          label="Average score"
          value={formatNumber(results.summary.averageScore)}
          helper="Average across submitted attempts with scores."
        />

        <MetricCard
          label="Average percentage"
          value={formatPercentage(results.summary.averagePercentage)}
          helper="Calculated when submitted attempts include max score."
        />

        <MetricCard
          label="Questions answered"
          value={`${answeredQuestionCount} / ${questionStats.length}`}
          helper="Questions with at least one submitted answer."
        />
      </div>

      <SectionCard
        title="Attempts"
        description="Training assignment counts are not implemented yet, so this table lists recorded attempts only."
      >
        {results.attempts.length === 0 ? (
          <EmptyState
            title="No attempts recorded"
            description="Results will appear after participants submit this assessment."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table min-w-[760px]">
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
                      <StatusBadge status={attempt.status} />
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
      </SectionCard>

      {questionStats.length > 0 && (
        <div className="mt-8">
          <SectionCard
            title="Question statistics"
            description="Based on submitted answers for this assessment."
          >

          <div className="overflow-x-auto">
            <table className="app-table min-w-[760px]">
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
          </SectionCard>
        </div>
      )}

      <Link
        to="/assessments"
        className="app-button-secondary mt-8"
      >
        Back to Assessments
      </Link>
    </div>
  );
}

export default AssessmentResultsPage;
