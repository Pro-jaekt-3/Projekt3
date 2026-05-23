import { useEffect, useState } from "react";

import {
  getTopics,
  createTopic,
  deleteTopic,
} from "../services/topicService";

type Topic = {
  id: number;
  name: string;
};

function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [name, setName] = useState("");

  const loadTopics = async () => {
    try {
      const data = await getTopics();

      setTopics(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) {
      alert("Please enter topic name");
      return;
    }

    try {
      await createTopic(name);

      setName("");

      loadTopics();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTopic(id);

      loadTopics();
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