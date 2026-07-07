// Deep mock of the shared prisma client (backend/prisma/client.js).
// Usage in a test file:
//   jest.mock("../prisma/client", () => require("./helpers/mockPrisma").createMockPrisma());
//   const prisma = require("../prisma/client"); // <- the mock instance
//
// $transaction passes the same mock object as `tx`, so controller code that
// runs inside a transaction hits the same jest.fn()s as code outside one.

const MODEL_METHODS = [
  "findUnique",
  "findFirst",
  "findMany",
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "count",
];

const MODELS = [
  "user",
  "training",
  "userTraining",
  "topic",
  "question",
  "answerOption",
  "equivalenceGroup",
  "assessment",
  "assessmentQuestion",
  "assessmentAttempt",
  "participantAnswer",
  "aiModel",
  "aiInteraction",
];

function createMockPrisma() {
  const prisma = {};

  for (const model of MODELS) {
    prisma[model] = {};
    for (const method of MODEL_METHODS) {
      prisma[model][method] = jest.fn();
    }
  }

  prisma.$transaction = jest.fn(async (arg) => {
    if (typeof arg === "function") {
      return arg(prisma);
    }
    return Promise.all(arg);
  });

  return prisma;
}

// Minimal express req/res doubles for controller unit tests.
function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 1, role: "INSTRUCTOR" },
    header: jest.fn(),
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

module.exports = { createMockPrisma, mockReq, mockRes };
