import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

function HomePage() {
  const { appUser } = useAuth();
  const isParticipant = appUser?.role === "PARTICIPANT";

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          Educational assessment platform
        </p>

        <h1 className="text-6xl font-bold mb-4">
          Assessment Workspace
        </h1>

        <p className="max-w-4xl text-xl leading-9 text-gray-600">
          Manage the flow from training curriculum to question bank,
          assessments, solving and results.
        </p>
      </div>

      {isParticipant ? (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
            <h2 className="text-3xl font-semibold">
              My Assessments
            </h2>

            <p className="mt-3 text-slate-600">
              Start assessments that are available to you in the current
              MVP demo.
            </p>

            <Link
              to="/my-assessments"
              className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700"
            >
              Open My Assessments
            </Link>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
            <h2 className="text-3xl font-semibold">
              My Results
            </h2>

            <p className="mt-3 text-amber-800">
              Participant results are coming soon. Detailed result routes
              are not available in the current frontend.
            </p>
          </section>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">
              Training
            </h2>

            <p className="mt-3 text-slate-600">
              Start from a training workspace for curriculum, questions,
              assessments and results.
            </p>

            <Link
              to="/trainings"
              className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
            >
              Open Trainings
            </Link>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">
              Curriculum
            </h2>

            <p className="mt-3 text-slate-600">
              Topics and learning objectives are maintained as part of
              training setup.
            </p>

            <Link
              to="/trainings"
              className="mt-5 inline-flex rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Choose Training
            </Link>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">
              Question Bank
            </h2>

            <p className="mt-3 text-slate-600">
              Create, review and organize approved questions for
              assessments.
            </p>

            <Link
              to="/questions"
              className="mt-5 inline-flex rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Open Question Bank
            </Link>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">
              Results
            </h2>

            <p className="mt-3 text-slate-600">
              Review analytics after participants submit assessments.
            </p>

            <Link
              to="/analytics"
              className="mt-5 inline-flex rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Open Results
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}

export default HomePage;
