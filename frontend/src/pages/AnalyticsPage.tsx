import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  getAnalyticsByTopic,
  getAnalyticsByLearningObjective,
  getAnalyticsByDifficulty,
} from "../services/analyticsService";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "../components/ui";

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

function AnalyticsTable({
  rows,
  labelHeader,
}: {
  rows: AnalyticsRow[];
  labelHeader: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No analytics data"
        description="No analytics data is available for this section yet."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="app-table min-w-[640px]">
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
                  <StatusBadge
                    status={health.label}
                    tone={
                      health.label === "Strong"
                        ? "success"
                        : health.label === "No data"
                          ? "neutral"
                          : health.label === "Critical"
                            ? "danger"
                            : "warning"
                    }
                  />
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
      <PageHeader
        eyebrow="Instructor analytics"
        title="Analytics dashboard"
        description={
          <>
            Use analytics to identify weak topics, weak learning objectives,
            difficulty gaps and problematic questions. Current backend data
            supports topic, learning objective and difficulty summaries.
          </>
        }
        actions={
          <>
          <Link
            to="/assessments"
            className="app-button-primary"
          >
            Review Assessments
          </Link>

          <Link
            to="/questions"
            className="app-button-secondary"
          >
            Review Questions
          </Link>

          <Link
            to="/trainings"
            className="app-button-secondary"
          >
            Improve Content
          </Link>
          </>
        }
      />

      {!hasAnyAnalytics && (
        <div className="mb-8">
          <EmptyState
            title="No analytics data yet"
            description="Analytics will appear after participants submit assessments. Create assessments, have participants solve them, then return here to review performance."
          />
        </div>
      )}

      <div className="grid gap-6 mb-10 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Topic analytics"
          value={topicRows.length}
          helper="Topics with submitted assessment performance."
        />

        <MetricCard
          label="Learning objectives"
          value={objectiveRows.length}
          helper="Objectives with measurable assessment outcomes."
        />

        <MetricCard
          label="Difficulty levels"
          value={difficultyRows.length}
          helper="Difficulty bands represented in analytics."
        />

        <MetricCard
          label="Question statistics"
          value="N/A"
          helper="Weakest-question data is not available from the current analytics API."
        />
      </div>

      <div className="app-card mb-10 p-6">
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

      <SectionCard
        title="Results by topic"
        description="Use this to find broad content areas where participants are struggling."
      >
        <AnalyticsTable
          rows={topicRows}
          labelHeader="Topic"
        />
      </SectionCard>

      <div className="mt-8">
      <SectionCard
        title="Results by learning objective"
        description="Use this to identify specific outcomes that need clearer instruction or better practice questions."
      >
        <AnalyticsTable
          rows={objectiveRows}
          labelHeader="Learning Objective"
        />
      </SectionCard>
      </div>

      <div className="mt-8">
      <SectionCard
        title="Results by difficulty"
        description="Use this to check whether assessments are too easy, too hard or uneven across difficulty levels."
      >
        <AnalyticsTable
          rows={difficultyRows}
          labelHeader="Difficulty"
        />
      </SectionCard>
      </div>

      <div className="mt-8">
      <SectionCard
        title="Question statistics"
        description="Weakest-question analytics would help identify individual questions that cause repeated mistakes."
      >
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="text-slate-700">
            The current frontend service only exposes analytics by topic,
            learning objective and difficulty. Question-level statistics
            are not available from the existing API.
          </p>

          <Link
            to="/questions"
            className="app-button-primary mt-4"
          >
            Go to Question Bank
          </Link>
        </div>
      </SectionCard>
      </div>
    </div>
  );
}

export default AnalyticsPage;
