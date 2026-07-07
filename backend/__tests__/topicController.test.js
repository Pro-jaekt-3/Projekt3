jest.mock("../prisma/client", () =>
  require("./helpers/mockPrisma").createMockPrisma()
);

const prisma = require("../prisma/client");
const { mockReq, mockRes } = require("./helpers/mockPrisma");
const {
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
} = require("../controllers/topicController");

const instructor = { id: 1, role: "INSTRUCTOR" };

describe("getTopics — list scoping", () => {
  it("returns 403 for a PARTICIPANT (scopedListWhere -> null)", async () => {
    const req = mockReq({ user: { id: 9, role: "PARTICIPANT" } });
    const res = mockRes();

    await getTopics(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.topic.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 for an ADMIN — admin is not a content collaborator", async () => {
    const req = mockReq({ user: { id: 9, role: "ADMIN" } });
    const res = mockRes();

    await getTopics(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("scopes the instructor's list to owned trainings", async () => {
    prisma.topic.findMany.mockResolvedValue([]);
    const req = mockReq({ user: instructor });
    const res = mockRes();

    await getTopics(req, res);

    const where = prisma.topic.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      training: { members: { some: { userId: 1, role: "INSTRUCTOR" } } },
    });
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe("createTopic", () => {
  it("rejects an empty name", async () => {
    const req = mockReq({ user: instructor, body: { name: "   ", trainingId: 1 } });
    const res = mockRes();

    await createTopic(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Topic name is required" });
  });

  it("rejects a missing trainingId", async () => {
    const req = mockReq({ user: instructor, body: { name: "SQL" } });
    const res = mockRes();

    await createTopic(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "trainingId is required" });
  });

  it("returns 404 when the training does not exist", async () => {
    prisma.training.findUnique.mockResolvedValue(null);
    const req = mockReq({ user: instructor, body: { name: "SQL", trainingId: 99 } });
    const res = mockRes();

    await createTopic(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Training not found" });
  });

  it("returns 404 (existence not revealed) for a foreign training", async () => {
    prisma.training.findUnique.mockResolvedValue({ id: 99 });
    prisma.userTraining.findUnique.mockResolvedValue(null); // not owner

    const req = mockReq({ user: instructor, body: { name: "SQL", trainingId: 99 } });
    const res = mockRes();

    await createTopic(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.topic.create).not.toHaveBeenCalled();
  });

  it("creates the topic for an owned training", async () => {
    prisma.training.findUnique.mockResolvedValue({ id: 3 });
    prisma.userTraining.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });
    const created = { id: 1, name: "SQL", trainingId: 3 };
    prisma.topic.create.mockResolvedValue(created);

    const req = mockReq({ user: instructor, body: { name: "SQL", trainingId: "3" } });
    const res = mockRes();

    await createTopic(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
    // trainingId is coerced to a number for prisma
    expect(prisma.topic.create.mock.calls[0][0].data.trainingId).toBe(3);
  });
});

describe("updateTopic", () => {
  it("returns 404 for a missing topic", async () => {
    prisma.topic.findUnique.mockResolvedValue(null);
    const req = mockReq({ user: instructor, params: { id: "99" }, body: { name: "x" } });
    const res = mockRes();

    await updateTopic(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("rejects renaming to an empty string", async () => {
    prisma.topic.findUnique.mockResolvedValue({ id: 5 });
    const req = mockReq({ user: instructor, params: { id: "5" }, body: { name: "  " } });
    const res = mockRes();

    await updateTopic(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Topic name cannot be empty" });
  });

  it("blocks moving a topic into a foreign training with 404", async () => {
    prisma.topic.findUnique.mockResolvedValue({ id: 5 });
    prisma.training.findUnique.mockResolvedValue({ id: 8 });
    prisma.userTraining.findUnique.mockResolvedValue(null); // target training not owned

    const req = mockReq({ user: instructor, params: { id: "5" }, body: { trainingId: 8 } });
    const res = mockRes();

    await updateTopic(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.topic.update).not.toHaveBeenCalled();
  });
});

describe("deleteTopic", () => {
  it("returns 404 for a missing topic", async () => {
    prisma.topic.findUnique.mockResolvedValue(null);
    const req = mockReq({ user: instructor, params: { id: "99" } });
    const res = mockRes();

    await deleteTopic(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 204 with no body on success", async () => {
    prisma.topic.findUnique.mockResolvedValue({ id: 5 });
    prisma.topic.delete.mockResolvedValue({ id: 5 });

    const req = mockReq({ user: instructor, params: { id: "5" } });
    const res = mockRes();

    await deleteTopic(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("surfaces a 500 when the topic is still referenced (FK)", async () => {
    prisma.topic.findUnique.mockResolvedValue({ id: 5 });
    prisma.topic.delete.mockRejectedValue(new Error("Foreign key constraint failed"));

    const req = mockReq({ user: instructor, params: { id: "5" } });
    const res = mockRes();

    await deleteTopic(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Foreign key constraint failed" });
  });
});
