import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  getAssessments,
  createAssessment,
  deleteAssessment,
  updateAssessment,
  updateAssessmentStatus,
} from "../services/assessmentService";

import { getQuestions } from "../services/questionService";
import { getLearningObjectives } from "../services/learningObjectiveService";
import { getTopics } from "../services/topicService";
import { getTrainings } from "../services/trainingService";
import {
  EmptyState,
  FormSection,
  KeyValue,
  PageHeader,
  StatusBadge,
  Stepper,
} from "../components/ui";

type Assessment = {
  id: number;
  title: string;
  description?: string | null;
  type: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  trainingId?: number;
  training?: {
    id: number;
    title: string;
  };
  questions?: {
    id: number;
    questionId?: number;
    question: {
      id: number;
      title: string;
    };
  }[];
};

type Question = {
  id: number;
  title: string;
  status?: string;
  difficulty?: number;
  topicId?: number;
  topic?: {
    id: number;
    name: string;
    trainingId?: number;
  };
  learningObjectiveId?: number;
  learningObjective?: {
    id: number;
    title: string;
  };
};

type Training = {
  id: number;
  title: string;
};

type Topic = {
  id: number;
  name: string;
  trainingId: number;
};

type LearningObjective = {
  id: number;
  title: string;
  topicId: number;
};

function AssessmentsPage() {
  const [searchParams] = useSearchParams();
  const initialTrainingId =
    searchParams.get("trainingId") || "";

  const [assessments, setAssessments] =
    useState<Assessment[]>([]);

  const [questions, setQuestions] =
    useState<Question[]>([]);

  const [trainings, setTrainings] =
    useState<Training[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [learningObjectives, setLearningObjectives] =
    useState<LearningObjective[]>([]);

  const [selectedQuestions, setSelectedQuestions] =
    useState<number[]>([]);

  const [previewAssessmentId, setPreviewAssessmentId] =
    useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");
  const [trainingId, setTrainingId] =
    useState(initialTrainingId);
  const [type, setType] = useState("QUIZ");
  const [topicFilter, setTopicFilter] = useState("");
  const [learningObjectiveFilter, setLearningObjectiveFilter] =
    useState("");
  const [difficultyFilter, setDifficultyFilter] =
    useState("");
  const [editingAssessmentId, setEditingAssessmentId] =
    useState<number | null>(null);
  const [formError, setFormError] = useState("");

  const selectedTrainingId = trainingId
    ? Number(trainingId)
    : null;

  const wizardStep = !title || !trainingId
    ? 1
    : selectedQuestions.length === 0
      ? 2
      : 3;

  const trainingTopics = useMemo(
    () =>
      selectedTrainingId
        ? topics.filter(
            (topic) =>
              topic.trainingId === selectedTrainingId
          )
        : [],
    [selectedTrainingId, topics]
  );

  const filteredLearningObjectives = useMemo(() => {
    if (!topicFilter) {
      const topicIds = new Set(
        trainingTopics.map((topic) => topic.id)
      );

      return learningObjectives.filter((objective) =>
        topicIds.has(objective.topicId)
      );
    }

    return learningObjectives.filter(
      (objective) =>
        objective.topicId === Number(topicFilter)
    );
  }, [
    learningObjectives,
    topicFilter,
    trainingTopics,
  ]);

  const availableQuestions = useMemo(() => {
    return questions.filter(
      (question) => {
        const questionTopicId =
          question.topicId ?? question.topic?.id;
        const questionTrainingId =
          question.topic?.trainingId ??
          topics.find(
            (topic) => topic.id === questionTopicId
          )?.trainingId;
        const questionLearningObjectiveId =
          question.learningObjectiveId ??
          question.learningObjective?.id;

        if (!selectedTrainingId) {
          return false;
        }

        if (question.status !== "APPROVED") {
          return false;
        }

        if (questionTrainingId !== selectedTrainingId) {
          return false;
        }

        if (
          topicFilter &&
          questionTopicId !== Number(topicFilter)
        ) {
          return false;
        }

        if (
          learningObjectiveFilter &&
          questionLearningObjectiveId !==
            Number(learningObjectiveFilter)
        ) {
          return false;
        }

        if (
          difficultyFilter &&
          question.difficulty !== Number(difficultyFilter)
        ) {
          return false;
        }

        return true;
      }
    );
  }, [
    difficultyFilter,
    learningObjectiveFilter,
    questions,
    selectedTrainingId,
    topicFilter,
    topics,
  ]);

  const loadAssessments = async () => {
    try {
      const data = await getAssessments();

      setAssessments(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadQuestions = async () => {
    try {
      const data = await getQuestions();

      setQuestions(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadTrainings = async () => {
    try {
      const data = await getTrainings();

      setTrainings(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadMetadata = async () => {
    try {
      const [topicData, objectiveData] =
        await Promise.all([
          getTopics(),
          getLearningObjectives(),
        ]);

      setTopics(topicData);
      setLearningObjectives(objectiveData);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadAssessments();
    loadQuestions();
    loadTrainings();
    loadMetadata();
  }, []);

  useEffect(() => {
    setSelectedQuestions((current) =>
      current.filter((questionId) => {
        const question = questions.find(
          (item) => item.id === questionId
        );
        const questionTopicId =
          question?.topicId ?? question?.topic?.id;
        const questionTrainingId =
          question?.topic?.trainingId ??
          topics.find(
            (topic) => topic.id === questionTopicId
          )?.trainingId;

        return (
          Boolean(selectedTrainingId) &&
          question?.status === "APPROVED" &&
          questionTrainingId === selectedTrainingId
        );
      })
    );
  }, [questions, selectedTrainingId, topics]);

  const handleQuestionToggle = (
    questionId: number
  ) => {
    if (
      selectedQuestions.includes(questionId)
    ) {
      setSelectedQuestions(
        selectedQuestions.filter(
          (id) => id !== questionId
        )
      );
    } else {
      setSelectedQuestions([
        ...selectedQuestions,
        questionId,
      ]);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTrainingId(initialTrainingId);
    setType("QUIZ");
    setSelectedQuestions([]);
    setTopicFilter("");
    setLearningObjectiveFilter("");
    setDifficultyFilter("");
    setEditingAssessmentId(null);
    setFormError("");
  };

  const handleTrainingChange = (value: string) => {
    setTrainingId(value);
    setSelectedQuestions([]);
    setTopicFilter("");
    setLearningObjectiveFilter("");
    setDifficultyFilter("");
    setFormError("");
  };

  const handleEdit = (assessment: Assessment) => {
    const status = assessment.status || "DRAFT";

    if (status !== "DRAFT") {
      return;
    }

    setEditingAssessmentId(assessment.id);
    setTitle(assessment.title);
    setDescription(assessment.description || "");
    setTrainingId(
      String(
        assessment.trainingId ??
          assessment.training?.id ??
          ""
      )
    );
    setType(assessment.type);
    setSelectedQuestions(
      assessment.questions?.map(
        (item) =>
          item.questionId ?? item.question.id
      ) || []
    );
    setTopicFilter("");
    setLearningObjectiveFilter("");
    setDifficultyFilter("");
    setFormError("");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setFormError("");

    if (
      !title ||
      !trainingId ||
      selectedQuestions.length === 0
    ) {
      setFormError(
        "Please enter title, training and select at least one question"
      );
      return;
    }

    try {
      const payload = {
        title,
        description,
        trainingId: Number(trainingId),
        type,
        questions: selectedQuestions,
      };

      if (editingAssessmentId) {
        await updateAssessment(
          editingAssessmentId,
          payload
        );
      } else {
        await createAssessment(payload);
      }

      resetForm();
      loadAssessments();
    } catch (error) {
      console.error(error);
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to save assessment."
      );
    }
  };

  const handleDelete = async (
    id: number
  ) => {
    try {
      await deleteAssessment(id);

      loadAssessments();
    } catch (error) {
      console.error(error);
    }
  };

  const handleStatusUpdate = async (
    id: number,
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
  ) => {
    try {
      await updateAssessmentStatus(id, status);

      loadAssessments();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <PageHeader
        eyebrow="Instructor assessment flow"
        title="Create and manage assessments"
        description={
          <>
            Create and manage assessments from approved questions. Participants
            start and solve available assessments from My Assessments.
          </>
        }
      />

      <div className="mb-6">
        <Stepper
          currentStep={wizardStep}
          steps={["Basic info", "Select questions", "Preview", "Availability"]}
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="mb-10 grid gap-6 lg:grid-cols-[1fr_20rem]"
      >
        <div className="grid gap-5">
          <FormSection
            title={editingAssessmentId ? "Edit draft assessment" : "Step 1: Basic info"}
            description="Name the assessment and add optional participant-facing context."
          >
            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="grid gap-4">
              <input
                type="text"
                placeholder="Assessment title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="app-input"
              />

              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="app-input min-h-[96px]"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Assessment type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="app-input"
                  >
                    <option value="QUIZ">Quiz</option>
                    <option value="PRE_TEST">Pre Test</option>
                    <option value="POST_TEST">Post Test</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Training
                  </label>
                  <select
                    value={trainingId}
                    onChange={(e) => handleTrainingChange(e.target.value)}
                    className="app-input"
                  >
                    <option value="">Select Training</option>
                    {trainings.map((training) => (
                      <option key={training.id} value={training.id}>
                        {training.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Step 2: Select questions"
            description={`Selected questions: ${selectedQuestions.length}. Only approved questions from the selected training are eligible.`}
          >
            {selectedTrainingId && (
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <select
                  value={topicFilter}
                  onChange={(e) => {
                    setTopicFilter(e.target.value);
                    setLearningObjectiveFilter("");
                  }}
                  className="app-input"
                >
                  <option value="">All topics</option>
                  {trainingTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>

                <select
                  value={learningObjectiveFilter}
                  onChange={(e) => setLearningObjectiveFilter(e.target.value)}
                  className="app-input"
                >
                  <option value="">All learning objectives</option>
                  {filteredLearningObjectives.map((objective) => (
                    <option key={objective.id} value={objective.id}>
                      {objective.title}
                    </option>
                  ))}
                </select>

                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="app-input"
                >
                  <option value="">All difficulties</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      Difficulty {value}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!selectedTrainingId ? (
              <EmptyState
                title="Select a training"
                description="Choose a training to select approved questions from its curriculum."
              />
            ) : questions.length === 0 ? (
              <EmptyState
                title="No questions available"
                description="Add questions before creating an assessment."
              />
            ) : availableQuestions.length === 0 ? (
              <EmptyState
                title="No approved questions"
                description="Approve questions for this training before building an assessment."
              />
            ) : (
              <div className="grid max-h-80 gap-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {availableQuestions.map((question) => (
                  <label
                    key={question.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition ${
                      selectedQuestions.includes(question.id)
                        ? "border-indigo-200 bg-indigo-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedQuestions.includes(question.id)}
                      onChange={() => handleQuestionToggle(question.id)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-950">
                        {question.title}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{question.learningObjective?.title || "No learning objective"}</span>
                        <span>Difficulty {question.difficulty ?? "N/A"}</span>
                      </span>
                    </span>
                    <StatusBadge status={question.status || "APPROVED"} tone="success" />
                  </label>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection
            title="Step 4: Availability"
            description="New assessments are saved as drafts. Publishing uses the existing status endpoint."
          >
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              Published assessments are visible to demo participants.
              Participant-specific assignment, QR access and live sessions are
              future work.
            </div>
          </FormSection>
        </div>

        <aside className="space-y-4">
          <section className="sticky top-28 rounded-xl border border-[var(--app-border)] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Step 3: Preview</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review structure before saving the draft.
            </p>

            <div className="mt-4 grid gap-3">
              <KeyValue label="Title" value={title || "Not set"} />
              <KeyValue label="Type" value={type} />
              <KeyValue
                label="Training"
                value={
                  trainings.find((training) => training.id === Number(trainingId))?.title ||
                  "Not selected"
                }
              />
              <KeyValue label="Questions" value={`${selectedQuestions.length} selected`} />
            </div>

            <button
              type="submit"
              className="app-button-primary mt-5 w-full disabled:opacity-60"
              disabled={!selectedTrainingId || availableQuestions.length === 0}
            >
              {editingAssessmentId ? "Save Draft Assessment" : "Create Assessment"}
            </button>

            {editingAssessmentId && (
              <button
                type="button"
                onClick={resetForm}
                className="app-button-secondary mt-3 w-full"
              >
                Cancel edit
              </button>
            )}
          </section>
        </aside>
      </form>

      <div className="mb-5">
        <h2 className="text-3xl font-bold text-slate-950">
          Assessment list
        </h2>

        <p className="mt-2 text-slate-600">
          Preview assessments here. Participants use My Assessments to
          start an attempt.
        </p>
      </div>

      <div className="grid gap-6">
        {assessments.length === 0 ? (
          <EmptyState
            title="No assessments yet"
            description="Create a draft assessment from approved questions, then publish it when ready."
          />
        ) : assessments.map(
          (assessment) => {
            const isPreviewOpen =
              previewAssessmentId === assessment.id;

            return (
              <div
                key={assessment.id}
                className="app-card p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold">
                      {assessment.title}
                    </h3>

                    {assessment.description && (
                      <p className="text-gray-600 mt-2">
                        {
                          assessment.description
                        }
                      </p>
                    )}
                  </div>

                  <StatusBadge status={assessment.type} tone="primary" />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusBadge status={assessment.status || "DRAFT"} />

                  <span className="text-sm text-slate-500">
                    {assessment.status === "PUBLISHED"
                      ? "Visible to demo participants"
                      : "Not available to participants"}
                  </span>
                </div>

                {isPreviewOpen && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Read-only preview
                    </p>

                    {assessment.questions &&
                    assessment.questions.length > 0 ? (
                      <ol className="list-decimal space-y-2 pl-5">
                        {assessment.questions.map((aq) => (
                          <li key={aq.id}>
                            {aq.question.title}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-slate-600">
                        No questions are attached to this assessment.
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewAssessmentId(
                        isPreviewOpen
                          ? null
                          : assessment.id
                      )
                    }
                    className="app-button-secondary"
                  >
                    {isPreviewOpen
                      ? "Hide Preview"
                      : "Preview"}
                  </button>

                  <Link
                    to={`/assessments/${assessment.id}/results`}
                    className="app-button-primary"
                  >
                    View Results
                  </Link>

                  {(assessment.status || "DRAFT") === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleEdit(assessment)
                      }
                      className="app-button-secondary"
                    >
                      Edit
                    </button>
                  )}

                  {(assessment.status || "DRAFT") === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusUpdate(
                          assessment.id,
                          "PUBLISHED"
                        )
                      }
                      className="app-button-success"
                    >
                      Publish
                    </button>
                  )}

                  {assessment.status === "PUBLISHED" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusUpdate(
                          assessment.id,
                          "ARCHIVED"
                        )
                      }
                      className="app-button-secondary"
                    >
                      Archive
                    </button>
                  )}

                  {assessment.status === "ARCHIVED" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusUpdate(
                          assessment.id,
                          "DRAFT"
                        )
                      }
                      className="app-button-secondary"
                    >
                      Move to Draft
                    </button>
                  )}

                  <button
                    onClick={() =>
                      handleDelete(
                        assessment.id
                      )
                    }
                    className="app-button-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

export default AssessmentsPage;
