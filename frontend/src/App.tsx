import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";

import HomePage from "./pages/HomePage";
import QuestionsPage from "./pages/QuestionsPage";
import TopicsPage from "./pages/TopicsPage";
import LearningObjectivesPage from "./pages/LearningObjectivesPage";
import TrainingsPage from "./pages/TrainingsPage";
import EquivalentGroupsPage from "./pages/EquivalentGroupsPage";
import AssessmentsPage from "./pages/AssessmentsPage";


function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/questions" element={<QuestionsPage />} />

        <Route path="/topics" element={<TopicsPage />} />

        <Route path="/learning-objectives" element={<LearningObjectivesPage />} />

        <Route path="/trainings" element={<TrainingsPage />} />

        <Route path="/equivalent-groups" element={<EquivalentGroupsPage />} />

        <Route path="/assessments" element={<AssessmentsPage />}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;