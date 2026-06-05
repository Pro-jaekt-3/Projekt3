import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createQuestion,
  deleteQuestion,
  getQuestions,
  updateQuestionStatus,
} from "../services/questionService";
import { getEquivalentGroups } from "../services/equivalentGroupService";
import { getLearningObjectives } from "../services/learningObjectiveService";
import { getTopics } from "../services/topicService";

type Question = {
  id: number;
  title: string;
  description: string;
  difficulty: number;
  type: string;
  status: string;
  topicId?: number;
  topic?: {
    id: number;
    name: string;
  };
  learningObjectiveId?: number;
  learningObjective?: {
    id: number;
    title: string;
  };
  equivalentGroupId?: number;
  equivalentGroup?: {
    id: number;
    name: string;
  };
};

type Topic = {
  id: number;
  name: string;
  trainingId?: number;
};

type LearningObjective = {
  id: number;
  title: string;
  topicId?: number;
};

type EquivalentGroup = {
  id: number;
  name: string;
};

type QuestionOption = {
  text: string;
  isCorrect: boolean;
};

const STATUS_UPDATE_ACTIONS = [
  {
    value: "REVIEW",
    label: "Move to review",
  },
  {
    value: "APPROVED",
    label: "Approve",
  },
  {
    value: "REJECTED",
    label: "Reject",
  },
  {
    value: "ARCHIVED",
    label: "Archive",
  },
];

function QuestionsPage() {
  const [searchParams] = useSearchParams();
  const initialTrainingId =
    searchParams.get("trainingId") || "";
  const initialTopicId =
    searchParams.get("topicId") || "";
  const initialLearningObjectiveId =
    searchParams.get("learningObjectiveId") || "";
  const hasUrlContext = Boolean(
    initialTrainingId ||
      initialTopicId ||
      initialLearningObjectiveId
  );

  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [learningObjectives, setLearningObjectives] =
    useState<LearningObjective[]>([]);
  const [equivalentGroups, setEquivalentGroups] =
    useState<EquivalentGroup[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [learningObjectiveId, setLearningObjectiveId] =
    useState(initialLearningObjectiveId);
  const [equivalentGroupId, setEquivalentGroupId] =
    useState("");
  const [type, setType] = useState("OPEN");
  const [options, setOptions] = useState<QuestionOption[]>([
    {
      text: "",
      isCorrect: false,
    },
  ]);
  const [formError, setFormError] = useState("");

  const loadQuestions = async () => {
    try {
      const data = await getQuestions();

      setQuestions(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [
          topicData,
          objectiveData,
          equivalentGroupData,
        ] = await Promise.all([
          getTopics(),
          getLearningObjectives(),
          getEquivalentGroups(),
        ]);

        setTopics(topicData);
        setLearningObjectives(objectiveData);
        setEquivalentGroups(equivalentGroupData);
      } catch (error) {
        console.error(error);
      }
    };

    loadQuestions();
    loadMetadata();
  }, []);

  const topicNameById = useMemo(
    () =>
      new Map(
        topics.map((topic) => [topic.id, topic.name])
      ),
    [topics]
  );

  const objectiveNameById = useMemo(
    () =>
      new Map(
        learningObjectives.map((objective) => [
          objective.id,
          objective.title,
        ])
      ),
    [learningObjectives]
  );

  const equivalentGroupNameById = useMemo(
    () =>
      new Map(
        equivalentGroups.map((group) => [
          group.id,
          group.name,
        ])
      ),
    [equivalentGroups]
  );

  const filteredLearningObjectives = useMemo(() => {
    if (!topicId) {
      return learningObjectives;
    }

    return learningObjectives.filter(
      (objective) =>
        objective.topicId === Number(topicId)
    );
  }, [learningObjectives, topicId]);

  const filteredQuestions = useMemo(
    () =>
      questions.filter((question) => {
        const questionTopicId =
          question.topicId ?? question.topic?.id;
        const questionLearningObjectiveId =
          question.learningObjectiveId ??
          question.learningObjective?.id;

        if (
          initialTrainingId &&
          !topics.some(
            (topic) =>
              topic.id === questionTopicId &&
              topic.trainingId ===
                Number(initialTrainingId)
          )
        ) {
          return false;
        }

        if (
          initialTopicId &&
          questionTopicId !== Number(initialTopicId)
        ) {
          return false;
        }

        if (
          initialLearningObjectiveId &&
          questionLearningObjectiveId !==
            Number(initialLearningObjectiveId)
        ) {
          return false;
        }

        return true;
      }),
    [
      initialLearningObjectiveId,
      initialTopicId,
      initialTrainingId,
      questions,
      topics,
    ]
  );

  const reviewQueue = filteredQuestions.filter(
    (question) =>
      question.status === "DRAFT" ||
      question.status === "NEEDS_REVIEW" ||
      question.status === "REVIEW"
  );

  const approvedCount = filteredQuestions.filter(
    (question) => question.status === "APPROVED"
  ).length;

  const contextTrainingId =
    initialTrainingId ||
    (initialTopicId
      ? String(
          topics.find(
            (topic) =>
              topic.id === Number(initialTopicId)
          )?.trainingId || ""
        )
      : "");

  const groupedVariants = equivalentGroups.map((group) => ({
    group,
    questions: filteredQuestions.filter((question) => {
      const groupId =
        question.equivalentGroupId ??
        question.equivalentGroup?.id;

      return groupId === group.id;
    }),
  }));

  const addOption = () => {
    setFormError("");
    setOptions([
      ...options,
      {
        text: "",
        isCorrect: false,
      },
    ]);
  };

  const removeOption = (index: number) => {
    setFormError("");
    setOptions(
      options.filter((_, i) => i !== index)
    );
  };

  const updateOptionText = (
    index: number,
    value: string
  ) => {
    setFormError("");
    const updated = [...options];
    updated[index].text = value;
    setOptions(updated);
  };

  const updateOptionCorrect = (
    index: number,
    checked: boolean
  ) => {
    setFormError("");
    const updated = [...options];
    updated[index].isCorrect = checked;
    setOptions(updated);
  };

  const getQuestionTopic = (question: Question) => {
    const questionTopicId =
      question.topicId ?? question.topic?.id;

    return (
      question.topic?.name ||
      (questionTopicId
        ? topicNameById.get(questionTopicId)
        : undefined) ||
      "No topic"
    );
  };

  const getQuestionObjective = (question: Question) => {
    const objectiveId =
      question.learningObjectiveId ??
      question.learningObjective?.id;

    return (
      question.learningObjective?.title ||
      (objectiveId
        ? objectiveNameById.get(objectiveId)
        : undefined) ||
      "No learning objective"
    );
  };

  const getQuestionVariant = (question: Question) => {
    const groupId =
      question.equivalentGroupId ??
      question.equivalentGroup?.id;

    return (
      question.equivalentGroup?.name ||
      (groupId
        ? equivalentGroupNameById.get(groupId) ||
          `Variant group ${groupId}`
        : "No variants yet")
    );
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setFormError("");

    if (!title || !description || !topicId) {
      setFormError("Please fill all required fields.");
      return;
    }

    const normalizedOptions = options.map((option) => ({
      text: option.text.trim(),
      isCorrect: option.isCorrect,
    }));

    const filledOptions = normalizedOptions.filter(
      (option) => option.text.length > 0
    );

    if (type === "MULTIPLE_CHOICE") {
      if (filledOptions.length < 2) {
        setFormError(
          "Multiple choice questions require at least two non-empty options."
        );
        return;
      }

      if (!filledOptions.some((option) => option.isCorrect)) {
        setFormError(
          "Multiple choice questions require at least one correct option."
        );
        return;
      }
    }

    try {
      await createQuestion({
        title: title.trim(),
        description: description.trim(),
        difficulty,
        topicId: Number(topicId),
        learningObjectiveId:
          learningObjectiveId
            ? Number(learningObjectiveId)
            : undefined,
        equivalentGroupId:
          equivalentGroupId
            ? Number(equivalentGroupId)
            : undefined,
        type,
        options:
          type === "MULTIPLE_CHOICE"
            ? filledOptions
            : undefined,
      });

      setTitle("");
      setDescription("");
      setDifficulty(1);
      setTopicId(initialTopicId);
      setLearningObjectiveId(initialLearningObjectiveId);
      setEquivalentGroupId("");
      setType("OPEN");
      setOptions([
        {
          text: "",
          isCorrect: false,
        },
      ]);

      loadQuestions();
    } catch (error) {
      console.error(error);
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to create question."
      );
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteQuestion(id);

      loadQuestions();
    } catch (error) {
      console.error(error);
    }
  };

  const handleStatusChange = async (
    id: number,
    status: string
  ) => {
    if (!status) {
      return;
    }

    try {
      await updateQuestionStatus(id, status);

      loadQuestions();
    } catch (error) {
      console.error(error);
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to update question status."
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          Instructor content flow
        </p>

        <h1 className="text-5xl font-bold mb-4">
          Question Bank
        </h1>

        <p className="max-w-4xl text-lg leading-8 text-slate-600">
          Create, review and organize questions used in assessments.
          Only approved questions should be used in assessments. AI
          suggestions must be reviewed by an instructor before use.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total questions
            </p>
            <p className="mt-2 text-3xl font-bold">
              {filteredQuestions.length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Review queue
            </p>
            <p className="mt-2 text-3xl font-bold">
              {reviewQueue.length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Approved
            </p>
            <p className="mt-2 text-3xl font-bold">
              {approvedCount}
            </p>
          </div>
        </div>

        {hasUrlContext && (
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Showing questions for this curriculum context.
                </h2>

                <p className="mt-1 text-sm text-blue-800">
                  Topics are training-specific. Create the same topic name
                  separately under each training when needed.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/questions"
                  className="rounded-lg border border-blue-300 bg-white px-4 py-2 font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  Clear context
                </Link>

                <Link
                  to={`/assessments${
                    contextTrainingId
                      ? `?trainingId=${contextTrainingId}`
                      : ""
                  }`}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
                >
                  Create assessment from these questions
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-10 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-slate-950">
              Create question
            </h2>

            <p className="mt-2 text-slate-600">
              New questions enter the review flow through the backend's
              existing create behavior.
            </p>

            {formError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Question title"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              className="border border-gray-300 rounded-lg px-4 py-3"
            />

            <textarea
              placeholder="Question prompt"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              className="border border-gray-300 rounded-lg px-4 py-3"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="number"
                min="1"
                max="5"
                placeholder="Difficulty"
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(Number(e.target.value))
                }
                className="border border-gray-300 rounded-lg px-4 py-3"
              />

              <select
                value={type}
                onChange={(e) => {
                  setFormError("");
                  setType(e.target.value);
                }}
                className="border border-gray-300 rounded-lg px-4 py-3"
              >
                <option value="OPEN">
                  Open Question
                </option>
                <option value="MULTIPLE_CHOICE">
                  Multiple Choice
                </option>
                <option value="CODE">
                  Code Question
                </option>
              </select>
            </div>

            <select
              value={topicId}
              onChange={(e) => {
                const nextTopicId = e.target.value;
                setTopicId(nextTopicId);

                if (
                  learningObjectiveId &&
                  !learningObjectives.some(
                    (objective) =>
                      objective.id ===
                        Number(learningObjectiveId) &&
                      objective.topicId ===
                        Number(nextTopicId)
                  )
                ) {
                  setLearningObjectiveId("");
                }
              }}
              className="border border-gray-300 rounded-lg px-4 py-3"
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

            <select
              value={learningObjectiveId}
              onChange={(e) =>
                setLearningObjectiveId(e.target.value)
              }
              className="border border-gray-300 rounded-lg px-4 py-3"
            >
              <option value="">
                Select Learning Objective
              </option>

              {filteredLearningObjectives.map((objective) => (
                <option
                  key={objective.id}
                  value={objective.id}
                >
                  {objective.title}
                </option>
              ))}
            </select>

            <select
              value={equivalentGroupId}
              onChange={(e) =>
                setEquivalentGroupId(e.target.value)
              }
              className="border border-gray-300 rounded-lg px-4 py-3"
            >
              <option value="">
                No Equivalent Group
              </option>

              {equivalentGroups.map((group) => (
                <option
                  key={group.id}
                  value={group.id}
                >
                  {group.name}
                </option>
              ))}
            </select>

            {type === "MULTIPLE_CHOICE" && (
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold">
                  Answer Options
                </h3>

                {options.map((option, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-3 md:flex-row md:items-center"
                  >
                    <input
                      type="text"
                      placeholder="Option text"
                      value={option.text}
                      onChange={(e) =>
                        updateOptionText(
                          index,
                          e.target.value
                        )
                      }
                      className="border border-gray-300 rounded-lg px-4 py-2 flex-1"
                    />

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(e) =>
                          updateOptionCorrect(
                            index,
                            e.target.checked
                          )
                        }
                      />
                      Correct
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        removeOption(index)
                      }
                      className="rounded-lg bg-red-500 px-3 py-2 text-white"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addOption}
                  className="w-fit rounded-lg bg-gray-200 px-4 py-2"
                >
                  Add Option
                </button>
              </div>
            )}

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-medium transition"
            >
              Add Question
            </button>
          </div>
        </form>

        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="text-2xl font-semibold text-slate-950">
              AI helper
            </h2>

            <p className="mt-2 text-amber-800">
              AI suggestions must be reviewed by an instructor before use.
              AI output is not automatically approved, and generated
              questions should become Draft or Needs Review.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                "Generate draft",
                "Improve wording",
                "Generate equivalent variant",
                "Check quality",
              ].map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled
                  className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white opacity-45"
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="mt-4 text-sm text-amber-800">
              No safe frontend AI service is connected in this flow, so
              these actions are disabled.
            </p>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-950">
              Review queue
            </h2>

            {reviewQueue.length === 0 ? (
              <p className="mt-3 text-slate-600">
                No draft or needs-review questions are waiting.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {reviewQueue.slice(0, 5).map((question) => (
                  <div
                    key={question.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <p className="font-medium">
                      {question.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {question.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="mb-10 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">
              Equivalent variants
            </h2>

            <p className="mt-2 text-slate-600">
              Equivalent variants help create comparable pre-test and
              post-test questions.
            </p>
          </div>

          <Link
            to="/equivalent-groups"
            className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Maintenance
          </Link>
        </div>

        {equivalentGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-600">
            No equivalent groups exist yet. Equivalent variants help create
            comparable pre-test and post-test questions.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groupedVariants.map(({ group, questions: groupQuestions }) => (
              <div
                key={group.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <h3 className="font-semibold text-slate-950">
                  {group.name}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {groupQuestions.length} variant
                  {groupQuestions.length === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">
              Questions
            </h2>

            <p className="mt-2 text-slate-600">
              Review status, curriculum links and variant grouping before
              using questions in assessments.
            </p>
          </div>

          <Link
            to="/assessments"
            className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800"
          >
            Create Assessment
          </Link>
        </div>

        <div className="grid gap-6">
          {filteredQuestions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-600">
              No questions match this context.
            </div>
          ) : (
            filteredQuestions.map((question) => (
              <div
                key={question.id}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold">
                      {question.title}
                    </h3>

                    <p className="mt-2 text-gray-600">
                      {question.description}
                    </p>
                  </div>

                  <span className="w-fit bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full">
                    {question.type}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-5">
                  <span>
                    <strong>Status:</strong>{" "}
                    {question.status}
                  </span>
                  <span>
                    <strong>Difficulty:</strong>{" "}
                    {question.difficulty}
                  </span>
                  <span>
                    <strong>Topic:</strong>{" "}
                    {getQuestionTopic(question)}
                  </span>
                  <span>
                    <strong>Learning objective:</strong>{" "}
                    {getQuestionObjective(question)}
                  </span>
                  <span>
                    <strong>Variants:</strong>{" "}
                    {getQuestionVariant(question)}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <select
                    value=""
                    onChange={(e) =>
                      handleStatusChange(
                        question.id,
                        e.target.value
                      )
                    }
                    className="border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">
                      Change status
                    </option>

                    {STATUS_UPDATE_ACTIONS.map((action) => (
                      <option
                        key={action.value}
                        value={action.value}
                      >
                        {action.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() =>
                      handleDelete(question.id)
                    }
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default QuestionsPage;
