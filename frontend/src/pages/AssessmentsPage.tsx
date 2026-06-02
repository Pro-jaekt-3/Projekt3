import { useEffect, useState } from "react";

import {
  getAssessments,
  createAssessment,
  deleteAssessment,
} from "../services/assessmentService";

import { getQuestions } from "../services/questionService";
import { getTrainings } from "../services/trainingService";
import { Link } from "react-router-dom";

type Assessment = {
  id: number;
  title: string;
  description?: string | null;
  type: string;
  questions?: {
    id: number;
    question: {
      id: number;
      title: string;
    };
  }[];
};

type Question = {
  id: number;
  title: string;
}; 

type Training = {
  id: number;
  title: string;
};

function AssessmentsPage() {
  const [assessments, setAssessments] =
    useState<Assessment[]>([]);

  const [questions, setQuestions] =
    useState<Question[]>([]);

  const [trainings, setTrainings] =
    useState<Training[]>([]);

  const [selectedQuestions, setSelectedQuestions] =
    useState<number[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");
  const [trainingId, setTrainingId] =
    useState("");
  const [type, setType] = useState("QUIZ");

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

  useEffect(() => {
    loadAssessments();
    loadQuestions();
    loadTrainings();
  }, []);

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

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !title ||
      !trainingId ||
      selectedQuestions.length === 0
    ) {
      alert(
        "Please enter title, training and select at least one question"
      );
      return;
    }

    try {
      await createAssessment({
        title,
        description,
        trainingId: Number(trainingId),
        type,
        questions: selectedQuestions,
      });

      setTitle("");
      setDescription("");
      setTrainingId("");
      setType("QUIZ");
      setSelectedQuestions([]);

      loadAssessments();
    } catch (error) {
      console.error(error);
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

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <h1 className="text-6xl font-bold text-center mb-12">
        Assessments
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 max-w-3xl mb-10"
      >
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

        <select
          value={type}
          onChange={(e) =>
            setType(e.target.value)
          }
          className="border border-gray-300 rounded-lg px-4 py-3"
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

        <select
          value={trainingId}
          onChange={(e) =>
            setTrainingId(e.target.value)
          }
          className="border border-gray-300 rounded-lg px-4 py-3"
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

        <div>
          <h3 className="font-semibold text-lg mb-3">
            Select Questions
          </h3>

          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
            {questions.map((question) => (
              <label
                key={question.id}
                className="flex items-center gap-3"
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

                {question.title}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-medium transition"
        >
          Create Assessment
        </button>
      </form>

      <div className="grid gap-6">
        {assessments.map(
          (assessment) => (
            <div
              key={assessment.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex justify-between items-start mb-4">
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

                <span className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full">
                  {assessment.type}
                </span>
              </div>

                {assessment.questions &&
                assessment.questions.length > 0 && (
                    <div className="mt-4 mb-4">
                    <p className="font-medium mb-2">
                        Questions:
                    </p>

                    <ul className="list-disc ml-6">
                        {assessment.questions.map((aq) => (
                        <li key={aq.id}>
                            {aq.question.title}
                        </li>
                        ))}
                    </ul>
                    </div>
                )}

              <div className="flex gap-2">
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

            <Link
              to={`/solve-assessment/${assessment.id}`}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
            >
              Solve
            </Link>
          </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default AssessmentsPage;