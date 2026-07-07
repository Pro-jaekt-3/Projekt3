jest.mock("../prisma/client", () =>
  require("./helpers/mockPrisma").createMockPrisma()
);

const prisma = require("../prisma/client");
const { mockReq, mockRes } = require("./helpers/mockPrisma");
const {
  createEquivalenceGroup,
  addQuestionToGroup,
  removeQuestionFromGroup,
} = require("../controllers/equivalenceGroupController");

const instructor = { id: 1, role: "INSTRUCTOR" };

describe("createEquivalenceGroup", () => {
  it("requires trainingId", async () => {
    const req = mockReq({ user: instructor, body: { title: "Variants" } });
    const res = mockRes();

    await createEquivalenceGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "trainingId is required" });
  });

  it("returns 404 for a training the caller does not own", async () => {
    prisma.userTraining.findUnique.mockResolvedValue(null);
    const req = mockReq({ user: instructor, body: { title: "V", trainingId: 9 } });
    const res = mockRes();

    await createEquivalenceGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(prisma.equivalenceGroup.create).not.toHaveBeenCalled();
  });

  it("normalises a whitespace-only title to null", async () => {
    prisma.userTraining.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });
    prisma.equivalenceGroup.create.mockResolvedValue({ id: 1 });

    const req = mockReq({ user: instructor, body: { title: "   ", trainingId: 3 } });
    const res = mockRes();

    await createEquivalenceGroup(req, res);

    expect(prisma.equivalenceGroup.create.mock.calls[0][0].data.title).toBeNull();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("addQuestionToGroup — training-scope invariant (business rule)", () => {
  it("requires questionId", async () => {
    const req = mockReq({ user: instructor, params: { id: "4" }, body: {} });
    const res = mockRes();

    await addQuestionToGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "questionId is required" });
  });

  it("returns 404 when the group does not exist", async () => {
    prisma.equivalenceGroup.findUnique.mockResolvedValue(null);
    const req = mockReq({ user: instructor, params: { id: "4" }, body: { questionId: 17 } });
    const res = mockRes();

    await addQuestionToGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Equivalence group not found" });
  });

  it("returns 404 when the question does not exist", async () => {
    prisma.equivalenceGroup.findUnique.mockResolvedValue({ id: 4, trainingId: 1 });
    prisma.question.findUnique.mockResolvedValue(null);
    const req = mockReq({ user: instructor, params: { id: "4" }, body: { questionId: 17 } });
    const res = mockRes();

    await addQuestionToGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Question not found" });
  });

  it("is idempotent when the question is already in this group", async () => {
    prisma.equivalenceGroup.findUnique.mockResolvedValue({ id: 4, trainingId: 1 });
    const question = { id: 17, equivalenceGroupId: 4, topic: { trainingId: 1 } };
    prisma.question.findUnique.mockResolvedValue(question);

    const req = mockReq({ user: instructor, params: { id: "4" }, body: { questionId: 17 } });
    const res = mockRes();

    await addQuestionToGroup(req, res);

    expect(res.json).toHaveBeenCalledWith(question);
    expect(prisma.question.update).not.toHaveBeenCalled();
  });

  it("rejects a cross-training question with 409", async () => {
    prisma.equivalenceGroup.findUnique.mockResolvedValue({ id: 4, trainingId: 1 });
    prisma.question.findUnique.mockResolvedValue({
      id: 17,
      equivalenceGroupId: null,
      topic: { trainingId: 2 }, // different training
    });

    const req = mockReq({ user: instructor, params: { id: "4" }, body: { questionId: 17 } });
    const res = mockRes();

    await addQuestionToGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toMatch(/Training must match/);
    expect(prisma.question.update).not.toHaveBeenCalled();
  });

  it("rejects a question that already belongs to another group with 409", async () => {
    prisma.equivalenceGroup.findUnique.mockResolvedValue({ id: 4, trainingId: 1 });
    prisma.question.findUnique.mockResolvedValue({
      id: 17,
      equivalenceGroupId: 8, // different group
      topic: { trainingId: 1 },
    });

    const req = mockReq({ user: instructor, params: { id: "4" }, body: { questionId: 17 } });
    const res = mockRes();

    await addQuestionToGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toMatch(/already belongs/);
  });

  it("links a same-training, ungrouped question", async () => {
    prisma.equivalenceGroup.findUnique.mockResolvedValue({ id: 4, trainingId: 1 });
    prisma.question.findUnique.mockResolvedValue({
      id: 17,
      equivalenceGroupId: null,
      topic: { trainingId: 1 },
    });
    const updated = { id: 17, equivalenceGroupId: 4 };
    prisma.question.update.mockResolvedValue(updated);

    const req = mockReq({ user: instructor, params: { id: "4" }, body: { questionId: 17 } });
    const res = mockRes();

    await addQuestionToGroup(req, res);

    expect(prisma.question.update).toHaveBeenCalledWith({
      where: { id: 17 },
      data: { equivalenceGroupId: 4 },
    });
    expect(res.json).toHaveBeenCalledWith(updated);
  });
});

describe("removeQuestionFromGroup — singleton-group cleanup (business rule)", () => {
  it("rejects removal of a question that is not in the group", async () => {
    prisma.equivalenceGroup.findUnique.mockResolvedValue({ id: 4, trainingId: 1 });
    prisma.question.findUnique.mockResolvedValue({ id: 17, equivalenceGroupId: 8 });

    const req = mockReq({ user: instructor, params: { id: "4", questionId: "17" } });
    const res = mockRes();

    await removeQuestionFromGroup(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Question does not belong to this equivalence group",
    });
  });

  it("auto-deletes the group when fewer than 2 members remain", async () => {
    prisma.equivalenceGroup.findUnique.mockResolvedValue({ id: 4, trainingId: 1 });
    prisma.question.findUnique.mockResolvedValue({ id: 17, equivalenceGroupId: 4 });
    prisma.question.update.mockResolvedValue({ id: 17, equivalenceGroupId: null });
    prisma.question.count.mockResolvedValue(1); // one member left -> not a usable group

    const req = mockReq({ user: instructor, params: { id: "4", questionId: "17" } });
    const res = mockRes();

    await removeQuestionFromGroup(req, res);

    expect(prisma.equivalenceGroup.delete).toHaveBeenCalledWith({ where: { id: 4 } });
    expect(res.json).toHaveBeenCalledWith({ id: 17, equivalenceGroupId: null });
  });

  it("keeps the group when 2+ members remain", async () => {
    prisma.equivalenceGroup.findUnique.mockResolvedValue({ id: 4, trainingId: 1 });
    prisma.question.findUnique.mockResolvedValue({ id: 17, equivalenceGroupId: 4 });
    prisma.question.update.mockResolvedValue({ id: 17, equivalenceGroupId: null });
    prisma.question.count.mockResolvedValue(2);

    const req = mockReq({ user: instructor, params: { id: "4", questionId: "17" } });
    const res = mockRes();

    await removeQuestionFromGroup(req, res);

    expect(prisma.equivalenceGroup.delete).not.toHaveBeenCalled();
  });
});
