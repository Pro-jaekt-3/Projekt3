import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

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

  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [isSubmitted, setIsSubmitted] =
    useState(false);
  const [submittedAttemptId, setSubmittedAttemptId] =
    useState<number | null>(null);
  const [isConfirmingSubmit, setIsConfirmingSubmit] =
    useState(false);
  const [submitWarning, setSubmitWarning] =
    useState("");
  const [submitError, setSubmitError] =
    useState("");

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
      setSubmitError(
        "Failed to load this assessment. Please try again later."
      );
    }
  };

  const answeredCount = useMemo(() => {
    if (!assessment) {
      return 0;
    }

    return assessment.questions.filter(
      (assessmentQuestion) => {
        const value =
          answers[
            assessmentQuestion.question.id
          ];

        return Boolean(value && value.trim());
      }
    ).length;
  }, [answers, assessment]);

  const totalQuestions =
    assessment?.questions.length || 0;
  const unansweredCount =
    totalQuestions - answeredCount;

  const updateAnswer = (
    questionId: number,
    value: string
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    setSubmitWarning("");
    setSubmitError("");
    setIsConfirmingSubmit(false);
  };

  const handleSubmit = async () => {
    if (!attemptId || !assessment) {
      return;
    }

    setSubmitError("");

    if (!isConfirmingSubmit) {
      setSubmitWarning(
        unansweredCount > 0
          ? `${unansweredCount} question${unansweredCount === 1 ? "" : "s"} unanswered. Review your answers, then confirm submission.`
          : "Review your answers, then confirm submission."
      );
      setIsConfirmingSubmit(true);
      return;
    }

    try {
      setIsSubmitting(true);

      const formattedAnswers =
        assessment.questions.map(
          (assessmentQuestion) => {
            const question =
              assessmentQuestion.question;

            const value =
              answers[question.id];

            if (
              question.type ===
              "MULTIPLE_CHOICE"
            ) {
              return {
                questionId: question.id,
                selectedOptionId: Number(value),
              };
            }

            return {
              questionId: question.id,
              textAnswer: value || "",
            };
          }
        );

      const submittedAttempt = await submitAttempt(
        attemptId,
        formattedAnswers
      );

      const responseAttemptId =
        Number(submittedAttempt?.id);

      setSubmittedAttemptId(
        Number.isInteger(responseAttemptId) &&
          responseAttemptId > 0
          ? responseAttemptId
          : null
      );
      setIsSubmitted(true);
    } catch (error) {
      console.error(error);
      setSubmitError(
        "Failed to submit this assessment. Please try again."
      );
      setIsConfirmingSubmit(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!assessment) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold mb-2">
            Loading assessment
          </h1>

          <p className="text-slate-600">
            Preparing your attempt...
          </p>

          {submitError && (
            <p className="mt-4 text-red-600">
              {submitError}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Submitted
          </p>

          <h1 className="text-4xl font-bold text-slate-950">
            Assessment submitted
          </h1>

          <p className="mt-4 max-w-2xl text-slate-700">
            Your attempt for {assessment.title} was submitted successfully.
          </p>

          {!submittedAttemptId && (
            <p className="mt-4 max-w-2xl text-slate-700">
              Result details are not available from the current response.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {submittedAttemptId && (
              <Link
                to={`/my-results/${submittedAttemptId}`}
                className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700"
              >
                View result
              </Link>
            )}

            <Link
              to="/my-assessments"
              className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
            >
              Back to My Assessments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="mb-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          Assessment attempt
        </p>

        <h1 className="text-4xl font-bold mb-4">
          {assessment.title}
        </h1>

        {assessment.description && (
          <p className="text-gray-600 mb-5">
            {assessment.description}
          </p>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium text-slate-900">
              Answer each question, then submit your attempt.
            </p>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              {answeredCount} of {totalQuestions} answered
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{
                width:
                  totalQuestions === 0
                    ? "0%"
                    : `${(answeredCount / totalQuestions) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {assessment.questions.map(
          (assessmentQuestion, index) => {
            const question =
              assessmentQuestion.question;
            const questionNumber = index + 1;
            const answerValue =
              answers[question.id] || "";
            const hasOptions =
              question.type ===
                "MULTIPLE_CHOICE" &&
              question.answerOptions &&
              question.answerOptions.length > 0;

            return (
              <div
                key={question.id}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
              >
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-500">
                      Question {questionNumber} of {totalQuestions}
                    </p>

                    <h3 className="text-xl font-semibold">
                      {question.title}
                    </h3>
                  </div>

                  <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {question.type}
                  </span>
                </div>

                <p className="text-gray-600 mb-4">
                  {question.description}
                </p>

                {hasOptions ? (
                  <div className="flex flex-col gap-2">
                    {question.answerOptions?.map(
                      (option) => (
                        <label
                          key={option.id}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50"
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option.id}
                            checked={
                              answerValue ===
                              String(option.id)
                            }
                            onChange={(e) =>
                              updateAnswer(
                                question.id,
                                e.target.value
                              )
                            }
                          />

                          <span>{option.text}</span>
                        </label>
                      )
                    )}
                  </div>
                ) : (
                  <textarea
                    value={answerValue}
                    onChange={(e) =>
                      updateAnswer(
                        question.id,
                        e.target.value
                      )
                    }
                    placeholder={
                      question.type === "CODE"
                        ? "Enter your code answer..."
                        : "Enter your answer..."
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                    rows={5}
                  />
                )}
              </div>
            );
          }
        )}
      </div>

      {(submitWarning || submitError) && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {submitWarning || submitError}
        </div>
      )}

      {isConfirmingSubmit && !submitError && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Submit confirmation is active. Your next submit action will send
          this attempt.
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || totalQuestions === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Submitting..."
            : isConfirmingSubmit
              ? "Confirm Submit"
              : "Review Submission"}
        </button>

        <Link
          to="/my-assessments"
          className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Back to My Assessments
        </Link>
      </div>
    </div>
  );
}

export default SolveAssessmentPage;
