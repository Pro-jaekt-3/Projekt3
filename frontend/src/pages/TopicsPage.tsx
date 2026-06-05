import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  getTopics,
  createTopic,
  deleteTopic,
} from "../services/topicService";

import { getTrainings } from "../services/trainingService";
import { EmptyState, PageHeader } from "../components/ui";

type Topic = {
  id: number;
  name: string;
  trainingId: number;
  training?: {
    id: number;
    title: string;
  };
};

type Training = {
  id: number;
  title: string;
  description?: string | null;
};

function TopicsPage() {
  const [searchParams] = useSearchParams();
  const initialTrainingId =
    searchParams.get("trainingId") || "";

  const [topics, setTopics] = useState<Topic[]>([]);
  const [trainings, setTrainings] = useState<
    Training[]
  >([]);

  const [name, setName] = useState("");
  const [trainingId, setTrainingId] =
    useState(initialTrainingId);

  const loadTopics = async () => {
    try {
      const data = await getTopics();

      setTopics(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadTrainings = async () => {
    try {
      const data = await getTrainings();

      setTrainings(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadTopics();
    loadTrainings();
  }, []);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!name || !trainingId) {
      alert(
        "Please enter topic name and select training"
      );
      return;
    }

    try {
      await createTopic(
        name,
        Number(trainingId)
      );

      setName("");
      setTrainingId(initialTrainingId);

      loadTopics();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTopic(id);

      loadTopics();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <PageHeader
        eyebrow="Contextual curriculum setup"
        title="Topics"
        description={
          <>
            Topics belong to trainings and organize the subject areas that
            later connect learning objectives, questions and assessments.
          </>
        }
        actions={
        <Link
          to="/learning-objectives"
          className="app-button-secondary"
        >
          Next: Add learning objectives
        </Link>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="app-card mb-10 grid max-w-2xl gap-4 p-6 md:grid-cols-[1fr_1fr_auto]"
      >
        <input
          type="text"
          placeholder="Topic name"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          className="app-input"
        />

        <select
          value={trainingId}
          onChange={(e) =>
            setTrainingId(e.target.value)
          }
          className="app-input"
        >
          <option value="">
            Select Training
          </option>

          {trainings.map((training) => (
            <option
              key={training.id}
              value={training.id}
            >
              {training.title}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="app-button-primary"
        >
          Add Topic
        </button>
      </form>

      <div className="grid gap-6">
        {topics.length === 0 ? (
          <EmptyState
            title="No topics yet"
            description="Create a topic for a training before adding learning objectives."
          />
        ) : topics.map((topic) => (
          <div
            key={topic.id}
            className="app-card flex items-center justify-between p-6"
          >
            <div>
              <h3 className="text-2xl font-semibold">
                {topic.name}
              </h3>

              <p className="text-gray-500 text-sm mt-1">
                Training: {topic.training?.title}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to={`/learning-objectives?topicId=${topic.id}`}
                className="app-button-primary"
              >
                Manage Objectives
              </Link>

              <button
                onClick={() =>
                  handleDelete(topic.id)
                }
                className="app-button-danger"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TopicsPage;
