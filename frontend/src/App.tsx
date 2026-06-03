import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";

import HomePage from "./pages/HomePage";
import QuestionsPage from "./pages/QuestionsPage";
import TopicsPage from "./pages/TopicsPage";
import LearningObjectivesPage from "./pages/LearningObjectivesPage";
import TrainingsPage from "./pages/TrainingsPage";
import EquivalentGroupsPage from "./pages/EquivalentGroupsPage";
import AssessmentsPage from "./pages/AssessmentsPage";
import SolveAssessmentPage from "./pages/SolveAssessmentPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import LoginPage from "./pages/LoginPage";
import MyAssessmentsPage from "./pages/MyAssessmentsPage";
import ProtectedRoute from "./components/ProtectedRoute";


function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/questions"
          element={
            <ProtectedRoute
              allowedRoles={[
                "ADMIN",
                "INSTRUCTOR",
              ]}
            >
              <QuestionsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/topics"
          element={
            <ProtectedRoute
              allowedRoles={[
                "ADMIN",
                "INSTRUCTOR",
              ]}
            >
              <TopicsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/learning-objectives"
          element={
            <ProtectedRoute
              allowedRoles={[
                "ADMIN",
                "INSTRUCTOR",
              ]}
            >
              <LearningObjectivesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trainings"
          element={
            <ProtectedRoute
              allowedRoles={[
                "ADMIN",
                "INSTRUCTOR",
              ]}
            >
              <TrainingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/equivalent-groups"
          element={
            <ProtectedRoute
              allowedRoles={[
                "ADMIN",
                "INSTRUCTOR",
              ]}
            >
              <EquivalentGroupsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/assessments"
          element={
            <ProtectedRoute
              allowedRoles={[
                "ADMIN",
                "INSTRUCTOR",
              ]}
            >
              <AssessmentsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/solve-assessment/:id"
          element={
            <ProtectedRoute
              allowedRoles={[
                "PARTICIPANT",
              ]}
            >
              <SolveAssessmentPage />
            </ProtectedRoute>
          }
        />

        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
