import { useState } from "react";
import { Link } from "react-router-dom";

type QuestionType =
  | "OPEN"
  | "MULTIPLE_CHOICE"
  | "CODE";

function AiAssistantPage() {
  const [topicText, setTopicText] =
    useState("");
  const [objectiveText, setObjectiveText] =
    useState("");
  const [questionType, setQuestionType] =
    useState<QuestionType>("OPEN");
  const [difficulty, setDifficulty] =
    useState(1);
  const [instructions, setInstructions] =
    useState("");

  const isAiBackendConnected = false;

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-10">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          Internal AI workspace
        </p>

        <h1 className="text-5xl font-bold mb-4">
          AI Assistant is not a primary flow
        </h1>

        <p className="max-w-4xl text-lg leading-8 text-slate-600">
          AI help now belongs inside question creation, review and
          assessment workflows. This legacy page remains available for
          internal maintenance, but it is not shown in primary navigation.
          AI output is not automatically approved and must be reviewed by
          an instructor.
        </p>
      </div>

      <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-xl font-semibold text-slate-950">
          Backend AI is not connected yet
        </h2>

        <p className="mt-2 max-w-4xl text-amber-800">
          The frontend has no existing AI service for draft questions,
          suggestion review, accept/reject actions or equivalence checks.
          This page is ready for that workflow, but it does not fake AI
          results.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-950">
              Generate draft question
            </h2>

            <p className="mt-2 text-slate-600">
              Provide teaching context for a future AI question draft. The
              submit action is disabled until a backend endpoint is
              available.
            </p>
          </div>

          <form className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Topic or topic text
              </label>

              <input
                type="text"
                value={topicText}
                onChange={(event) =>
                  setTopicText(event.target.value)
                }
                placeholder="Example: Relational databases"
                className="w-full rounded-lg border border-gray-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Learning objective or objective text
              </label>

              <input
                type="text"
                value={objectiveText}
                onChange={(event) =>
                  setObjectiveText(event.target.value)
                }
                placeholder="Example: Explain primary and foreign keys"
                className="w-full rounded-lg border border-gray-300 px-4 py-3"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Question type
                </label>

                <select
                  value={questionType}
                  onChange={(event) =>
                    setQuestionType(
                      event.target.value as QuestionType
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                >
                  <option value="OPEN">
                    Open question
                  </option>

                  <option value="MULTIPLE_CHOICE">
                    Multiple choice
                  </option>

                  <option value="CODE">
                    Code question
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Difficulty
                </label>

                <input
                  type="number"
                  min="1"
                  max="5"
                  value={difficulty}
                  onChange={(event) =>
                    setDifficulty(
                      Number(event.target.value)
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Optional instructions
              </label>

              <textarea
                value={instructions}
                onChange={(event) =>
                  setInstructions(event.target.value)
                }
                placeholder="Example: Avoid trick wording. Include a short SQL example."
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-4 py-3"
              />
            </div>

            <button
              type="button"
              disabled={!isAiBackendConnected}
              className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate draft question
            </button>
          </form>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
            <h2 className="text-xl font-semibold text-slate-950">
              Review policy
            </h2>

            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
              <li>
                AI suggestions must be reviewed by an instructor before
                use.
              </li>

              <li>
                Accepting a suggestion should create only a draft or
                needs-review question.
              </li>

              <li>
                AI output is not automatically approved.
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">
              Suggested next steps
            </h2>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/questions"
                className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800"
              >
                Review Question Bank
              </Link>

              <Link
                to="/topics"
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Review Topics
              </Link>
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">
              AI suggestions
            </h2>

            <p className="mt-2 text-slate-600">
              Suggestions will appear here after a backend service exposes
              saved AI draft suggestions.
            </p>
          </div>

          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            PENDING / ACCEPTED / REJECTED
          </span>
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <h3 className="font-semibold text-slate-950">
            No AI suggestions available
          </h3>

          <p className="mt-2 text-slate-600">
            No endpoint or frontend service currently loads AI suggestions.
            Accept and reject actions are disabled until backend support is
            available.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white opacity-50"
            >
              Accept suggestion
            </button>

            <button
              type="button"
              disabled
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white opacity-50"
            >
              Reject suggestion
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-950">
          Equivalence check
        </h2>

        <p className="mt-2 max-w-4xl text-slate-600">
          Equivalence checking between two questions needs a dedicated
          backend endpoint. No such frontend service exists right now, so
          this action is disabled.
        </p>

        <button
          type="button"
          disabled
          className="mt-5 rounded-lg bg-slate-900 px-5 py-3 font-medium text-white opacity-50"
        >
          Check equivalence
        </button>
      </section>
    </div>
  );
}

export default AiAssistantPage;
