jest.mock("../prisma/client", () =>
  require("./helpers/mockPrisma").createMockPrisma()
);

const prisma = require("../prisma/client");
const { mockReq, mockRes } = require("./helpers/mockPrisma");
const {
  scopedListWhere,
  assertEnrollment,
  requireOwnership,
  requireEnrollment,
} = require("../middleware/scopeMiddleware");

describe("scopedListWhere — role matrix", () => {
  const admin = { id: 1, role: "ADMIN" };
  const instructor = { id: 2, role: "INSTRUCTOR" };
  const participant = { id: 3, role: "PARTICIPANT" };

  it("ADMIN sees all trainings but NO content lists", () => {
    expect(scopedListWhere(admin, "training")).toEqual({});
    expect(scopedListWhere(admin, "topic")).toBeNull();
    expect(scopedListWhere(admin, "question")).toBeNull();
    expect(scopedListWhere(admin, "assessment")).toBeNull();
    expect(scopedListWhere(admin, "equivalenceGroup")).toBeNull();
  });

  it("INSTRUCTOR lists are scoped through UserTraining ownership", () => {
    const membership = { some: { userId: 2, role: "INSTRUCTOR" } };

    expect(scopedListWhere(instructor, "training")).toEqual({ members: membership });
    expect(scopedListWhere(instructor, "topic")).toEqual({
      training: { members: membership },
    });
    expect(scopedListWhere(instructor, "question")).toEqual({
      topic: { training: { members: membership } },
    });
  });

  it("PARTICIPANT gets no list access at all", () => {
    expect(scopedListWhere(participant, "training")).toBeNull();
    expect(scopedListWhere(participant, "question")).toBeNull();
  });

  it("missing user gets null", () => {
    expect(scopedListWhere(null, "training")).toBeNull();
  });

  it("unknown resource type throws (programmer error, not a 404)", () => {
    expect(() => scopedListWhere(instructor, "nonsense")).toThrow(
      /Unknown resource type/
    );
  });
});

describe("assertEnrollment — /start invariant", () => {
  it("rejects a non-integer assessment id as 404", async () => {
    const result = await assertEnrollment(3, "abc");
    expect(result).toEqual({ ok: false, status: 404, error: "Assessment not found" });
  });

  it("rejects a missing assessment as 404", async () => {
    prisma.assessment.findUnique.mockResolvedValue(null);
    const result = await assertEnrollment(3, 7);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("rejects an unpublished assessment as 404 (status not revealed)", async () => {
    prisma.assessment.findUnique.mockResolvedValue({ id: 7, status: "DRAFT", trainingId: 1 });
    const result = await assertEnrollment(3, 7);
    expect(result.ok).toBe(false);
  });

  it("rejects a published assessment the user is not enrolled in", async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 7,
      status: "PUBLISHED",
      trainingId: 1,
    });
    prisma.userTraining.findUnique.mockResolvedValue(null);

    const result = await assertEnrollment(3, 7);
    expect(result.ok).toBe(false);
  });

  it("accepts a published assessment for an enrolled participant", async () => {
    const assessment = { id: 7, status: "PUBLISHED", trainingId: 1 };
    prisma.assessment.findUnique.mockResolvedValue(assessment);
    prisma.userTraining.findUnique.mockResolvedValue({ role: "PARTICIPANT" });

    const result = await assertEnrollment(3, 7);
    expect(result).toEqual({ ok: true, assessment });
  });

  it("rejects an INSTRUCTOR membership — enrollment requires PARTICIPANT role", async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 7,
      status: "PUBLISHED",
      trainingId: 1,
    });
    prisma.userTraining.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });

    const result = await assertEnrollment(3, 7);
    expect(result.ok).toBe(false);
  });
});

describe("requireOwnership middleware", () => {
  it("404s for a resource that does not exist", async () => {
    prisma.topic.findUnique.mockResolvedValue(null);
    const req = mockReq({ user: { id: 2, role: "INSTRUCTOR" }, params: { id: "9" } });
    const res = mockRes();
    const next = jest.fn();

    await requireOwnership("topic")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("403s an ADMIN on content resources (not a content collaborator)", async () => {
    prisma.topic.findUnique.mockResolvedValue({ trainingId: 1 });
    const req = mockReq({ user: { id: 1, role: "ADMIN" }, params: { id: "9" } });
    const res = mockRes();
    const next = jest.fn();

    await requireOwnership("topic")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows an ADMIN through for trainings", async () => {
    prisma.training.findUnique.mockResolvedValue({ id: 4 });
    const req = mockReq({ user: { id: 1, role: "ADMIN" }, params: { id: "4" } });
    const res = mockRes();
    const next = jest.fn();

    await requireOwnership("training")(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.scopedTrainingId).toBe(4);
  });

  it("404s an instructor on a foreign resource and passes an owner through", async () => {
    prisma.question.findUnique.mockResolvedValue({ topic: { trainingId: 5 } });

    // foreign
    prisma.userTraining.findUnique.mockResolvedValueOnce(null);
    const req1 = mockReq({ user: { id: 2, role: "INSTRUCTOR" }, params: { id: "10" } });
    const res1 = mockRes();
    const next1 = jest.fn();
    await requireOwnership("question")(req1, res1, next1);
    expect(res1.status).toHaveBeenCalledWith(404);
    expect(next1).not.toHaveBeenCalled();

    // owner
    prisma.userTraining.findUnique.mockResolvedValueOnce({ role: "INSTRUCTOR" });
    const req2 = mockReq({ user: { id: 2, role: "INSTRUCTOR" }, params: { id: "10" } });
    const res2 = mockRes();
    const next2 = jest.fn();
    await requireOwnership("question")(req2, res2, next2);
    expect(next2).toHaveBeenCalled();
    expect(req2.scopedTrainingId).toBe(5);
  });

  it("throws at construction for an unknown resource type", () => {
    expect(() => requireOwnership("bogus")).toThrow(/Unknown resource type/);
  });
});

describe("requireEnrollment middleware", () => {
  it("404s and stops when not enrolled", async () => {
    prisma.assessment.findUnique.mockResolvedValue(null);
    const req = mockReq({ user: { id: 3, role: "PARTICIPANT" }, body: { assessmentId: 7 } });
    const res = mockRes();
    const next = jest.fn();

    await requireEnrollment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches the published assessment and continues when enrolled", async () => {
    const assessment = { id: 7, status: "PUBLISHED", trainingId: 1 };
    prisma.assessment.findUnique.mockResolvedValue(assessment);
    prisma.userTraining.findUnique.mockResolvedValue({ role: "PARTICIPANT" });

    const req = mockReq({ user: { id: 3, role: "PARTICIPANT" }, body: { assessmentId: 7 } });
    const res = mockRes();
    const next = jest.fn();

    await requireEnrollment(req, res, next);

    expect(req.enrolledAssessment).toEqual(assessment);
    expect(next).toHaveBeenCalled();
  });
});
