jest.mock("../prisma/client", () =>
  require("./helpers/mockPrisma").createMockPrisma()
);

const prisma = require("../prisma/client");
const { mockReq, mockRes } = require("./helpers/mockPrisma");
const {
  createQuestion,
  updateQuestion,
  updateQuestionStatus,
  deleteQuestion,
} = require("../controllers/questionController");

const instructor = { id: 1, role: "INSTRUCTOR" };

const ownTraining = () =>
  prisma.userTraining.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });

describe("createQuestion — MCQ validation (business rule)", () => {
  it("rejects MULTIPLE_CHOICE with fewer than two options", async () => {
    const req = mockReq({
      user: instructor,
      body: {
        title: "Q",
        description: "d",
        difficulty: 1,
        topicId: 2,
        type: "MULTIPLE_CHOICE",
        options: [{ text: "only one", isCorrect: true }],
      },
    });
    const res = mockRes();

    await createQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Multiple choice questions require at least two options",
    });
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it("rejects MULTIPLE_CHOICE without any correct option", async () => {
    const req = mockReq({
      user: instructor,
      body: {
        title: "Q",
        description: "d",
        difficulty: 1,
        topicId: 2,
        type: "MULTIPLE_CHOICE",
        options: [
          { text: "A", isCorrect: false },
          { text: "B", isCorrect: false },
        ],
      },
    });
    const res = mockRes();

    await createQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Multiple choice questions require at least one correct option",
    });
  });

  it("rejects options on a non-MCQ question", async () => {
    const req = mockReq({
      user: instructor,
      body: {
        title: "Q",
        description: "d",
        difficulty: 1,
        topicId: 2,
        type: "OPEN",
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
        ],
      },
    });
    const res = mockRes();

    await createQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Options are only allowed for MULTIPLE_CHOICE questions",
    });
  });

  it("returns 404 when the topic does not exist", async () => {
    prisma.topic.findUnique.mockResolvedValue(null);
    const req = mockReq({
      user: instructor,
      body: { title: "Q", description: "d", difficulty: 1, topicId: 99, type: "OPEN" },
    });
    const res = mockRes();

    await createQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Topic not found" });
  });

  it("returns 404 (not 403) when the caller does not own the topic's training", async () => {
    prisma.topic.findUnique.mockResolvedValue({ trainingId: 7 });
    prisma.userTraining.findUnique.mockResolvedValue(null); // not a member

    const req = mockReq({
      user: instructor,
      body: { title: "Q", description: "d", difficulty: 1, topicId: 2, type: "OPEN" },
    });
    const res = mockRes();

    await createQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Topic not found" });
  });

  it("creates a valid MCQ with 0-based orderIndex and the caller as author", async () => {
    prisma.topic.findUnique.mockResolvedValue({ trainingId: 7 });
    ownTraining();
    const created = { id: 10, title: "Q" };
    prisma.question.create.mockResolvedValue(created);

    const req = mockReq({
      user: instructor,
      body: {
        title: "Q",
        description: "d",
        difficulty: 1,
        topicId: 2,
        type: "MULTIPLE_CHOICE",
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
        ],
      },
    });
    const res = mockRes();

    await createQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);

    const data = prisma.question.create.mock.calls[0][0].data;
    expect(data.createdById).toBe(1);
    expect(data.answerOptions.create).toEqual([
      { text: "A", isCorrect: true, orderIndex: 0 },
      { text: "B", isCorrect: false, orderIndex: 1 },
    ]);
  });

  it("defaults type to OPEN when not provided", async () => {
    prisma.topic.findUnique.mockResolvedValue({ trainingId: 7 });
    ownTraining();
    prisma.question.create.mockResolvedValue({ id: 11 });

    const req = mockReq({
      user: instructor,
      body: { title: "Q", description: "d", difficulty: 2, topicId: 2 },
    });
    const res = mockRes();

    await createQuestion(req, res);

    expect(prisma.question.create.mock.calls[0][0].data.type).toBe("OPEN");
  });

  it.each([
    ["title", { description: "d", difficulty: 1, topicId: 2 }],
    ["description", { title: "Q", difficulty: 1, topicId: 2 }],
    ["difficulty", { title: "Q", description: "d", topicId: 2 }],
    ["topicId", { title: "Q", description: "d", difficulty: 1 }],
  ])("rejects a missing required field (%s) with 400", async (_field, body) => {
    const req = mockReq({ user: instructor, body });
    const res = mockRes();

    await createQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.question.create).not.toHaveBeenCalled();
  });
});

describe("updateQuestion", () => {
  it("returns 404 for a missing question", async () => {
    prisma.question.findUnique.mockResolvedValue(null);
    const req = mockReq({ user: instructor, params: { id: "99" }, body: { title: "x" } });
    const res = mockRes();

    await updateQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes orphaned answer options when type changes MCQ -> OPEN", async () => {
    prisma.question.findUnique.mockResolvedValue({
      id: 5,
      type: "MULTIPLE_CHOICE",
      answerOptions: [{ id: 1 }, { id: 2 }],
    });
    prisma.question.update.mockResolvedValue({ id: 5, type: "OPEN" });

    const req = mockReq({
      user: instructor,
      params: { id: "5" },
      body: { type: "OPEN" }, // no options sent
    });
    const res = mockRes();

    await updateQuestion(req, res);

    const data = prisma.question.update.mock.calls[0][0].data;
    expect(data.answerOptions).toEqual({ deleteMany: {} });
  });

  it("replaces options atomically when new options are sent for an MCQ", async () => {
    prisma.question.findUnique.mockResolvedValue({
      id: 5,
      type: "MULTIPLE_CHOICE",
      answerOptions: [],
    });
    prisma.question.update.mockResolvedValue({ id: 5 });

    const req = mockReq({
      user: instructor,
      params: { id: "5" },
      body: {
        options: [
          { text: "New A", isCorrect: false },
          { text: "New B", isCorrect: true },
        ],
      },
    });
    const res = mockRes();

    await updateQuestion(req, res);

    const data = prisma.question.update.mock.calls[0][0].data;
    expect(data.answerOptions.deleteMany).toEqual({});
    expect(data.answerOptions.create).toHaveLength(2);
  });

  it("rejects options when the (updated) type is not MCQ", async () => {
    prisma.question.findUnique.mockResolvedValue({ id: 5, type: "OPEN", answerOptions: [] });

    const req = mockReq({
      user: instructor,
      params: { id: "5" },
      body: { options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }] },
    });
    const res = mockRes();

    await updateQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.question.update).not.toHaveBeenCalled();
  });
});

describe("updateQuestionStatus — status transitions (business rule)", () => {
  it.each(["DRAFT", "NEEDS_REVIEW", "INVALID", ""])(
    "rejects disallowed status %p with 400",
    async (status) => {
      const req = mockReq({ user: instructor, params: { id: "5" }, body: { status } });
      const res = mockRes();

      await updateQuestionStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(prisma.question.update).not.toHaveBeenCalled();
    }
  );

  it("returns 404 for a missing question", async () => {
    prisma.question.findUnique.mockResolvedValue(null);
    const req = mockReq({ user: instructor, params: { id: "99" }, body: { status: "APPROVED" } });
    const res = mockRes();

    await updateQuestionStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it.each(["APPROVED", "REJECTED"])("stamps reviewedAt when moving to %s", async (status) => {
    prisma.question.findUnique.mockResolvedValue({ id: 5 });
    prisma.question.update.mockResolvedValue({ id: 5, status });

    const req = mockReq({ user: instructor, params: { id: "5" }, body: { status } });
    const res = mockRes();

    await updateQuestionStatus(req, res);

    const data = prisma.question.update.mock.calls[0][0].data;
    expect(data.status).toBe(status);
    expect(data.reviewedAt).toBeInstanceOf(Date);
  });

  it.each(["REVIEW", "ARCHIVED"])("does NOT stamp reviewedAt for %s", async (status) => {
    prisma.question.findUnique.mockResolvedValue({ id: 5 });
    prisma.question.update.mockResolvedValue({ id: 5, status });

    const req = mockReq({ user: instructor, params: { id: "5" }, body: { status } });
    const res = mockRes();

    await updateQuestionStatus(req, res);

    const data = prisma.question.update.mock.calls[0][0].data;
    expect(data.reviewedAt).toBeUndefined();
  });
});

describe("deleteQuestion", () => {
  it("returns { message } JSON on success (not 204)", async () => {
    prisma.question.delete.mockResolvedValue({ id: 5 });
    const req = mockReq({ user: instructor, params: { id: "5" } });
    const res = mockRes();

    await deleteQuestion(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Question deleted" });
    expect(res.status).not.toHaveBeenCalledWith(204);
  });

  it("returns the error message with 500 when the delete fails (e.g. FK in use)", async () => {
    prisma.question.delete.mockRejectedValue(new Error("FK constraint"));
    const req = mockReq({ user: instructor, params: { id: "5" } });
    const res = mockRes();

    await deleteQuestion(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "FK constraint" });
  });
});
