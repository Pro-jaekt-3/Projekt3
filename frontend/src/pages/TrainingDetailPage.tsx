import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getAssessments } from "../services/assessmentService";
import { getLearningObjectives } from "../services/learningObjectiveService";
import { getQuestions } from "../services/questionService";
import { getTopics } from "../services/topicService";
import { getTrainings } from "../services/trainingService";

type Training = {
  id: number;
  title: string;
  description?: string | null;
};

type Topic = {
  id: number;
  name: string;
  trainingId: number;
};

type LearningObjective = {
  id: number;
  title: string;
  description?: string | null;
  topicId: number;
};

type Question = {
  id: number;
  title: string;
  type: string;
  difficulty: number;
  status?: string;
  topicId?: number;
  topic?: {
    id: number;
    name: string;
  };
  learningObjective?: {
    id: number;
    title: string;
  };
  equivalentGroup?: {
    id: number;
    name: string;
  };
  equivalentGroupId?: number;
};

type Assessment = {
  id: number;
  title: string;
  description?: string | null;
  type: string;
  trainingId?: number;
  training?: {
    id: number;
    title: string;
  };
  questions?: unknown[];
};

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function ChecklistItem({
  label,
  done,
}: {
  label: string;
  done: boolean;
}) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
      <span className="font-medium text-slate-800">
        {label}
      </span>

      <span
        className={`rounded-full px-3 py-1 text-sm font-semibold ${
          done
            ? "bg-emerald-50 text-emerald-700"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {done ? "Done" : "Next"}
      </span>
    </li>
  );
}

function TrainingDetailPage() {
  const { id } = useParams();
  const trainingId = Number(id);

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [objectives, setObjectives] = useState<LearningObjective[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const [
          trainingData,
          topicData,
          objectiveData,
          questionData,
          assessmentData,
        ] = await Promise.all([
          getTrainings(),
          getTopics(),
          getLearningObjectives(),
          getQuestions(),
          getAssessments(),
        ]);

        setTrainings(trainingData);
        setTopics(topicData);
        setObjectives(objectiveData);
        setQuestions(questionData);
        setAssessments(assessmentData);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkspace();
  }, []);

  const training = trainings.find(
    (item) => item.id === trainingId
  );

  const trainingTopics = useMemo(
    () =>
      topics.filter(
        (topic) => topic.trainingId === trainingId
      ),
    [topics, trainingId]
  );

  const topicIds = useMemo(
    () => new Set(trainingTopics.map((topic) => topic.id)),
    [trainingTopics]
  );

  const trainingObjectives = useMemo(
    () =>
      objectives.filter((objective) =>
        topicIds.has(objective.topicId)
      ),
    [objectives, topicIds]
  );

  const trainingQuestions = useMemo(
    () =>
      questions.filter((question) => {
        const questionTopicId =
          question.topicId ?? question.topic?.id;

        return Boolean(
          questionTopicId && topicIds.has(questionTopicId)
        );
      }),
    [questions, topicIds]
  );

  const trainingAssessments = useMemo(
    () =>
      assessments.filter((assessment) => {
        const assessmentTrainingId =
          assessment.trainingId ?? assessment.training?.id;

        return assessmentTrainingId === trainingId;
      }),
    [assessments, trainingId]
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold">
            Loading training workspace
          </h1>
        </div>
      </div>
    );
  }

  if (!training) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
          <h1 className="text-3xl font-bold">
            Training not found
          </h1>

          <p className="mt-3 text-amber-800">
            This workspace uses existing list endpoints and could not find
            a training with this ID.
          </p>

          <Link
            to="/trainings"
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
          >
            Back to Trainings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <header className="mb-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          Training workspace
        </p>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-5xl font-bold text-slate-950">
              {training.title}
            </h1>

            {training.description && (
              <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-600">
                {training.description}
              </p>
            )}

            <p className="mt-4 text-slate-600">
              Central workspace for curriculum, question bank,
              assessments and results.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              to="/assessments"
              className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700"
            >
              Create Assessment
            </Link>

            <Link
              to={`/topics?trainingId=${training.id}`}
              className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Add Topic
            </Link>

            <Link
              to="/questions"
              className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Add Question
            </Link>

            <Link
              to="/analytics"
              className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
            >
              View Results
            </Link>
          </div>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-semibold text-slate-950">
          Overview
        </h2>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Topics"
            value={trainingTopics.length}
          />
          <SummaryCard
            label="Learning Objectives"
            value={trainingObjectives.length}
          />
          <SummaryCard
            label="Questions"
            value={trainingQuestions.length}
          />
          <SummaryCard
            label="Assessments"
            value={trainingAssessments.length}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-950">
            Setup checklist
          </h3>

          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            <ChecklistItem
              label="Training created"
              done
            />
            <ChecklistItem
              label="Topics added"
              done={trainingTopics.length > 0}
            />
            <ChecklistItem
              label="Learning objectives added"
              done={trainingObjectives.length > 0}
            />
            <ChecklistItem
              label="Questions added"
              done={trainingQuestions.length > 0}
            />
            <ChecklistItem
              label="Assessment created"
              done={trainingAssessments.length > 0}
            />
          </ul>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">
              Curriculum
            </h2>

            <p className="mt-2 text-slate-600">
              Topics and learning objectives are maintained here as part
              of the training flow.
            </p>
          </div>
        </div>

        {trainingTopics.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-600">
            No topics are attached to this training yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {trainingTopics.map((topic) => {
              const topicObjectives =
                trainingObjectives.filter(
                  (objective) =>
                    objective.topicId === topic.id
                );

              return (
                <div
                  key={topic.id}
                  className="rounded-xl border border-slate-200 p-5"
                >
                  <h3 className="text-xl font-semibold">
                    {topic.name}
                  </h3>

                  {topicObjectives.length === 0 ? (
                    <p className="mt-3 text-slate-500">
                      No learning objectives yet.
                    </p>
                  ) : (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
                      {topicObjectives.map((objective) => (
                        <li key={objective.id}>
                          {objective.title}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      to={`/learning-objectives?topicId=${topic.id}`}
                      className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      Add Learning Objective
                    </Link>

                    <Link
                      to={`/questions?topicId=${topic.id}`}
                      className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800"
                    >
                      Create Question
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">
              Question Bank
            </h2>

            <p className="mt-2 text-slate-600">
              Questions connected through this training's topics.
            </p>
          </div>

          <Link
            to="/questions"
            className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800"
          >
            Manage Question Bank
          </Link>
        </div>

        {trainingQuestions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-600">
            No questions are connected to this training yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {trainingQuestions.map((question) => (
              <div
                key={question.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-950">
                      {question.title}
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      {question.type} | Difficulty{" "}
                      {question.difficulty} |{" "}
                      {question.status || "No status"}
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                    {question.equivalentGroup?.name ||
                      (question.equivalentGroupId
                        ? `Variant group ${question.equivalentGroupId}`
                        : "No variants")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">
              Assessments
            </h2>

            <p className="mt-2 text-slate-600">
              Assessments connected to this training when the assessment
              record exposes a training ID.
            </p>
          </div>

          <Link
            to="/assessments"
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
          >
            Create Assessment
          </Link>
        </div>

        {trainingAssessments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-600">
            No assessments are connected to this training yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {trainingAssessments.map((assessment) => (
              <div
                key={assessment.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <h3 className="font-semibold">
                  {assessment.title}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {assessment.type} |{" "}
                  {assessment.questions?.length || 0} questions
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">
            Results
          </h2>

          <p className="mt-2 text-slate-600">
            Detailed training results appear after participants submit
            assessments.
          </p>

          <Link
            to="/analytics"
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800"
          >
            Open Results
          </Link>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-2xl font-semibold text-slate-950">
            Participants
          </h2>

          <p className="mt-2 text-amber-800">
            Training membership is not implemented yet. In the full
            version, this section controls which participants can access
            assessments.
          </p>
        </section>
      </div>
    </div>
  );
}

export default TrainingDetailPage;
