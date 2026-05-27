import { useState } from "react";

function TrainingsPage() {
  const [trainings, setTrainings] = useState([
    { id: 1, name: "Programiranje" },
    { id: 2, name: "Podatkovne baze" },
  ]);

  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) return;

    setTrainings([
      ...trainings,
      {
        id: Date.now(),
        name,
      },
    ]);

    setName("");
  };

  const handleDelete = (id: number) => {
  setTrainings(
    trainings.filter((training) => training.id !== id)
  );
};

  return (
    <div style={{ padding: "20px" }}>
      <h1>Trainings</h1>

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
          placeholder="Training name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button type="submit">
          Add Training
        </button>
      </form>

      {trainings.map((training) => (
        <div
          key={training.id}
          style={{
            border: "1px solid gray",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <h3>{training.name}</h3>

        <button
        onClick={() => handleDelete(training.id)}
        >
        Delete
        </button>
        </div>
      ))}
    </div>
  );
}

export default TrainingsPage;