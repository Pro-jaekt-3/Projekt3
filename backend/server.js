require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const questionRoutes = require("./routes/questionRoutes");
const topicRoutes = require("./routes/topicRoutes");
const trainingRoutes = require("./routes/trainingRoutes");
const equivalenceGroupRoutes = require("./routes/equivalenceGroupRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const assessmentAttemptRoutes = require("./routes/assessmentAttemptRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const aiRoutes = require("./routes/aiRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Backend dela!",
  });
});

app.use("/auth", authRoutes);
app.use("/questions", questionRoutes);
app.use("/topics", topicRoutes);
app.use("/trainings", trainingRoutes);
app.use("/equivalence-groups", equivalenceGroupRoutes);
app.use("/assessments", assessmentRoutes);
app.use("/assessment-attempts", assessmentAttemptRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/ai", aiRoutes);
app.use("/users", userRoutes);
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
