import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";

import HomePage from "./pages/HomePage";
import QuestionsPage from "./pages/QuestionsPage";
import TopicsPage from "./pages/TopicsPage";
import LearningObjectivesPage from "./pages/LearningObjectivesPage";

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/questions" element={<QuestionsPage />} />

        <Route path="/topics" element={<TopicsPage />} />

        <Route path="/learning-objectives" element={<LearningObjectivesPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;