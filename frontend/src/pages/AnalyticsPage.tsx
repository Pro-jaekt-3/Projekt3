import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  getAnalyticsByTopic,
  getAnalyticsByLearningObjective,
  getAnalyticsByDifficulty,
} from "../services/analyticsService";

type TopicAnalytics = {
  topicId?: number | string;
  topicTitle?: string;
  attemptCount?: number;
  percentage?: number | string;
};

type ObjectiveAnalytics = {
  learningObjectiveId?: number | string;
  learningObjectiveTitle?: string;
  attemptCount?: number;
  percentage?: number | string;
};

type DifficultyAnalytics = {
  difficulty?: number | string;
  attemptCount?: number;
  percentage?: number | string;
};

type AnalyticsRow = {
  id: string;
  label: string;
  attempts?: number;
  percentage?: number | string;
};

function toPercentage(value?: number | string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function getHealthLabel(percentage?: number | string) {
  const value = toPercentage(percentage);

  if (value === null) {
    return {
      label: "No data",
      className: "bg-slate-100 text-slate-600",
    };
  }

  if (value < 50) {
    return {
      label: "Critical",
      className: "bg-red-100 text-red-700",
    };
  }

  if (value < 75) {
    return {
      label: "Needs attention",
      className: "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "Strong",
    className: "bg-emerald-100 text-emerald-700",
  };
}

function formatPercentage(value?: number | string) {
  const percentage = toPercentage(value);

  if (percentage === null) {
    return "N/A";
  }

  return `${Math.round(percentage)}%`;
}

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
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <h2 className="mt-2 text-4xl font-bold text-slate-950">
        {value}
      </h2>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {helper}
      </p>
    </div>
  );
}

function EmptySection({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
      {message}
    </div>
  );
}

function AnalyticsTable({
  rows,
  labelHeader,
}: {
  rows: AnalyticsRow[];
  labelHeader: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptySection message="No analytics data is available for this section yet." />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b text-sm text-gray-500">
            <th className="text-left py-3">
              {labelHeader}
            </th>

            <th className="text-left py-3">
              Attempts
            </th>

            <th className="text-left py-3">
              Success Rate
            </th>

            <th className="text-left py-3">
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const health =
              getHealthLabel(row.percentage);

            return (
              <tr
                key={row.id}
                className="border-b last:border-b-0 hover:bg-gray-50 transition"
              >
                <td className="py-4 font-medium text-slate-950">
                  {row.label}
                </td>

                <td className="py-4 text-slate-600">
                  {row.attempts ?? "N/A"}
                </td>

                <td className="py-4">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                    {formatPercentage(row.percentage)}
                  </span>
                </td>

                <td className="py-4">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${health.className}`}>
                    {health.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsPage() {
  const [topics, setTopics] = useState<TopicAnalytics[]>([]);
  const [objectives, setObjectives] =
    useState<ObjectiveAnalytics[]>([]);
  const [difficulties, setDifficulties] =
    useState<DifficultyAnalytics[]>([]);
  const [isLoading, setIsLoading] =
    useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    setError("");

    try {
      const topicsData =
        await getAnalyticsByTopic();

      const objectivesData =
        await getAnalyticsByLearningObjective();

      const difficultyData =
        await getAnalyticsByDifficulty();

      setTopics(topicsData);
      setObjectives(objectivesData);
      setDifficulties(difficultyData);
    } catch (loadError) {
      console.error(loadError);
      setError(
        "Failed to load analytics. Check the API connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const topicRows = useMemo(
    () =>
      topics.map((topic, index) => ({
        id: String(topic.topicId ?? index),
        label: topic.topicTitle || "Untitled topic",
        attempts: topic.attemptCount,
        percentage: topic.percentage,
      })),
    [topics]
  );

  const objectiveRows = useMemo(
    () =>
      objectives.map((objective, index) => ({
        id: String(
          objective.learningObjectiveId ?? index
        ),
        label:
          objective.learningObjectiveTitle ||
          "Untitled learning objective",
        attempts: objective.attemptCount,
        percentage: objective.percentage,
      })),
    [objectives]
  );

  const difficultyRows = useMemo(
    () =>
      difficulties.map((difficulty, index) => ({
        id: String(difficulty.difficulty ?? index),
        label: `Difficulty ${difficulty.difficulty ?? "N/A"}`,
        attempts: difficulty.attemptCount,
        percentage: difficulty.percentage,
      })),
    [difficulties]
  );

  const allRows = [
    ...topicRows,
    ...objectiveRows,
    ...difficultyRows,
  ];

  const weakAreaCount = allRows.filter((row) => {
    const percentage = toPercentage(row.percentage);

    return percentage !== null && percentage < 75;
  }).length;

  const hasAnyAnalytics =
    topicRows.length > 0 ||
    objectiveRows.length > 0 ||
    difficultyRows.length > 0;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-950">
            Loading analytics
          </h1>

          <p className="mt-3 text-slate-600">
            Gathering assessment performance data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8">
          <h1 className="text-3xl font-bold text-slate-950">
            Analytics unavailable
          </h1>

          <p className="mt-3 text-red-700">
            {error}
          </p>

          <button
            type="button"
            onClick={loadAnalytics}
            className="mt-5 rounded-lg bg-red-700 px-5 py-3 font-medium text-white transition hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          Instructor analytics
        </p>

        <h1 className="text-5xl font-bold mb-4">
          Analytics dashboard
        </h1>

        <p className="max-w-4xl text-lg leading-8 text-slate-600">
          Use analytics to identify weak topics, weak learning objectives,
          difficulty gaps and problematic questions. Current backend data
          supports topic, learning objective and difficulty summaries.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/assessments"
            className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
          >
            Review Assessments
          </Link>

          <Link
            to="/questions"
            className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Review Questions
          </Link>

          <Link
            to="/trainings"
            className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Improve Content
          </Link>
        </div>
      </div>

      {!hasAnyAnalytics && (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-2xl font-semibold text-slate-950">
            No analytics data yet
          </h2>

          <p className="mt-2 max-w-3xl text-amber-800">
            Analytics will appear after participants submit assessments.
            Create assessments, have participants solve them, then return
            here to review performance.
          </p>
        </div>
      )}

      <div className="grid gap-6 mb-10 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Topic analytics"
          value={topicRows.length}
          helper="Topics with submitted assessment performance."
        />

        <SummaryCard
          label="Learning objectives"
          value={objectiveRows.length}
          helper="Objectives with measurable assessment outcomes."
        />

        <SummaryCard
          label="Difficulty levels"
          value={difficultyRows.length}
          helper="Difficulty bands represented in analytics."
        />

        <SummaryCard
          label="Question statistics"
          value="N/A"
          helper="Weakest-question data is not available from the current analytics API."
        />
      </div>

      <div className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">
          Recommended next action
        </h2>

        <p className="mt-3 text-slate-600">
          {weakAreaCount > 0
            ? `${weakAreaCount} analytics area${weakAreaCount === 1 ? "" : "s"} need attention. Review the weakest topics and objectives, then update related questions or training content.`
            : hasAnyAnalytics
              ? "Current analytics look strong. Keep monitoring after the next assessment submissions."
              : "Create assessments and collect participant submissions before making analytics-driven content changes."}
        </p>
      </div>

      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">
            Results by topic
          </h2>

          <p className="mt-2 text-slate-600">
            Use this to find broad content areas where participants are
            struggling.
          </p>
        </div>

        <AnalyticsTable
          rows={topicRows}
          labelHeader="Topic"
        />
      </section>

      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">
            Results by learning objective
          </h2>

          <p className="mt-2 text-slate-600">
            Use this to identify specific outcomes that need clearer
            instruction or better practice questions.
          </p>
        </div>

        <AnalyticsTable
          rows={objectiveRows}
          labelHeader="Learning Objective"
        />
      </section>

      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">
            Results by difficulty
          </h2>

          <p className="mt-2 text-slate-600">
            Use this to check whether assessments are too easy, too hard
            or uneven across difficulty levels.
          </p>
        </div>

        <AnalyticsTable
          rows={difficultyRows}
          labelHeader="Difficulty"
        />
      </section>

      <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">
            Question statistics
          </h2>

          <p className="mt-2 text-slate-600">
            Weakest-question analytics would help identify individual
            questions that cause repeated mistakes.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="text-slate-700">
            The current frontend service only exposes analytics by topic,
            learning objective and difficulty. Question-level statistics
            are not available from the existing API.
          </p>

          <Link
            to="/questions"
            className="mt-4 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
          >
            Go to Question Bank
          </Link>
        </div>
      </section>
    </div>
  );
}

export default AnalyticsPage;
