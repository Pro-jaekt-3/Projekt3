import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getAssessment } from "../services/assessmentService";
import {
  startAttempt,
  submitAttempt,
} from "../services/assessmentAttemptService";

type AnswerOption = {
  id: number;
  text: string;
};

type Question = {
  id: number;
  title: string;
  description: string;
  type: string;
  answerOptions?: AnswerOption[];
};

type AssessmentQuestion = {
  id: number;
  question: Question;
};

type Assessment = {
  id: number;
  title: string;
  description?: string | null;
  questions: AssessmentQuestion[];
};

function SolveAssessmentPage() {
  const { id } = useParams();

  const [assessment, setAssessment] =
    useState<Assessment | null>(null);

  const [attemptId, setAttemptId] =
    useState<number | null>(null);

  const [answers, setAnswers] = useState<
    Record<number, string>
  >({});

  useEffect(() => {
    loadAssessment();
  }, []);

  const loadAssessment = async () => {
    try {
      if (!id) return;

      const assessmentData =
        await getAssessment(Number(id));

      setAssessment(assessmentData);

      const attempt =
        await startAttempt(Number(id));

      setAttemptId(attempt.id);
    } catch (error) {
      console.error(error);
    }
  };

  const updateAnswer = (
    questionId: number,
    value: string
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!attemptId || !assessment) {
      return;
    }

    try {
      const formattedAnswers =
        assessment.questions.map(
          (assessmentQuestion) => ({
            questionId:
              assessmentQuestion.question.id,
            textAnswer:
              answers[
                assessmentQuestion.question.id
              ] || "",
          })
        );

      await submitAttempt(
        attemptId,
        formattedAnswers
      );

      alert("Assessment submitted!");
    } catch (error) {
      console.error(error);
      alert("Failed to submit");
    }
  };

  if (!assessment) {
    return (
      <div className="p-8">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-4xl font-bold mb-4">
        {assessment.title}
      </h1>

      {assessment.description && (
        <p className="text-gray-600 mb-8">
          {assessment.description}
        </p>
      )}

      <div className="flex flex-col gap-6">
        {assessment.questions.map(
          (assessmentQuestion, index) => {
            const question =
              assessmentQuestion.question;

            return (
              <div
                key={question.id}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
              >
                <h3 className="text-xl font-semibold mb-2">
                  {index + 1}. {question.title}
                </h3>

                <p className="text-gray-600 mb-4">
                  {question.description}
                </p>

                {question.type ===
                  "MULTIPLE_CHOICE" &&
                question.answerOptions ? (
                  <div className="flex flex-col gap-2">
                    {question.answerOptions.map(
                      (option) => (
                        <label
                          key={option.id}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option.id}
                            onChange={(e) =>
                              updateAnswer(
                                question.id,
                                e.target.value
                              )
                            }
                          />

                          {option.text}
                        </label>
                      )
                    )}
                  </div>
                ) : (
                  <textarea
                    value={
                      answers[
                        question.id
                      ] || ""
                    }
                    onChange={(e) =>
                      updateAnswer(
                        question.id,
                        e.target.value
                      )
                    }
                    placeholder="Enter your answer..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                    rows={4}
                  />
                )}
              </div>
            );
          }
        )}
      </div>

      <button
        onClick={handleSubmit}
        className="mt-8 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition"
      >
        Submit Assessment
      </button>
    </div>
  );
}

export default SolveAssessmentPage;