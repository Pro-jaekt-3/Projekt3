const express = require("express");
const cors = require("cors");

const questionRoutes = require("./routes/questionRoutes");
const topicRoutes = require("./routes/topicRoutes");
const learningObjectiveRoutes = require("./routes/learningObjectiveRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Backend dela!",
  });
});

app.use("/questions", questionRoutes);
app.use("/topics", topicRoutes);
app.use("/learning-objectives", learningObjectiveRoutes);
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});