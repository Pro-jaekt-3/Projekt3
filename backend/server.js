const express = require("express");
const cors = require("cors");

const questionRoutes = require("./routes/questionRoutes");
const topicRoutes = require("./routes/topicRoutes");
const learningObjectiveRoutes = require("./routes/learningObjectiveRoutes");
const trainingRoutes = require("./routes/trainingRoutes");
const equivalentQuestionGroupRoutes = require("./routes/equivalentQuestionGroupRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const assessmentAttemptRoutes = require("./routes/assessmentAttemptRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const { authMiddleware } = require("./middleware/authMiddleware");

const app = express();

app.use(cors());
app.use(express.json());
app.use(authMiddleware);

app.get("/", (req, res) => {
  res.json({
    message: "Backend dela!",
  });
});

app.use("/questions", questionRoutes);
app.use("/topics", topicRoutes);
app.use("/learning-objectives", learningObjectiveRoutes);
app.use("/trainings", trainingRoutes);
app.use("/equivalent-question-groups", equivalentQuestionGroupRoutes);
app.use("/assessments", assessmentRoutes);
app.use("/assessment-attempts", assessmentAttemptRoutes);
app.use("/analytics", analyticsRoutes);
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
