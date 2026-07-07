jest.mock("../prisma/client", () =>
  require("./helpers/mockPrisma").createMockPrisma()
);

const prisma = require("../prisma/client");
const { mockReq, mockRes } = require("./helpers/mockPrisma");
const {
  startAttempt,
  submitAttempt,
  gradeAnswer,
} = require("../controllers/assessmentAttemptController");

const participant = { id: 20, role: "PARTICIPANT" };
const instructor = { id: 1, role: "INSTRUCTOR" };

// An attempt whose assessment has one MCQ (2 pts) and one OPEN question (1 pt).
const mcqOptions = [
  { id: 101, isCorrect: true },
  { id: 102, isCorrect: false },
];

function attemptFixture(overrides = {}) {
  return {
    id: 50,
    userId: 20,
    status: "IN_PROGRESS",
    assessment: {
      id: 7,
      trainingId: 3,
      questions: [
        {
          questionId: 10,
          points: 2,
          question: { id: 10, type: "MULTIPLE_CHOICE", answerOptions: mcqOptions },
        },
        {
          questionId: 11,
          points: 1,
          question: { id: 11, type: "OPEN", answerOptions: [] },
        },
      ],
    },
    ...overrides,
  };
}

describe("startAttempt", () => {
  it("rejects a second attempt on the same assessment with 409", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue({ id: 49 });

    const req = mockReq({
      user: participant,
      body: { assessmentId: 7 },
      enrolledAssessment: { id: 7 },
    });
    const res = mockRes();

    await startAttempt(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.assessmentAttempt.create).not.toHaveBeenCalled();
  });

  it("creates an IN_PROGRESS attempt for an enrolled participant", async () => {
    prisma.assessmentAttempt.findFirst.mockResolvedValue(null);
    prisma.assessmentAttempt.create.mockResolvedValue({
      id: 50,
      userId: 20,
      status: "IN_PROGRESS",
    });

    const req = mockReq({
      user: participant,
      body: { assessmentId: 7 },
      enrolledAssessment: { id: 7 },
    });
    const res = mockRes();

    await startAttempt(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const data = prisma.assessmentAttempt.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ assessmentId: 7, userId: 20, status: "IN_PROGRESS" });
  });

  it("rejects an invalid assessmentId", async () => {
    const req = mockReq({ user: participant, body: { assessmentId: "abc" } });
    const res = mockRes();

    await startAttempt(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("submitAttempt — auto-grading (business rule)", () => {
  it("requires an answers array", async () => {
    const req = mockReq({ user: participant, params: { id: "50" }, body: {} });
    const res = mockRes();

    await submitAttempt(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "answers array is required" });
  });

  it("returns 404 for a missing attempt", async () => {
    prisma.assessmentAttempt.findUnique.mockResolvedValue(null);
    const req = mockReq({ user: participant, params: { id: "50" }, body: { answers: [] } });
    const res = mockRes();

    await submitAttempt(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 403 for someone else's attempt", async () => {
    prisma.assessmentAttempt.findUnique.mockResolvedValue(attemptFixture({ userId: 999 }));
    prisma.userTraining.findUnique.mockResolvedValue(null);

    const req = mockReq({ user: participant, params: { id: "50" }, body: { answers: [] } });
    const res = mockRes();

    await submitAttempt(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects double submission", async () => {
    prisma.assessmentAttempt.findUnique.mockResolvedValue(
      attemptFixture({ status: "SUBMITTED" })
    );

    const req = mockReq({ user: participant, params: { id: "50" }, body: { answers: [] } });
    const res = mockRes();

    await submitAttempt(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Attempt has already been submitted" });
  });

  it("rejects duplicate answers for the same question", async () => {
    prisma.assessmentAttempt.findUnique.mockResolvedValue(attemptFixture());

    const req = mockReq({
      user: participant,
      params: { id: "50" },
      body: {
        answers: [
          { questionId: 10, selectedOptionId: 101 },
          { questionId: 10, selectedOptionId: 102 },
        ],
      },
    });
    const res = mockRes();

    await submitAttempt(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Duplicate answer for question 10" });
  });

  it("rejects answers to questions outside the assessment", async () => {
    prisma.assessmentAttempt.findUnique.mockResolvedValue(attemptFixture());

    const req = mockReq({
      user: participant,
      params: { id: "50" },
      body: { answers: [{ questionId: 999, selectedOptionId: 101 }] },
    });
    const res = mockRes();

    await submitAttempt(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Question 999 does not belong to this assessment",
    });
  });

  it("rejects an MCQ answer with an invalid option id", async () => {
    prisma.assessmentAttempt.findUnique.mockResolvedValue(attemptFixture());

    const req = mockReq({
      user: participant,
      params: { id: "50" },
      body: { answers: [{ questionId: 10, selectedOptionId: 555 }] },
    });
    const res = mockRes();

    await submitAttempt(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid selectedOptionId for question 10",
    });
  });

  it("auto-grades an MCQ-only submission straight to GRADED with the summed score", async () => {
    prisma.assessmentAttempt.findUnique.mockResolvedValue(attemptFixture());
    prisma.participantAnswer.count.mockResolvedValue(0); // nothing needs manual review
    prisma.participantAnswer.findMany.mockResolvedValue([{ pointsAwarded: 2 }]);
    prisma.assessmentAttempt.update.mockResolvedValue({ id: 50, status: "GRADED" });

    const req = mockReq({
      user: participant,
      params: { id: "50" },
      body: { answers: [{ questionId: 10, selectedOptionId: 101 }] }, // correct option
    });
    const res = mockRes();

    await submitAttempt(req, res);

    // answers were replaced atomically
    expect(prisma.participantAnswer.deleteMany).toHaveBeenCalledWith({
      where: { attemptId: 50 },
    });
    const created = prisma.participantAnswer.createMany.mock.calls[0][0].data;
    expect(created).toEqual([
      expect.objectContaining({
        questionId: 10,
        selectedOptionId: 101,
        isCorrect: true,
        pointsAwarded: 2,
        needsManualReview: false,
      }),
    ]);

    // finalize overrode SUBMITTED with GRADED and recomputed the score
    const updateData = prisma.assessmentAttempt.update.mock.calls[0][0].data;
    expect(updateData.status).toBe("GRADED");
    expect(updateData.score).toBe(2);
    expect(updateData.maxScore).toBe(3); // 2 (MCQ) + 1 (OPEN)
  });

  it("marks OPEN answers for manual review and keeps the attempt SUBMITTED", async () => {
    prisma.assessmentAttempt.findUnique.mockResolvedValue(attemptFixture());
    prisma.participantAnswer.count.mockResolvedValue(1); // OPEN answer pending
    prisma.assessmentAttempt.update.mockResolvedValue({ id: 50, status: "SUBMITTED" });

    const req = mockReq({
      user: participant,
      params: { id: "50" },
      body: {
        answers: [
          { questionId: 10, selectedOptionId: 102 }, // wrong MCQ
          { questionId: 11, textAnswer: "My open answer" },
        ],
      },
    });
    const res = mockRes();

    await submitAttempt(req, res);

    const created = prisma.participantAnswer.createMany.mock.calls[0][0].data;
    const openAnswer = created.find((a) => a.questionId === 11);
    expect(openAnswer).toMatchObject({
      answerText: "My open answer",
      isCorrect: null,
      pointsAwarded: null,
      needsManualReview: true,
    });

    const updateData = prisma.assessmentAttempt.update.mock.calls[0][0].data;
    expect(updateData.status).toBe("SUBMITTED"); // no GRADED override
    expect(updateData.score).toBe(0); // wrong MCQ scored 0
  });
});

describe("gradeAnswer — manual grading (business rule)", () => {
  function answerFixture(overrides = {}) {
    return {
      id: 70,
      attemptId: 50,
      questionId: 11,
      question: { type: "OPEN" },
      attempt: {
        id: 50,
        status: "SUBMITTED",
        assessment: {
          trainingId: 3,
          questions: [{ questionId: 11, points: 4 }],
        },
      },
      ...overrides,
    };
  }

  it("requires a boolean isCorrect", async () => {
    const req = mockReq({
      user: instructor,
      params: { attemptId: "50", answerId: "70" },
      body: { isCorrect: "yes" },
    });
    const res = mockRes();

    await gradeAnswer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "isCorrect must be a boolean" });
  });

  it("404s when the answer belongs to a different attempt", async () => {
    prisma.participantAnswer.findUnique.mockResolvedValue(answerFixture({ attemptId: 999 }));

    const req = mockReq({
      user: instructor,
      params: { attemptId: "50", answerId: "70" },
      body: { isCorrect: true },
    });
    const res = mockRes();

    await gradeAnswer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("404s (not 403) for an instructor who does not own the training", async () => {
    prisma.participantAnswer.findUnique.mockResolvedValue(answerFixture());
    prisma.userTraining.findUnique.mockResolvedValue(null); // not owner

    const req = mockReq({
      user: instructor,
      params: { attemptId: "50", answerId: "70" },
      body: { isCorrect: true },
    });
    const res = mockRes();

    await gradeAnswer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Attempt answer not found" });
  });

  it("rejects grading before the attempt is submitted", async () => {
    prisma.participantAnswer.findUnique.mockResolvedValue(
      answerFixture({ attempt: { ...answerFixture().attempt, status: "IN_PROGRESS" } })
    );
    prisma.userTraining.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });

    const req = mockReq({
      user: instructor,
      params: { attemptId: "50", answerId: "70" },
      body: { isCorrect: true },
    });
    const res = mockRes();

    await gradeAnswer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Attempt has not been submitted yet" });
  });

  it("refuses to manually grade MULTIPLE_CHOICE answers", async () => {
    prisma.participantAnswer.findUnique.mockResolvedValue(
      answerFixture({ question: { type: "MULTIPLE_CHOICE" } })
    );
    prisma.userTraining.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });

    const req = mockReq({
      user: instructor,
      params: { attemptId: "50", answerId: "70" },
      body: { isCorrect: true },
    });
    const res = mockRes();

    await gradeAnswer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "MULTIPLE_CHOICE answers are graded automatically",
    });
  });

  it.each([-1, 5, "abc"])(
    "rejects pointsAwarded=%p outside 0..questionPoints",
    async (pointsAwarded) => {
      prisma.participantAnswer.findUnique.mockResolvedValue(answerFixture());
      prisma.userTraining.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });

      const req = mockReq({
        user: instructor,
        params: { attemptId: "50", answerId: "70" },
        body: { isCorrect: true, pointsAwarded },
      });
      const res = mockRes();

      await gradeAnswer(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toMatch(/between 0 and 4/);
    }
  );

  it("defaults pointsAwarded to full/zero points from isCorrect and finalizes to GRADED", async () => {
    prisma.participantAnswer.findUnique.mockResolvedValue(answerFixture());
    prisma.userTraining.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });
    prisma.participantAnswer.count.mockResolvedValue(0); // last pending answer graded
    prisma.participantAnswer.findMany.mockResolvedValue([
      { pointsAwarded: 2 },
      { pointsAwarded: 4 },
    ]);
    prisma.assessmentAttempt.update.mockResolvedValue({ id: 50, status: "GRADED" });

    const req = mockReq({
      user: instructor,
      params: { attemptId: "50", answerId: "70" },
      body: { isCorrect: true }, // no explicit pointsAwarded
    });
    const res = mockRes();

    await gradeAnswer(req, res);

    const answerUpdate = prisma.participantAnswer.update.mock.calls[0][0].data;
    expect(answerUpdate).toMatchObject({
      isCorrect: true,
      pointsAwarded: 4, // full question points
      needsManualReview: false,
      gradedById: 1,
    });
    expect(answerUpdate.gradedAt).toBeInstanceOf(Date);

    const attemptUpdate = prisma.assessmentAttempt.update.mock.calls[0][0].data;
    expect(attemptUpdate).toEqual({ status: "GRADED", score: 6 });
  });

  it("leaves the attempt un-finalized while other answers still need review", async () => {
    prisma.participantAnswer.findUnique.mockResolvedValue(answerFixture());
    prisma.userTraining.findUnique.mockResolvedValue({ role: "INSTRUCTOR" });
    prisma.participantAnswer.count.mockResolvedValue(2); // still pending
    prisma.assessmentAttempt.update.mockResolvedValue({ id: 50, status: "SUBMITTED" });

    const req = mockReq({
      user: instructor,
      params: { attemptId: "50", answerId: "70" },
      body: { isCorrect: false },
    });
    const res = mockRes();

    await gradeAnswer(req, res);

    const attemptUpdate = prisma.assessmentAttempt.update.mock.calls[0][0].data;
    expect(attemptUpdate).toEqual({}); // finalize returned nothing to change
  });
});
