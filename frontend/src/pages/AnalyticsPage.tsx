import { useEffect, useState } from "react";

import {
  getAnalyticsByTopic,
  getAnalyticsByLearningObjective,
  getAnalyticsByDifficulty,
} from "../services/analyticsService";

function AnalyticsPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [objectives, setObjectives] =
    useState<any[]>([]);
  const [difficulties, setDifficulties] =
    useState<any[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
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
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-10">
        <h1 className="text-5xl font-bold mb-2">
          Analytics Dashboard
        </h1>

        <p className="text-gray-500 text-lg">
          Overview of assessment
          performance by topic,
          learning objective and
          difficulty.
        </p>
      </div>

      {/* SUMMARY CARDS */}

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-gray-500 mb-2">
            Topics
          </p>

          <h2 className="text-4xl font-bold text-blue-600">
            {topics.length}
          </h2>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-gray-500 mb-2">
            Learning Objectives
          </p>

          <h2 className="text-4xl font-bold text-green-600">
            {objectives.length}
          </h2>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-gray-500 mb-2">
            Difficulty Levels
          </p>

          <h2 className="text-4xl font-bold text-purple-600">
            {difficulties.length}
          </h2>
        </div>
      </div>

      {/* TOPICS */}

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-2xl font-semibold mb-6">
          Results by Topic
        </h2>

        <table className="w-full">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="text-left py-3">
                Topic
              </th>

              <th className="text-left py-3">
                Attempts
              </th>

              <th className="text-left py-3">
                Success Rate
              </th>
            </tr>
          </thead>

          <tbody>
            {topics.map((topic) => (
              <tr
                key={topic.topicId}
                className="border-b hover:bg-gray-50 transition"
              >
                <td className="py-4 font-medium">
                  {topic.topicTitle}
                </td>

                <td className="py-4">
                  {topic.attemptCount}
                </td>

                <td className="py-4">
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                    {topic.percentage}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* LEARNING OBJECTIVES */}

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-2xl font-semibold mb-6">
          Results by Learning Objective
        </h2>

        <table className="w-full">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="text-left py-3">
                Learning Objective
              </th>

              <th className="text-left py-3">
                Attempts
              </th>

              <th className="text-left py-3">
                Success Rate
              </th>
            </tr>
          </thead>

          <tbody>
            {objectives.map(
              (objective) => (
                <tr
                  key={
                    objective.learningObjectiveId
                  }
                  className="border-b hover:bg-gray-50 transition"
                >
                  <td className="py-4 font-medium">
                    {
                      objective.learningObjectiveTitle
                    }
                  </td>

                  <td className="py-4">
                    {
                      objective.attemptCount
                    }
                  </td>

                  <td className="py-4">
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                      {
                        objective.percentage
                      }
                      %
                    </span>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* DIFFICULTY */}

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-semibold mb-6">
          Results by Difficulty
        </h2>

        <table className="w-full">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="text-left py-3">
                Difficulty
              </th>

              <th className="text-left py-3">
                Attempts
              </th>

              <th className="text-left py-3">
                Success Rate
              </th>
            </tr>
          </thead>

          <tbody>
            {difficulties.map(
              (difficulty, index) => (
                <tr
                  key={index}
                  className="border-b hover:bg-gray-50 transition"
                >
                  <td className="py-4 font-medium">
                    {
                      difficulty.difficulty
                    }
                  </td>

                  <td className="py-4">
                    {
                      difficulty.attemptCount
                    }
                  </td>

                  <td className="py-4">
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                      {
                        difficulty.percentage
                      }
                      %
                    </span>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AnalyticsPage;