import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  getLearningObjectives,
  createLearningObjective,
  deleteLearningObjective,
} from "../services/learningObjectiveService";

import { getTopics } from "../services/topicService";
import { EmptyState, PageHeader } from "../components/ui";

type LearningObjective = {
  id: number;
  title: string;
  description: string;
  topicId: number;
  topic?: {
    id: number;
    name: string;
  };
};

type Topic = {
  id: number;
  name: string;
};

function LearningObjectivesPage() {
  const [searchParams] = useSearchParams();
  const initialTopicId =
    searchParams.get("topicId") || "";

  const [learningObjectives, setLearningObjectives] =
    useState<LearningObjective[]>([]);

  const [topics, setTopics] = useState<Topic[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topicId, setTopicId] = useState(initialTopicId);
  const [createdObjectiveId, setCreatedObjectiveId] =
    useState<number | null>(null);

  const loadLearningObjectives = async () => {
    try {
      const data =
        await getLearningObjectives();

      setLearningObjectives(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadTopics = async () => {
    try {
      const data = await getTopics();

      setTopics(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadLearningObjectives();
    loadTopics();
  }, []);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!title || !topicId) {
      alert(
        "Please enter title and select topic"
      );
      return;
    }

    try {
      const createdObjective =
        await createLearningObjective({
          title,
          description,
          topicId: Number(topicId),
        });

      setTitle("");
      setDescription("");
      setTopicId(initialTopicId);
      setCreatedObjectiveId(
        createdObjective.id
      );

      loadLearningObjectives();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLearningObjective(id);

      loadLearningObjectives();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <PageHeader
        eyebrow="Contextual curriculum setup"
        title="Learning Objectives"
        description={
          <>
            Learning objectives belong to topics. They describe what the
            participant should know before you create targeted questions.
          </>
        }
        actions={
        <Link
          to={
            initialTopicId
              ? `/questions?topicId=${initialTopicId}`
              : "/questions"
          }
          className="app-button-secondary"
        >
          Next: Add questions
        </Link>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="app-card mb-10 grid max-w-3xl gap-4 p-6 md:grid-cols-2"
      >
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
          className="app-input"
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
          className="app-input"
        />

        <select
          value={topicId}
          onChange={(e) =>
            setTopicId(e.target.value)
          }
          className="app-input"
        >
          <option value="">
            Select Topic
          </option>

          {topics.map((topic) => (
            <option
              key={topic.id}
              value={topic.id}
            >
              {topic.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="app-button-primary md:col-span-2"
        >
          Add Learning Objective
        </button>
      </form>

      <div className="grid gap-6">
        {learningObjectives.length === 0 ? (
          <EmptyState
            title="No learning objectives yet"
            description="Create a learning objective under a topic before adding targeted questions."
          />
        ) : learningObjectives.map(
          (objective) => (
            <div
              key={objective.id}
              className="app-card p-6"
            >
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-2xl font-semibold mb-2">
                    {objective.title}
                  </h3>

                  <p className="text-gray-600">
                    {objective.description}
                  </p>

                  <p className="text-gray-500 text-sm mt-2">
                    Topic:{" "}
                    {objective.topic?.name}
                  </p>

                  {createdObjectiveId ===
                    objective.id && (
                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-sm font-medium text-blue-900">
                        Learning objective created. Add targeted questions
                        for this objective next.
                      </p>

                      <Link
                        to={`/questions?topicId=${objective.topicId}&learningObjectiveId=${objective.id}`}
                        className="app-button-primary mt-3 text-sm"
                      >
                        Create Questions
                      </Link>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    to={`/questions?topicId=${objective.topicId}&learningObjectiveId=${objective.id}`}
                    className="app-button-primary"
                  >
                    Create Questions
                  </Link>

                  <button
                    onClick={() =>
                      handleDelete(
                        objective.id
                      )
                    }
                    className="app-button-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default LearningObjectivesPage;
