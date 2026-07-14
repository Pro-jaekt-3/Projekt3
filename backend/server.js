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

// Allowed frontend origins: local dev (Vite on 8080) always allowed, plus any
// production origin(s) from CORS_ORIGIN (comma-separated, e.g. the deployed
// Vercel URL). Requests with no Origin header (curl, server-to-server) are
// always allowed since they can't be a browser CSRF/XSS vector.
const DEV_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];
const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...DEV_ORIGINS, ...configuredOrigins];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  }),
);
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
