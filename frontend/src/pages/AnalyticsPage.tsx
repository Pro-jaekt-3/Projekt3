import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  getAnalyticsByTopic,
  getAnalyticsByLearningObjective,
  getAnalyticsByDifficulty,
  getPrePostSeries,
  getPrePostSeriesDetail,
} from "../services/analyticsService";
import { generatePrePostInsights } from "../services/aiService";
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

type PrePostSeries = {
  id: number;
  title: string;
  training?: {
    title?: string;
  };
  seriesKey?: string;
  participantCount: number;
  averagePreScore: number;
  averagePostScore: number;
  averageImprovement: number;
};

type ComparisonRow = {
  id: string;
  label: string;
  prePercentage: number;
  postPercentage: number;
  improvement: number;
};

type PrePostDetail = {
  series: {
    id: number;
    title: string;
    training?: {
      title?: string;
    };
  };
  preAssessment: {
    title: string;
  };
  postAssessment: {
    title: string;
  };
  summary: {
    participantCount: number;
    averagePreScore: number;
    averagePostScore: number;
    averageImprovement: number;
    averagePrePercentage: number;
    averagePostPercentage: number;
    averagePercentageImprovement: number;
    strongestTopic?: string | null;
    weakestPreTopic?: string | null;
    mostImprovedTopic?: string | null;
  };
  participants: Array<{
    userId: number;
    name: string;
    email: string;
    preScore: number;
    postScore: number;
    improvement: number;
    prePercentage: number;
    postPercentage: number;
    status: string;
  }>;
  byTopic: Array<{
    topicId: number;
    topicName: string;
    prePercentage: number;
    postPercentage: number;
    improvement: number;
  }>;
  byLearningObjective: Array<{
    learningObjectiveId: number;
    title: string;
    prePercentage: number;
    postPercentage: number;
    improvement: number;
  }>;
  byDifficulty: Array<{
    difficulty: number;
    prePercentage: number;
    postPercentage: number;
    improvement: number;
  }>;
};

type AiInsight = {
  aiInteractionId: number;
  model: string;
  reviewStatus: string;
  insightsText: string;
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

function formatPercentage(value?: number | string) {
  const percentage = toPercentage(value);

  if (percentage === null) {
    return "N/A";
  }

  return `${Math.round(percentage)}%`;
}

function formatSigned(value?: number | string) {
  const parsed = toPercentage(value);

  if (parsed === null) {
    return "N/A";
  }

  return `${parsed > 0 ? "+" : ""}${Math.round(parsed)}`;
}

function getHealthLabel(percentage?: number | string) {
  const value = toPercentage(percentage);

  if (value === null) {
    return {
      label: "No data",
      tone: "neutral" as const,
    };
  }

  if (value < 50) {
    return {
      label: "Critical",
      tone: "danger" as const,
    };
  }

  if (value < 75) {
    return {
      label: "Needs attention",
      tone: "warning" as const,
    };
  }

  return {
    label: "Strong",
    tone: "success" as const,
  };
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
            <th className="text-left py-3">{labelHeader}</th>
            <th className="text-left py-3">Attempts</th>
            <th className="text-left py-3">Success Rate</th>
            <th className="text-left py-3">Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const health = getHealthLabel(row.percentage);

            return (
              <tr
                key={row.id}
                className="border-b last:border-b-0 hover:bg-gray-50 transition"
              >
                <td className="py-4 font-medium text-slate-950">{row.label}</td>
                <td className="py-4 text-slate-600">{row.attempts ?? "N/A"}</td>
                <td className="py-4">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                    {formatPercentage(row.percentage)}
                  </span>
                </td>
                <td className="py-4">
                  <StatusBadge status={health.label} tone={health.tone} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonTable({
  rows,
  labelHeader,
}: {
  rows: ComparisonRow[];
  labelHeader: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No comparison data"
        description="No linked pre/post comparison data is available for this section."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="app-table min-w-[720px]">
        <thead>
          <tr className="border-b text-sm text-gray-500">
            <th className="text-left py-3">{labelHeader}</th>
            <th className="text-left py-3">Pre-test</th>
            <th className="text-left py-3">Post-test</th>
            <th className="text-left py-3">Improvement</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b last:border-b-0 hover:bg-gray-50 transition"
            >
              <td className="py-4 font-medium text-slate-950">{row.label}</td>
              <td className="py-4 text-slate-700">{formatPercentage(row.prePercentage)}</td>
              <td className="py-4 text-slate-700">{formatPercentage(row.postPercentage)}</td>
              <td className="py-4 font-semibold text-emerald-700">
                {formatSigned(row.improvement)} pts
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParticipantProgressTable({
  participants,
}: {
  participants: PrePostDetail["participants"];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="app-table min-w-[760px]">
        <thead>
          <tr className="border-b text-sm text-gray-500">
            <th className="text-left py-3">Participant</th>
            <th className="text-left py-3">Pre-test</th>
            <th className="text-left py-3">Post-test</th>
            <th className="text-left py-3">Improvement</th>
            <th className="text-left py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((participant) => (
            <tr
              key={participant.userId}
              className="border-b last:border-b-0 hover:bg-gray-50 transition"
            >
              <td className="py-4">
                <div className="font-medium text-slate-950">{participant.name}</div>
                <div className="text-sm text-slate-500">{participant.email}</div>
              </td>
              <td className="py-4 text-slate-700">
                {participant.preScore}/8 ({formatPercentage(participant.prePercentage)})
              </td>
              <td className="py-4 text-slate-700">
                {participant.postScore}/8 ({formatPercentage(participant.postPercentage)})
              </td>
              <td className="py-4 font-semibold text-emerald-700">
                {formatSigned(participant.improvement)}
              </td>
              <td className="py-4">
                <StatusBadge
                  status={participant.status}
                  tone={participant.status === "IMPROVED" ? "success" : "warning"}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsPage() {
  const [topics, setTopics] = useState<TopicAnalytics[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveAnalytics[]>([]);
  const [difficulties, setDifficulties] = useState<DifficultyAnalytics[]>([]);
  const [prePostSeries, setPrePostSeries] = useState<PrePostSeries[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<PrePostDetail | null>(null);
  const [insights, setInsights] = useState<Record<number, AiInsight>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [error, setError] = useState("");
  const [insightsError, setInsightsError] = useState("");

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    if (!selectedSeriesId) {
      setSelectedDetail(null);
      return;
    }

    loadPrePostDetail(selectedSeriesId);
  }, [selectedSeriesId]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    setError("");

    try {
      const [
        topicsData,
        objectivesData,
        difficultyData,
        seriesData,
      ] = await Promise.all([
        getAnalyticsByTopic(),
        getAnalyticsByLearningObjective(),
        getAnalyticsByDifficulty(),
        getPrePostSeries(),
      ]);

      setTopics(topicsData);
      setObjectives(objectivesData);
      setDifficulties(difficultyData);
      setPrePostSeries(seriesData);

      if (seriesData.length > 0) {
        setSelectedSeriesId(seriesData[0].id);
      }
    } catch (loadError) {
      console.error(loadError);
      setError(
        "Failed to load analytics. Check the API connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadPrePostDetail = async (seriesId: number) => {
    setIsDetailLoading(true);
    setInsightsError("");

    try {
      const detail = await getPrePostSeriesDetail(seriesId);
      setSelectedDetail(detail);
    } catch (loadError) {
      console.error(loadError);
      setSelectedDetail(null);
      setInsightsError("Failed to load linked pre/post detail.");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (!selectedSeriesId) {
      return;
    }

    setIsInsightsLoading(true);
    setInsightsError("");

    try {
      const result = await generatePrePostInsights({
        seriesId: selectedSeriesId,
      });

      setInsights((current) => ({
        ...current,
        [selectedSeriesId]: result,
      }));
    } catch (generateError) {
      console.error(generateError);
      setInsightsError(
        "Failed to generate AI insights. Confirm Ollama is running and the selected local model is installed."
      );
    } finally {
      setIsInsightsLoading(false);
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
        id: String(objective.learningObjectiveId ?? index),
        label: objective.learningObjectiveTitle || "Untitled learning objective",
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

  const selectedInsight = selectedSeriesId ? insights[selectedSeriesId] : null;
  const allRows = [...topicRows, ...objectiveRows, ...difficultyRows];
  const weakAreaCount = allRows.filter((row) => {
    const percentage = toPercentage(row.percentage);

    return percentage !== null && percentage < 75;
  }).length;
  const hasAnyAnalytics =
    topicRows.length > 0 ||
    objectiveRows.length > 0 ||
    difficultyRows.length > 0 ||
    prePostSeries.length > 0;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-950">Loading analytics</h1>
          <p className="mt-3 text-slate-600">Gathering assessment performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8">
          <h1 className="text-3xl font-bold text-slate-950">Analytics unavailable</h1>
          <p className="mt-3 text-red-700">{error}</p>
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
            difficulty gaps and linked pre/post progress across real participant submissions.
          </>
        }
        actions={
          <>
            <Link to="/assessments" className="app-button-primary">
              Review Assessments
            </Link>
            <Link to="/questions" className="app-button-secondary">
              Review Questions
            </Link>
            <Link to="/trainings" className="app-button-secondary">
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
          label="Pre/post series"
          value={prePostSeries.length}
          helper="Linked assessment series with paired participant results."
        />
      </div>

      <SectionCard
        title="Pre/Post Progress"
        description="Linked pre-test and post-test analytics use only completed real participant attempts and answers."
      >
        {prePostSeries.length === 0 ? (
          <EmptyState
            title="No linked pre/post series"
            description="Seed or create an AssessmentBlueprint with PRE_POST_SERIES configuration to show linked progress."
          />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {prePostSeries.map((series) => (
                <button
                  key={series.id}
                  type="button"
                  onClick={() => setSelectedSeriesId(series.id)}
                  className={`rounded-xl border p-5 text-left transition hover:border-indigo-300 ${
                    selectedSeriesId === series.id
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{series.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {series.training?.title || "Untitled training"} · {series.participantCount} paired participants
                      </p>
                    </div>
                    <StatusBadge status="PUBLISHED" tone="success" />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Avg pre</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{series.averagePreScore}/8</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Avg post</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{series.averagePostScore}/8</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Improvement</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-700">
                        {formatSigned(series.averageImprovement)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {isDetailLoading && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-700">
                Loading linked pre/post detail...
              </div>
            )}

            {selectedDetail && !isDetailLoading && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Paired participants"
                    value={selectedDetail.summary.participantCount}
                    helper="Users with both completed pre-test and post-test attempts."
                  />
                  <MetricCard
                    label="Average pre"
                    value={`${selectedDetail.summary.averagePreScore}/8`}
                    helper={`${formatPercentage(selectedDetail.summary.averagePrePercentage)} average pre-test score.`}
                  />
                  <MetricCard
                    label="Average post"
                    value={`${selectedDetail.summary.averagePostScore}/8`}
                    helper={`${formatPercentage(selectedDetail.summary.averagePostPercentage)} average post-test score.`}
                  />
                  <MetricCard
                    label="Average gain"
                    value={formatSigned(selectedDetail.summary.averageImprovement)}
                    helper={`${formatSigned(selectedDetail.summary.averagePercentageImprovement)} percentage points.`}
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Strongest topic</p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {selectedDetail.summary.strongestTopic || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Weakest pre-test topic</p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {selectedDetail.summary.weakestPreTopic || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Most improved topic</p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {selectedDetail.summary.mostImprovedTopic || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-xl font-bold text-slate-950">Participant improvements</h3>
                    <button
                      type="button"
                      onClick={handleGenerateInsights}
                      disabled={isInsightsLoading}
                      className="app-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isInsightsLoading ? "Generating..." : "Generate AI Insights"}
                    </button>
                  </div>
                  <ParticipantProgressTable participants={selectedDetail.participants} />
                </div>

                {insightsError && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-700">
                    {insightsError}
                  </div>
                )}

                {selectedInsight && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-xl font-bold text-slate-950">AI-generated insights</h3>
                      <StatusBadge status={selectedInsight.reviewStatus} tone="warning" />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-amber-800">
                      AI insights are advisory and should be reviewed by an instructor.
                    </p>
                    <p className="mt-1 text-sm text-amber-800">
                      Model: {selectedInsight.model} · Interaction #{selectedInsight.aiInteractionId}
                    </p>
                    <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-white p-4 text-sm leading-6 text-slate-800">
                      {selectedInsight.insightsText}
                    </pre>
                  </div>
                )}

                <div className="grid gap-6 xl:grid-cols-2">
                  <ComparisonTable
                    labelHeader="Topic"
                    rows={selectedDetail.byTopic.map((topic) => ({
                      id: String(topic.topicId),
                      label: topic.topicName,
                      prePercentage: topic.prePercentage,
                      postPercentage: topic.postPercentage,
                      improvement: topic.improvement,
                    }))}
                  />
                  <ComparisonTable
                    labelHeader="Difficulty"
                    rows={selectedDetail.byDifficulty.map((difficulty) => ({
                      id: String(difficulty.difficulty),
                      label: `Difficulty ${difficulty.difficulty}`,
                      prePercentage: difficulty.prePercentage,
                      postPercentage: difficulty.postPercentage,
                      improvement: difficulty.improvement,
                    }))}
                  />
                </div>

                <ComparisonTable
                  labelHeader="Learning Objective"
                  rows={selectedDetail.byLearningObjective.map((objective) => ({
                    id: String(objective.learningObjectiveId),
                    label: objective.title,
                    prePercentage: objective.prePercentage,
                    postPercentage: objective.postPercentage,
                    improvement: objective.improvement,
                  }))}
                />
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <div className="app-card my-10 p-6">
        <h2 className="text-2xl font-semibold text-slate-950">Recommended next action</h2>
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
        <AnalyticsTable rows={topicRows} labelHeader="Topic" />
      </SectionCard>

      <div className="mt-8">
        <SectionCard
          title="Results by learning objective"
          description="Use this to identify specific outcomes that need clearer instruction or better practice questions."
        >
          <AnalyticsTable rows={objectiveRows} labelHeader="Learning Objective" />
        </SectionCard>
      </div>

      <div className="mt-8">
        <SectionCard
          title="Results by difficulty"
          description="Use this to check whether assessments are too easy, too hard or uneven across difficulty levels."
        >
          <AnalyticsTable rows={difficultyRows} labelHeader="Difficulty" />
        </SectionCard>
      </div>
    </div>
  );
}

export default AnalyticsPage;
