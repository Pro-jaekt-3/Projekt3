// API integration tests: real Express routers + real role/ownership middleware,
// with Firebase auth replaced by a header-driven test double and prisma mocked.
//
// Auth double contract: send `x-test-user: <JSON user>` to act as that user;
// omit the header to simulate a missing/invalid token (401).

jest.mock("../../prisma/client", () =>
  require("../helpers/mockPrisma").createMockPrisma()
);

jest.mock("../../middleware/firebaseAuthMiddleware", () => ({
  firebaseAuthMiddleware: (req, res, next) => {
    const raw = req.header("x-test-user");
    if (!raw) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    req.user = JSON.parse(raw);
    next();
  },
}));

const express = require("express");
const request = require("supertest");

const prisma = require("../../prisma/client");
const questionRoutes = require("../../routes/questionRoutes");
const topicRoutes = require("../../routes/topicRoutes");
const equivalenceGroupRoutes = require("../../routes/equivalenceGroupRoutes");

const app = express();
app.use(express.json());
app.use("/questions", questionRoutes);
app.use("/topics", topicRoutes);
app.use("/equivalence-groups", equivalenceGroupRoutes);

const INSTRUCTOR = JSON.stringify({ id: 1, role: "INSTRUCTOR" });
const ADMIN = JSON.stringify({ id: 2, role: "ADMIN" });
const PARTICIPANT = JSON.stringify({ id: 3, role: "PARTICIPANT" });

const asOwner = () =>
  prisma.userTraining.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });

describe("auth & role gates", () => {
  it("401s without an auth token", async () => {
    const res = await request(app).get("/questions");
    expect(res.status).toBe(401);
  });

  it("403s a PARTICIPANT on the question bank", async () => {
    const res = await request(app).get("/questions").set("x-test-user", PARTICIPANT);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  it("403s an ADMIN on content routes (not a content collaborator)", async () => {
    const res = await request(app).get("/questions").set("x-test-user", ADMIN);
    expect(res.status).toBe(403);
  });
});

describe("GET /questions", () => {
  it("returns the instructor's scoped question list", async () => {
    const questions = [{ id: 1, title: "SQL SELECT", status: "APPROVED" }];
    prisma.question.findMany.mockResolvedValue(questions);

    const res = await request(app).get("/questions").set("x-test-user", INSTRUCTOR);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(questions);
    expect(prisma.question.findMany.mock.calls[0][0].where).toEqual({
      topic: { training: { members: { some: { userId: 1, role: "INSTRUCTOR" } } } },
    });
  });
});

describe("GET /questions/:id — ownership", () => {
  it("404s a foreign question without revealing it exists", async () => {
    prisma.question.findUnique.mockResolvedValue({ topic: { trainingId: 5 } });
    prisma.userTraining.findUnique.mockResolvedValue(null); // not owner

    const res = await request(app).get("/questions/10").set("x-test-user", INSTRUCTOR);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Question not found" });
  });

  it("returns an owned question", async () => {
    const question = {
      id: 10,
      title: "SQL SELECT",
      topic: { trainingId: 5 },
      answerOptions: [],
    };
    prisma.question.findUnique.mockResolvedValue(question);
    asOwner();

    const res = await request(app).get("/questions/10").set("x-test-user", INSTRUCTOR);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(10);
  });
});

describe("POST /questions — MCQ validation through the route", () => {
  it("400s an MCQ without a correct option", async () => {
    const res = await request(app)
      .post("/questions")
      .set("x-test-user", INSTRUCTOR)
      .send({
        title: "Q",
        description: "d",
        difficulty: 1,
        topicId: 2,
        type: "MULTIPLE_CHOICE",
        options: [
          { text: "A", isCorrect: false },
          { text: "B", isCorrect: false },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least one correct option/);
  });

  it("201s a valid question for an owned topic", async () => {
    prisma.topic.findUnique.mockResolvedValue({ trainingId: 5 });
    asOwner();
    prisma.question.create.mockResolvedValue({ id: 20, title: "Q" });

    const res = await request(app)
      .post("/questions")
      .set("x-test-user", INSTRUCTOR)
      .send({ title: "Q", description: "d", difficulty: 1, topicId: 2, type: "OPEN" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 20, title: "Q" });
  });
});

describe("PATCH /questions/:id/status", () => {
  it("400s an invalid transition target", async () => {
    prisma.question.findUnique.mockResolvedValue({ topic: { trainingId: 5 } });
    asOwner();

    const res = await request(app)
      .patch("/questions/10/status")
      .set("x-test-user", INSTRUCTOR)
      .send({ status: "DRAFT" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid status/);
  });

  it("approves an owned question", async () => {
    prisma.question.findUnique.mockResolvedValue({ id: 10, topic: { trainingId: 5 } });
    asOwner();
    prisma.question.update.mockResolvedValue({ id: 10, status: "APPROVED" });

    const res = await request(app)
      .patch("/questions/10/status")
      .set("x-test-user", INSTRUCTOR)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
  });
});

describe("topics API", () => {
  it("POST /topics validates the payload", async () => {
    const res = await request(app)
      .post("/topics")
      .set("x-test-user", INSTRUCTOR)
      .send({ name: "" });

    expect(res.status).toBe(400);
  });

  it("DELETE /topics/:id returns 204 with an empty body", async () => {
    prisma.topic.findUnique.mockResolvedValue({ id: 5, trainingId: 3 });
    asOwner();
    prisma.topic.delete.mockResolvedValue({ id: 5 });

    const res = await request(app).delete("/topics/5").set("x-test-user", INSTRUCTOR);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });
});

describe("equivalence groups API", () => {
  it("POST /equivalence-groups/:id/questions enforces the training-scope invariant with 409", async () => {
    // requireOwnership + controller both read the group; question is cross-training.
    prisma.equivalenceGroup.findUnique.mockResolvedValue({ id: 4, trainingId: 1 });
    asOwner();
    prisma.question.findUnique.mockResolvedValue({
      id: 17,
      equivalenceGroupId: null,
      topic: { trainingId: 2 },
    });

    const res = await request(app)
      .post("/equivalence-groups/4/questions")
      .set("x-test-user", INSTRUCTOR)
      .send({ questionId: 17 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Training must match/);
  });

  it("DELETE /equivalence-groups/:id/questions/:questionId auto-deletes a singleton group", async () => {
    prisma.equivalenceGroup.findUnique.mockResolvedValue({ id: 4, trainingId: 1 });
    asOwner();
    prisma.question.findUnique.mockResolvedValue({ id: 17, equivalenceGroupId: 4 });
    prisma.question.update.mockResolvedValue({ id: 17, equivalenceGroupId: null });
    prisma.question.count.mockResolvedValue(1);

    const res = await request(app)
      .delete("/equivalence-groups/4/questions/17")
      .set("x-test-user", INSTRUCTOR);

    expect(res.status).toBe(200);
    expect(prisma.equivalenceGroup.delete).toHaveBeenCalledWith({ where: { id: 4 } });
  });

  it("GET /equivalence-groups returns the scoped list", async () => {
    prisma.equivalenceGroup.findMany.mockResolvedValue([{ id: 4, questions: [] }]);

    const res = await request(app)
      .get("/equivalence-groups")
      .set("x-test-user", INSTRUCTOR);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
