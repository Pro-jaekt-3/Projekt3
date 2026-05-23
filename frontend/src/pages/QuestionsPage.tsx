import {
  getQuestions,
  createQuestion,
  deleteQuestion,
} from "../services/questionService";

import { useEffect, useState } from "react";

type Question = {
  id: number;
  title: string;
  description: string;
  difficulty: number;
  type: string;
};

type Topic = {
  id: number;
  name: string;
};

function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [topicId, setTopicId] = useState("");
  const [type, setType] = useState("OPEN");

  const loadQuestions = async () => {
    try {
      const data = await getQuestions();

      setQuestions(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchTopics = async () => {
    try {
      const response = await fetch("http://localhost:3000/topics");

      const data = await response.json();

      setTopics(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadQuestions();
    fetchTopics();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || !topicId) {
      alert("Please fill all fields");
      return;
    }

    try {
      await createQuestion({
        title,
        description,
        difficulty,
        topicId: Number(topicId),
        type,
      });

      setTitle("");
      setDescription("");
      setDifficulty(1);
      setTopicId("");
      setType("OPEN");

      loadQuestions();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteQuestion(id);

      loadQuestions();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Questions</h1>

      <form
        onSubmit={handleSubmit}
        style={{
          marginBottom: "30px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          maxWidth: "400px",
        }}
      >
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="number"
          min="1"
          max="5"
          placeholder="Difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(Number(e.target.value))}
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          >
          <option value="OPEN">
            Open Question
          </option>

          <option value="MULTIPLE_CHOICE">
            Multiple Choice
          </option>

          <option value="CODE">
            Code Question
          </option>
        </select>

        <select
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
        >
          <option value="">Select Topic</option>

          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>

        <button type="submit">Add Question</button>
      </form>

      {questions.map((question) => (
        <div
          key={question.id}
          style={{
            border: "1px solid gray",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <h3>{question.title}</h3>

          <p>{question.description}</p>

          <p>Difficulty: {question.difficulty}</p>

          <p>Type: {question.type}</p>

          <button onClick={() => handleDelete(question.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default QuestionsPage;