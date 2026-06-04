import { useEffect, useMemo, useState } from "react";

import {
  getAssessments,
  createAssessment,
  deleteAssessment,
} from "../services/assessmentService";

import { getQuestions } from "../services/questionService";
import { getTrainings } from "../services/trainingService";

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
  status?: string;
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

  const [previewAssessmentId, setPreviewAssessmentId] =
    useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");
  const [trainingId, setTrainingId] =
    useState("");
  const [type, setType] = useState("QUIZ");

  const hasQuestionStatuses = questions.some(
    (question) => Boolean(question.status)
  );

  const availableQuestions = useMemo(() => {
    if (!hasQuestionStatuses) {
      return questions;
    }

    return questions.filter(
      (question) => question.status === "APPROVED"
    );
  }, [hasQuestionStatuses, questions]);

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
      <div className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          Instructor assessment flow
        </p>

        <h1 className="text-5xl font-bold mb-4">
          Create and manage assessments
        </h1>

        <p className="max-w-3xl text-lg leading-8 text-slate-600">
          Build quizzes, pre-tests and post-tests from the question bank.
          Participants start and solve assigned assessments from My
          Assessments, not from this management page.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-6 max-w-4xl mb-10"
      >
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Basic assessment data
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Name the assessment and add optional context for participants.
            </p>
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
                setTrainingId(e.target.value)
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
                Select questions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Selected questions: {selectedQuestions.length}
              </p>
            </div>

            {hasQuestionStatuses && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                Showing approved questions
              </span>
            )}
          </div>

          {questions.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              No questions are available yet. Add questions before creating
              an assessment.
            </div>
          ) : availableQuestions.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Questions exist, but none are approved. Approve questions or
              adjust question status before creating an assessment.
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

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
          disabled={availableQuestions.length === 0}
        >
          Create Assessment
        </button>
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
