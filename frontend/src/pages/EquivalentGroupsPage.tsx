import { useEffect, useState } from "react";

import {
  getEquivalentGroups,
  createEquivalentGroup,
  addQuestionToGroup,
} from "../services/equivalentGroupService";

import { getQuestions } from "../services/questionService";

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
      <h1 className="text-6xl font-bold text-center mb-12">
        Equivalent Groups
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4 max-w-xl mb-10"
      >
        <input
          type="text"
          placeholder="Group name"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          className="border border-gray-300 rounded-lg px-4 py-3"
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
          className="border border-gray-300 rounded-lg px-4 py-3"
        />

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 font-medium transition"
        >
          Create Group
        </button>
      </form>

      <div className="grid gap-6">
        {groups.map((group) => (
          <div
            key={group.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
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
                className="border border-gray-300 rounded-lg px-4 py-2"
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
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
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