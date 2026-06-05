import { useEffect, useState } from "react";

import {
  getEquivalentGroups,
  createEquivalentGroup,
  addQuestionToGroup,
} from "../services/equivalentGroupService";

import { getQuestions } from "../services/questionService";
import { EmptyState, PageHeader } from "../components/ui";

type EquivalentGroup = {
  id: number;
  name: string;
  description?: string | null;
  questions?: {
    id: number;
    title: string;
  }[];
};

type Question = {
  id: number;
  title: string;
};

function EquivalentGroupsPage() {
  const [groups, setGroups] = useState<
    EquivalentGroup[]
  >([]);

  const [questions, setQuestions] = useState<
    Question[]
  >([]);

  const [selectedQuestionId, setSelectedQuestionId] =
    useState("");

  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");

  const loadGroups = async () => {
    try {
      const data =
        await getEquivalentGroups();

      setGroups(data);
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

  useEffect(() => {
    loadGroups();
    loadQuestions();
  }, []);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!name) {
      alert("Please enter group name");
      return;
    }

    try {
      await createEquivalentGroup(
        name,
        description
      );

      setName("");
      setDescription("");

      loadGroups();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddQuestion = async (
    groupId: number
  ) => {
    if (!selectedQuestionId) {
      alert("Please select a question");
      return;
    }

    try {
      await addQuestionToGroup(
        groupId,
        Number(selectedQuestionId)
      );

      loadGroups();

      alert("Question added to group");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <PageHeader
        eyebrow="Contextual question maintenance"
        title="Equivalent Groups"
        description="Maintain equivalent question groups for comparable assessment variants. This route stays out of primary navigation."
      />

      <form
        onSubmit={handleSubmit}
        className="app-card mb-10 grid max-w-3xl gap-4 p-6 md:grid-cols-[1fr_1fr_auto]"
      >
        <input
          type="text"
          placeholder="Group name"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          className="app-input"
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
          className="app-input"
        />

        <button
          type="submit"
          className="app-button-primary"
        >
          Create Group
        </button>
      </form>

      <div className="grid gap-6">
        {groups.length === 0 ? (
          <EmptyState
            title="No equivalent groups yet"
            description="Create a group, then add questions that should be treated as equivalent variants."
          />
        ) : groups.map((group) => (
          <div
            key={group.id}
            className="app-card p-6"
          >
            <h3 className="text-2xl font-semibold mb-2">
            {group.name}
          </h3>

          {group.description && (
            <p className="text-gray-600 mb-4">
              {group.description}
            </p>
          )}

          {group.questions &&
          group.questions.length > 0 && (
            <div className="mt-4 mb-4">
              <p className="font-medium mb-2">
                Questions:
              </p>

              <ul className="list-disc ml-6">
                {group.questions.map((question) => (
                  <li key={question.id}>
                    {question.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

            <div className="flex gap-3 items-center">
              <select
                value={selectedQuestionId}
                onChange={(e) =>
                  setSelectedQuestionId(
                    e.target.value
                  )
                }
                className="app-input max-w-md"
              >
                <option value="">
                  Select Question
                </option>

                {questions.map((question) => (
                  <option
                    key={question.id}
                    value={question.id}
                  >
                    {question.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  handleAddQuestion(group.id)
                }
                className="app-button-success"
              >
                Add Question
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EquivalentGroupsPage;
