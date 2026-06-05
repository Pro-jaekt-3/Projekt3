import { BrowserRouter, Routes, Route } from "react-router-dom";

import AppShell from "./components/AppShell";

import HomePage from "./pages/HomePage";
import QuestionsPage from "./pages/QuestionsPage";
import TopicsPage from "./pages/TopicsPage";
import LearningObjectivesPage from "./pages/LearningObjectivesPage";
import TrainingsPage from "./pages/TrainingsPage";
import TrainingDetailPage from "./pages/TrainingDetailPage";
import EquivalentGroupsPage from "./pages/EquivalentGroupsPage";
import AssessmentsPage from "./pages/AssessmentsPage";
import AssessmentResultsPage from "./pages/AssessmentResultsPage";
import SolveAssessmentPage from "./pages/SolveAssessmentPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AiAssistantPage from "./pages/AiAssistantPage";
import LoginPage from "./pages/LoginPage";
import MyAssessmentsPage from "./pages/MyAssessmentsPage";
import ParticipantResultPage from "./pages/ParticipantResultPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminTrainingsPage from "./pages/AdminTrainingsPage";
import AdminAssessmentsPage from "./pages/AdminAssessmentsPage";
import AdminAiModelsPage from "./pages/AdminAiModelsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./auth/AuthProvider";


function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell>
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
            path="/trainings/:id"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "ADMIN",
                  "INSTRUCTOR",
                ]}
              >
                <TrainingDetailPage />
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
            path="/assessments/:id/results"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "ADMIN",
                  "INSTRUCTOR",
                ]}
              >
                <AssessmentResultsPage />
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

          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/my-assessments"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "PARTICIPANT",
                ]}
              >
                <MyAssessmentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/my-results/:attemptId"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "PARTICIPANT",
                ]}
              >
                <ParticipantResultPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/analytics"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "ADMIN",
                  "INSTRUCTOR",
                ]}
              >
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "ADMIN",
                ]}
              >
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/trainings"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "ADMIN",
                ]}
              >
                <AdminTrainingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/assessments"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "ADMIN",
                ]}
              >
                <AdminAssessmentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/ai-models"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "ADMIN",
                ]}
              >
                <AdminAiModelsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/system-analytics"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "ADMIN",
                ]}
              >
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ai-assistant"
            element={
              <ProtectedRoute
                allowedRoles={[
                  "ADMIN",
                  "INSTRUCTOR",
                ]}
              >
                <AiAssistantPage />
              </ProtectedRoute>
            }
          />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
