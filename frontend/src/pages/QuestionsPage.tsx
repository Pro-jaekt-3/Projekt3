import {
  getQuestions,
  createQuestion,
  deleteQuestion,
  updateQuestionStatus,
} from "../services/questionService";
import { getTopics } from "../services/topicService";
import { getLearningObjectives } from "../services/learningObjectiveService";
import { getEquivalentGroups } from "../services/equivalentGroupService";

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type Question = {
  id: number;
  title: string;
  description: string;
  difficulty: number;
  type: string;
  status: string;
};

type Topic = {
  id: number;
  name: string;
};

type LearningObjective = {
  id: number;
  title: string;
};

type EquivalentGroup = {
  id: number;
  name: string;
};

type QuestionOption = {
  text: string;
  isCorrect: boolean;
};

function QuestionsPage() {
  const [searchParams] = useSearchParams();
  const initialTopicId =
    searchParams.get("topicId") || "";
  const initialLearningObjectiveId =
    searchParams.get("learningObjectiveId") || "";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([]);

  const [equivalentGroups, setEquivalentGroups] = useState<EquivalentGroup[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [topicId, setTopicId] = useState(initialTopicId);

  const [learningObjectiveId, setLearningObjectiveId] = useState(initialLearningObjectiveId);
  const [equivalentGroupId, setEquivalentGroupId] = useState("");

  const [type, setType] = useState("OPEN");

  const [options, setOptions] = useState<
  QuestionOption[]
  >([
    {
      text: "",
      isCorrect: false,
    },
  ]);

  const loadQuestions = async () => {
    try {
      const data = await getQuestions();

      setQuestions(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchTopics = async () => {
    try {
      const data = await getTopics();
      setTopics(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadQuestions();
    fetchTopics();
    fetchLearningObjectives();
    fetchEquivalentGroups();
  }, []);

  const fetchLearningObjectives = async () => {
  try {
    const data =
      await getLearningObjectives();
    setLearningObjectives(data);
  } catch (error) {
    console.error(error);
  }
};

  const fetchEquivalentGroups = async () => {
    try {
      const data =
        await getEquivalentGroups();
      setEquivalentGroups(data);
    } catch (error) {
      console.error(error);
    }
  };

    const addOption = () => {
    setOptions([
      ...options,
      {
        text: "",
        isCorrect: false,
      },
    ]);
  };

  const removeOption = (index: number) => {
    setOptions(
      options.filter((_, i) => i !== index)
    );
  };

  const updateOptionText = (
    index: number,
    value: string
  ) => {
    const updated = [...options];
    updated[index].text = value;
    setOptions(updated);
  };

  const updateOptionCorrect = (
    index: number,
    checked: boolean
  ) => {
    const updated = [...options];
    updated[index].isCorrect = checked;
    setOptions(updated);
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!title || !description || !topicId) {
      alert("Please fill all fields");
      return;
    }

    try {
      await createQuestion({
        title,
        description,
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
            ? options
            : undefined,
      });

      setTitle("");
      setDescription("");
      setDifficulty(1);
      setTopicId(initialTopicId);
      setType("OPEN");

      setLearningObjectiveId(initialLearningObjectiveId);
      setEquivalentGroupId("");

      setOptions([
        {
          text: "",
          isCorrect: false,
        },
      ]);

      loadQuestions();
    } catch (error) {
      console.error(error);
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
    try {
      await updateQuestionStatus(
        id,
        status
      );

      loadQuestions();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-10">
        <h1 className="text-5xl font-bold mb-4">
          Questions
        </h1>

        <p className="max-w-3xl text-lg leading-8 text-slate-600">
          Questions are the reusable content items for assessments.
          Approved questions can be selected when an instructor creates
          a quiz, pre-test or post-test.
        </p>

        <Link
          to="/assessments"
          className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
        >
          Next: Create assessment
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 max-w-xl mb-10"
      >
        <input
          type="text"
          placeholder="Title"
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
          onChange={(e) =>
            setType(e.target.value)
          }
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

        <select
          value={topicId}
          onChange={(e) =>
            setTopicId(e.target.value)
          }
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

          {learningObjectives.map((objective) => (
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
  <div className="flex flex-col gap-3">
    <h3 className="font-semibold">
      Answer Options
    </h3>

    {options.map((option, index) => (
      <div
        key={index}
        className="flex items-center gap-3"
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
          className="bg-red-500 text-white px-3 py-2 rounded-lg"
        >
          Remove
        </button>
      </div>
    ))}

        <button
          type="button"
          onClick={addOption}
          className="bg-gray-200 px-4 py-2 rounded-lg"
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
      </form>

      <div className="grid gap-6">
        {questions.length > 0 && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
            <h2 className="text-xl font-semibold text-slate-950">
              Ready for assessments
            </h2>

            <p className="mt-2 max-w-3xl text-slate-600">
              When enough questions are reviewed and approved, continue to
              assessments and select the questions for a test.
            </p>

            <Link
              to="/assessments"
              className="mt-4 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700"
            >
              Create Assessment
            </Link>
          </div>
        )}

        {questions.map((question) => (
          <div
            key={question.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-semibold">
                {question.title}
              </h3>

              <span className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full">
                {question.type}
              </span>
            </div>

            <p className="text-gray-600 mb-4">
              {question.description}
            </p>

            <div className="mb-4">
              <span className="font-medium">
                Status:
              </span>{" "}
              {question.status}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Difficulty:{" "}
                {question.difficulty}
              </span>

            <select
              value={question.status}
              onChange={(e) =>
                handleStatusChange(
                  question.id,
                  e.target.value
                )
              }
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="DRAFT">
                DRAFT
              </option>

              <option value="NEEDS_REVIEW">
                NEEDS REVIEW
              </option>

              <option value="REVIEW">
                REVIEW
              </option>

              <option value="APPROVED">
                APPROVED
              </option>

              <option value="REJECTED">
                REJECTED
              </option>
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
        ))}
      </div>
    </div>
  );
}

export default QuestionsPage;
