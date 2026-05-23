import { useEffect, useState } from "react";

type Topic = {
  id: number;
  name: string;
};

function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [name, setName] = useState("");

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
    fetchTopics();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) {
      alert("Please enter topic name");
      return;
    }

    try {
      await fetch("http://localhost:3000/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
        }),
      });

      setName("");

      fetchTopics();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`http://localhost:3000/topics/${id}`, {
        method: "DELETE",
      });

      fetchTopics();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Topics</h1>

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
          placeholder="Topic name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button type="submit">Add Topic</button>
      </form>

      {topics.map((topic) => (
        <div
          key={topic.id}
          style={{
            border: "1px solid gray",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <h3>{topic.name}</h3>

          <button onClick={() => handleDelete(topic.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

export default TopicsPage;