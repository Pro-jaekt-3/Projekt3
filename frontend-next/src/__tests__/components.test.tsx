import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/firebase", () => ({
  auth: {},
}));

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

describe("StatusBadge", () => {
  it("renders the status text", () => {
    render(<StatusBadge status="Published" />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("derives the tone from a known status", () => {
    render(<StatusBadge status="Approved" />);
    // "Approved" maps to the success tone (emerald styling)
    expect(screen.getByText("Approved").className).toContain("emerald");
  });

  it("an explicit tone overrides the status mapping", () => {
    render(<StatusBadge status="Approved" tone="danger" />);
    expect(screen.getByText("Approved").className).toContain("rose");
  });

  it("falls back to neutral for an unknown status", () => {
    render(<StatusBadge status="Something Unmapped" />);
    expect(screen.getByText("Something Unmapped").className).toContain("bg-muted");
  });

  it("renders a custom icon next to the text", () => {
    render(<StatusBadge status="Local" icon={<svg data-testid="badge-icon" />} />);
    expect(screen.getByTestId("badge-icon")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        title="No questions attached"
        description="This assessment does not have any question rows yet."
      />,
    );

    expect(screen.getByRole("heading", { name: "No questions attached" })).toBeInTheDocument();
    expect(
      screen.getByText("This assessment does not have any question rows yet."),
    ).toBeInTheDocument();
  });

  it("omits the description block when not provided", () => {
    render(<EmptyState title="Nothing here" />);

    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeInTheDocument();
    expect(screen.queryByText(/does not have/)).not.toBeInTheDocument();
  });

  it("renders a clickable action", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(
      <EmptyState
        title="No trainings"
        action={<Button onClick={onCreate}>Create training</Button>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create training" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});

describe("Checkbox (MCQ multi-select interaction)", () => {
  // Mirrors how the assessment solver uses checkboxes: a controlled multi-select
  // where each toggle adds/removes an option id.
  function McqOptions() {
    const [selected, setSelected] = useState<number[]>([]);
    const options = [
      { id: 1, text: "SELECT" },
      { id: 2, text: "INSERT" },
      { id: 3, text: "UPDATE" },
    ];

    return (
      <div>
        {options.map((option) => (
          <label key={option.id}>
            <Checkbox
              checked={selected.includes(option.id)}
              onCheckedChange={(checked) =>
                setSelected((prev) =>
                  checked ? [...prev, option.id] : prev.filter((id) => id !== option.id),
                )
              }
            />
            {option.text}
          </label>
        ))}
        <output data-testid="selection">{JSON.stringify(selected)}</output>
      </div>
    );
  }

  it("allows selecting multiple options", async () => {
    const user = userEvent.setup();
    render(<McqOptions />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[2]);

    expect(screen.getByTestId("selection")).toHaveTextContent("[1,3]");
  });

  it("deselects a previously selected option on second click", async () => {
    const user = userEvent.setup();
    render(<McqOptions />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.click(checkboxes[0]);

    expect(screen.getByTestId("selection")).toHaveTextContent("[2]");
  });

  it("reflects checked state on the aria attribute", async () => {
    const user = userEvent.setup();
    render(<McqOptions />);

    const [first] = screen.getAllByRole("checkbox");
    expect(first).toHaveAttribute("aria-checked", "false");

    await user.click(first);

    expect(first).toHaveAttribute("aria-checked", "true");
  });
});
