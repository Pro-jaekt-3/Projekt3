import { useEffect, useState } from "react";

type Question = {
  id: number;
  title: string;
  description: string;
  difficulty: number;
};

function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState(1);

  const fetchQuestions = async () => {
    try {
      const response = await fetch("http://localhost:3000/questions");

      const data = await response.json();

      setQuestions(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description) {
      alert("Please fill all fields");
      return;
    }

    try {
      await fetch("http://localhost:3000/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          difficulty,
        }),
      });

      setTitle("");
      setDescription("");
      setDifficulty(1);

      fetchQuestions();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`http://localhost:3000/questions/${id}`, {
        method: "DELETE",
      });

      fetchQuestions();
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

          <button onClick={() => handleDelete(question.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default QuestionsPage;