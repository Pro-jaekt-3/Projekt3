import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getAttemptById } from "../services/assessmentAttemptService";

type Question = {
  id: number;
  title?: string | null;
  description?: string | null;
  type?: string | null;
};

type SelectedOption = {
  id: number;
  text?: string | null;
};

type ParticipantAnswer = {
  id: number;
  textAnswer?: string | null;
  answerText?: string | null;
  isCorrect?: boolean | null;
  pointsAwarded?: number | null;
  needsManualReview?: boolean | null;
  question?: Question | null;
  selectedOption?: SelectedOption | null;
};

type AssessmentAttempt = {
  id: number;
  status?: string | null;
  score?: number | null;
  maxScore?: number | null;
  submittedAt?: string | null;
  assessment?: {
    title?: string | null;
  } | null;
  answers?: ParticipantAnswer[];
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatScore = (
  score?: number | null,
  maxScore?: number | null
) => {
  if (score == null) {
    return "Not available";
  }

  if (maxScore == null) {
    return String(score);
  }

  return `${score} / ${maxScore}`;
};

const getAnswerText = (answer: ParticipantAnswer) => {
  if (answer.selectedOption?.text) {
    return answer.selectedOption.text;
  }

  if (answer.textAnswer) {
    return answer.textAnswer;
  }

  if (answer.answerText) {
    return answer.answerText;
  }

  return "No answer text available";
};

function ParticipantResultPage() {
  const { attemptId } = useParams();

  const [attempt, setAttempt] =
    useState<AssessmentAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAttempt();
  }, [attemptId]);

  const loadAttempt = async () => {
    try {
      setIsLoading(true);
      setError("");

      const parsedAttemptId = Number(attemptId);

      if (
        !Number.isInteger(parsedAttemptId) ||
        parsedAttemptId <= 0
      ) {
        setError("Result id is invalid.");
        setAttempt(null);
        return;
      }

      const data =
        await getAttemptById(parsedAttemptId);

      setAttempt(data);
    } catch (requestError) {
      console.error(requestError);
      setError(
        "Failed to load this result. Please try again later."
      );
      setAttempt(null);
    } finally {
      setIsLoading(false);
    }
  };

  const answers = attempt?.answers || [];

  const hasManualReviewAnswers = useMemo(
    () =>
      answers.some(
        (answer) =>
          answer.needsManualReview ||
          answer.isCorrect == null ||
          answer.pointsAwarded == null
      ),
    [answers]
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-3xl font-bold">
            Loading result
          </h1>

          <p className="text-slate-600">
            Retrieving your submitted attempt...
          </p>
        </div>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-10">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-700">
            Result unavailable
          </p>

          <h1 className="text-3xl font-bold text-slate-950">
            Could not load result
          </h1>

          <p className="mt-4 text-slate-700">
            {error ||
              "This result could not be found."}
          </p>

          <Link
            to="/my-assessments"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
          >
            Back to My Assessments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          Assessment result
        </p>

        <h1 className="text-4xl font-bold text-slate-950">
          {attempt.assessment?.title ||
            "Submitted attempt"}
        </h1>

        {hasManualReviewAnswers && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Some answers may require manual review. Auto-graded
            values are shown where available.
          </div>
        )}
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Score
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {formatScore(
              attempt.score,
              attempt.maxScore
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Status
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {attempt.status || "Not available"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Answered
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {answers.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Submitted
          </p>
          <p className="mt-2 text-base font-semibold text-slate-950">
            {formatDate(attempt.submittedAt)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-950">
          Answers
        </h2>

        <Link
          to="/my-assessments"
          className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Back to My Assessments
        </Link>
      </div>

      {answers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          No answer details are available for this attempt.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {answers.map((answer, index) => (
            <div
              key={answer.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-500">
                    Answer {index + 1}
                  </p>

                  <h3 className="text-xl font-semibold text-slate-950">
                    {answer.question?.title ||
                      "Question title unavailable"}
                  </h3>
                </div>

                {answer.question?.type && (
                  <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {answer.question.type}
                  </span>
                )}
              </div>

              {answer.question?.description && (
                <p className="mb-4 text-slate-600">
                  {answer.question.description}
                </p>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">
                    Your answer
                  </p>
                  <p className="mt-2 whitespace-pre-wrap font-medium text-slate-900">
                    {getAnswerText(answer)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">
                    Correctness
                  </p>
                  <p className="mt-2 font-medium text-slate-900">
                    {answer.isCorrect == null
                      ? "Pending review"
                      : answer.isCorrect
                        ? "Correct"
                        : "Incorrect"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">
                    Points awarded
                  </p>
                  <p className="mt-2 font-medium text-slate-900">
                    {answer.pointsAwarded == null
                      ? "Pending review"
                      : answer.pointsAwarded}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ParticipantResultPage;
