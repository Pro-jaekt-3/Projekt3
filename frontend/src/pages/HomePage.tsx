import { Link } from "react-router-dom";

function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-12">
        <h1 className="text-6xl font-bold mb-4">
          Exam System
        </h1>

        <p className="text-xl text-gray-600">
          AI supported platform for question
          generation, exam creation and
          learning analytics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-gray-500 mb-2">
            Questions
          </p>

          <h2 className="text-4xl font-bold">
            120
          </h2>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-gray-500 mb-2">
            Topics
          </p>

          <h2 className="text-4xl font-bold">
            12
          </h2>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-gray-500 mb-2">
            Learning Objectives
          </p>

          <h2 className="text-4xl font-bold">
            24
          </h2>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-3xl font-semibold mb-6">
          Quick Actions
        </h2>

        <div className="flex flex-wrap gap-4">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition">
            <Link to="/questions">Create Question</Link>
          </button>

          <button className="bg-gray-100 hover:bg-gray-200 px-6 py-3 rounded-xl transition">
            <Link to="/topics">Create Topic</Link>
          </button>

          <button className="bg-gray-100 hover:bg-gray-200 px-6 py-3 rounded-xl transition">
            <Link to="/learning-objectives">Create Learning Objective</Link>
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomePage;