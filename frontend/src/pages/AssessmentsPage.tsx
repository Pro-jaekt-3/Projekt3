import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  getAssessments,
  createAssessment,
  deleteAssessment,
  updateAssessment,
  updateAssessmentStatus,
} from "../services/assessmentService";

import { getQuestions } from "../services/questionService";
import { getLearningObjectives } from "../services/learningObjectiveService";
import { getTopics } from "../services/topicService";
import { getTrainings } from "../services/trainingService";

type Assessment = {
  id: number;
  title: string;
  description?: string | null;
  type: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  trainingId?: number;
  training?: {
    id: number;
    title: string;
  };
  questions?: {
    id: number;
    questionId?: number;
    question: {
      id: number;
      title: string;
    };
  }[];
};

type Question = {
  id: number;
  title: string;
  status?: string;
  difficulty?: number;
  topicId?: number;
  topic?: {
    id: number;
    name: string;
    trainingId?: number;
  };
  learningObjectiveId?: number;
  learningObjective?: {
    id: number;
    title: string;
  };
};

type Training = {
  id: number;
  title: string;
};

type Topic = {
  id: number;
  name: string;
  trainingId: number;
};

type LearningObjective = {
  id: number;
  title: string;
  topicId: number;
};

const statusBadgeClasses: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-amber-100 text-amber-800",
};

function AssessmentsPage() {
  const [searchParams] = useSearchParams();
  const initialTrainingId =
    searchParams.get("trainingId") || "";

  const [assessments, setAssessments] =
    useState<Assessment[]>([]);

  const [questions, setQuestions] =
    useState<Question[]>([]);

  const [trainings, setTrainings] =
    useState<Training[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [learningObjectives, setLearningObjectives] =
    useState<LearningObjective[]>([]);

  const [selectedQuestions, setSelectedQuestions] =
    useState<number[]>([]);

  const [previewAssessmentId, setPreviewAssessmentId] =
    useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");
  const [trainingId, setTrainingId] =
    useState(initialTrainingId);
  const [type, setType] = useState("QUIZ");
  const [topicFilter, setTopicFilter] = useState("");
  const [learningObjectiveFilter, setLearningObjectiveFilter] =
    useState("");
  const [difficultyFilter, setDifficultyFilter] =
    useState("");
  const [editingAssessmentId, setEditingAssessmentId] =
    useState<number | null>(null);
  const [formError, setFormError] = useState("");

  const selectedTrainingId = trainingId
    ? Number(trainingId)
    : null;

  const trainingTopics = useMemo(
    () =>
      selectedTrainingId
        ? topics.filter(
            (topic) =>
              topic.trainingId === selectedTrainingId
          )
        : [],
    [selectedTrainingId, topics]
  );

  const filteredLearningObjectives = useMemo(() => {
    if (!topicFilter) {
      const topicIds = new Set(
        trainingTopics.map((topic) => topic.id)
      );

      return learningObjectives.filter((objective) =>
        topicIds.has(objective.topicId)
      );
    }

    return learningObjectives.filter(
      (objective) =>
        objective.topicId === Number(topicFilter)
    );
  }, [
    learningObjectives,
    topicFilter,
    trainingTopics,
  ]);

  const availableQuestions = useMemo(() => {
    return questions.filter(
      (question) => {
        const questionTopicId =
          question.topicId ?? question.topic?.id;
        const questionTrainingId =
          question.topic?.trainingId ??
          topics.find(
            (topic) => topic.id === questionTopicId
          )?.trainingId;
        const questionLearningObjectiveId =
          question.learningObjectiveId ??
          question.learningObjective?.id;

        if (!selectedTrainingId) {
          return false;
        }

        if (question.status !== "APPROVED") {
          return false;
        }

        if (questionTrainingId !== selectedTrainingId) {
          return false;
        }

        if (
          topicFilter &&
          questionTopicId !== Number(topicFilter)
        ) {
          return false;
        }

        if (
          learningObjectiveFilter &&
          questionLearningObjectiveId !==
            Number(learningObjectiveFilter)
        ) {
          return false;
        }

        if (
          difficultyFilter &&
          question.difficulty !== Number(difficultyFilter)
        ) {
          return false;
        }

        return true;
      }
    );
  }, [
    difficultyFilter,
    learningObjectiveFilter,
    questions,
    selectedTrainingId,
    topicFilter,
    topics,
  ]);

  const loadAssessments = async () => {
    try {
      const data = await getAssessments();

      setAssessments(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadQuestions = async () => {
    try {
      const data = await getQuestions();

      setQuestions(data);
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

  const loadMetadata = async () => {
    try {
      const [topicData, objectiveData] =
        await Promise.all([
          getTopics(),
          getLearningObjectives(),
        ]);

      setTopics(topicData);
      setLearningObjectives(objectiveData);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadAssessments();
    loadQuestions();
    loadTrainings();
    loadMetadata();
  }, []);

  useEffect(() => {
    setSelectedQuestions((current) =>
      current.filter((questionId) => {
        const question = questions.find(
          (item) => item.id === questionId
        );
        const questionTopicId =
          question?.topicId ?? question?.topic?.id;
        const questionTrainingId =
          question?.topic?.trainingId ??
          topics.find(
            (topic) => topic.id === questionTopicId
          )?.trainingId;

        return (
          Boolean(selectedTrainingId) &&
          question?.status === "APPROVED" &&
          questionTrainingId === selectedTrainingId
        );
      })
    );
  }, [questions, selectedTrainingId, topics]);

  const handleQuestionToggle = (
    questionId: number
  ) => {
    if (
      selectedQuestions.includes(questionId)
    ) {
      setSelectedQuestions(
        selectedQuestions.filter(
          (id) => id !== questionId
        )
      );
    } else {
      setSelectedQuestions([
        ...selectedQuestions,
        questionId,
      ]);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTrainingId(initialTrainingId);
    setType("QUIZ");
    setSelectedQuestions([]);
    setTopicFilter("");
    setLearningObjectiveFilter("");
    setDifficultyFilter("");
    setEditingAssessmentId(null);
    setFormError("");
  };

  const handleTrainingChange = (value: string) => {
    setTrainingId(value);
    setSelectedQuestions([]);
    setTopicFilter("");
    setLearningObjectiveFilter("");
    setDifficultyFilter("");
    setFormError("");
  };

  const handleEdit = (assessment: Assessment) => {
    const status = assessment.status || "DRAFT";

    if (status !== "DRAFT") {
      return;
    }

    setEditingAssessmentId(assessment.id);
    setTitle(assessment.title);
    setDescription(assessment.description || "");
    setTrainingId(
      String(
        assessment.trainingId ??
          assessment.training?.id ??
          ""
      )
    );
    setType(assessment.type);
    setSelectedQuestions(
      assessment.questions?.map(
        (item) =>
          item.questionId ?? item.question.id
      ) || []
    );
    setTopicFilter("");
    setLearningObjectiveFilter("");
    setDifficultyFilter("");
    setFormError("");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setFormError("");

    if (
      !title ||
      !trainingId ||
      selectedQuestions.length === 0
    ) {
      setFormError(
        "Please enter title, training and select at least one question"
      );
      return;
    }

    try {
      const payload = {
        title,
        description,
        trainingId: Number(trainingId),
        type,
        questions: selectedQuestions,
      };

      if (editingAssessmentId) {
        await updateAssessment(
          editingAssessmentId,
          payload
        );
      } else {
        await createAssessment(payload);
      }

      resetForm();
      loadAssessments();
    } catch (error) {
      console.error(error);
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to save assessment."
      );
    }
  };

  const handleDelete = async (
    id: number
  ) => {
    try {
      await deleteAssessment(id);

      loadAssessments();
    } catch (error) {
      console.error(error);
    }
  };

  const handleStatusUpdate = async (
    id: number,
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  ) => {
    try {
      await updateAssessmentStatus(id, status);

      loadAssessments();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          Instructor assessment flow
        </p>

        <h1 className="text-5xl font-bold mb-4">
          Create and manage assessments
        </h1>

        <p className="max-w-3xl text-lg leading-8 text-slate-600">
          Create and manage assessments. Assessments are built from
          approved questions in the question bank. Participants start and
          solve available assessments from My Assessments, not from this
          management page.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-6 max-w-4xl mb-10"
      >
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              {editingAssessmentId
                ? "Edit draft assessment"
                : "Step 1: Basic info"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Name the assessment and add optional context for participants.
            </p>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}
          </div>

          <input
            type="text"
            placeholder="Assessment title"
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            className="border border-gray-300 rounded-lg px-4 py-3"
          />

          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
            className="border border-gray-300 rounded-lg px-4 py-3"
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Assessment type
            </label>

            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value)
              }
              className="w-full border border-gray-300 rounded-lg px-4 py-3"
            >
              <option value="QUIZ">
                Quiz
              </option>

              <option value="PRE_TEST">
                Pre Test
              </option>

              <option value="POST_TEST">
                Post Test
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Training
            </label>

            <select
              value={trainingId}
              onChange={(e) =>
                handleTrainingChange(e.target.value)
              }
              className="w-full border border-gray-300 rounded-lg px-4 py-3"
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
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Step 2: Select questions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Selected questions: {selectedQuestions.length}
              </p>
            </div>

            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              Showing approved questions from selected training
            </span>
          </div>

          {selectedTrainingId && (
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <select
                value={topicFilter}
                onChange={(e) => {
                  setTopicFilter(e.target.value);
                  setLearningObjectiveFilter("");
                }}
                className="border border-gray-300 rounded-lg px-4 py-3"
              >
                <option value="">
                  All topics
                </option>

                {trainingTopics.map((topic) => (
                  <option
                    key={topic.id}
                    value={topic.id}
                  >
                    {topic.name}
                  </option>
                ))}
              </select>

              <select
                value={learningObjectiveFilter}
                onChange={(e) =>
                  setLearningObjectiveFilter(
                    e.target.value
                  )
                }
                className="border border-gray-300 rounded-lg px-4 py-3"
              >
                <option value="">
                  All learning objectives
                </option>

                {filteredLearningObjectives.map(
                  (objective) => (
                    <option
                      key={objective.id}
                      value={objective.id}
                    >
                      {objective.title}
                    </option>
                  )
                )}
              </select>

              <select
                value={difficultyFilter}
                onChange={(e) =>
                  setDifficultyFilter(e.target.value)
                }
                className="border border-gray-300 rounded-lg px-4 py-3"
              >
                <option value="">
                  All difficulties
                </option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    Difficulty {value}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!selectedTrainingId ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              Select a training to choose approved questions from its
              curriculum.
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No questions are available yet. Add questions before creating
              an assessment.
            </div>
          ) : availableQuestions.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No approved questions are available for this training.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {availableQuestions.map((question) => (
                <label
                  key={question.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedQuestions.includes(
                      question.id
                    )}
                    onChange={() =>
                      handleQuestionToggle(
                        question.id
                      )
                    }
                  />

                  <span>{question.title}</span>

                  {question.status && (
                    <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {question.status}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-xl font-semibold text-slate-950">
            Step 3: Preview
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Review the assessment structure before creating it.
          </p>

          <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <p>
              <strong>Title:</strong>{" "}
              {title || "Not set"}
            </p>

            <p>
              <strong>Type:</strong> {type}
            </p>

            <p>
              <strong>Training:</strong>{" "}
              {trainings.find(
                (training) =>
                  training.id === Number(trainingId)
              )?.title || "Not selected"}
            </p>

            <p>
              <strong>Questions:</strong>{" "}
              {selectedQuestions.length} selected
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-xl font-semibold text-slate-950">
            Step 4: Availability
          </h2>

          <p className="mt-2 text-sm leading-6 text-amber-800">
            New assessments are saved as drafts. Published assessments are
            visible to demo participants. Assignment to specific
            participants is a later step.
          </p>
        </section>

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            !selectedTrainingId ||
            availableQuestions.length === 0
          }
        >
          {editingAssessmentId
            ? "Save Draft Assessment"
            : "Create Assessment"}
        </button>

        {editingAssessmentId && (
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancel edit
          </button>
        )}
      </form>

      <div className="mb-5">
        <h2 className="text-3xl font-bold text-slate-950">
          Assessment list
        </h2>

        <p className="mt-2 text-slate-600">
          Preview assessments here. Participants use My Assessments to
          start an attempt.
        </p>
      </div>

      <div className="grid gap-6">
        {assessments.map(
          (assessment) => {
            const isPreviewOpen =
              previewAssessmentId === assessment.id;

            return (
              <div
                key={assessment.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold">
                      {assessment.title}
                    </h3>

                    {assessment.description && (
                      <p className="text-gray-600 mt-2">
                        {
                          assessment.description
                        }
                      </p>
                    )}
                  </div>

                  <span className="w-fit bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full">
                    {assessment.type}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${
                      statusBadgeClasses[assessment.status || "DRAFT"] ||
                      statusBadgeClasses.DRAFT
                    }`}
                  >
                    {assessment.status || "DRAFT"}
                  </span>

                  <span className="text-sm text-slate-500">
                    {assessment.status === "PUBLISHED"
                      ? "Visible to demo participants"
                      : "Not available to participants"}
                  </span>
                </div>

                {isPreviewOpen && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Read-only preview
                    </p>

                    {assessment.questions &&
                    assessment.questions.length > 0 ? (
                      <ol className="list-decimal space-y-2 pl-5">
                        {assessment.questions.map((aq) => (
                          <li key={aq.id}>
                            {aq.question.title}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-slate-600">
                        No questions are attached to this assessment.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewAssessmentId(
                        isPreviewOpen
                          ? null
                          : assessment.id
                      )
                    }
                    className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg transition"
                  >
                    {isPreviewOpen
                      ? "Hide Preview"
                      : "Preview"}
                  </button>

                  <Link
                    to={`/assessments/${assessment.id}/results`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    View Results
                  </Link>

                  {(assessment.status || "DRAFT") === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleEdit(assessment)
                      }
                      className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      Edit
                    </button>
                  )}

                  {(assessment.status || "DRAFT") === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusUpdate(
                          assessment.id,
                          "PUBLISHED"
                        )
                      }
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      Publish
                    </button>
                  )}

                  {assessment.status === "PUBLISHED" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusUpdate(
                          assessment.id,
                          "ARCHIVED"
                        )
                      }
                      className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      Archive
                    </button>
                  )}

                  {assessment.status === "ARCHIVED" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusUpdate(
                          assessment.id,
                          "DRAFT"
                        )
                      }
                      className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      Move to Draft
                    </button>
                  )}

                  <button
                    onClick={() =>
                      handleDelete(
                        assessment.id
                      )
                    }
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

export default AssessmentsPage;
