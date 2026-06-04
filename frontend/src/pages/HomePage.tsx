import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import Card from "../components/Card";
import PageContainer from "../components/PageContainer";

type DashboardAction = {
  title: string;
  description: string;
  to?: string;
  disabled?: boolean;
};

const adminActions: DashboardAction[] = [
  {
    title: "Manage Content",
    description:
      "Review trainings, topics, learning objectives and question groups.",
    to: "/trainings",
  },
  {
    title: "View Assessments",
    description:
      "Open the assessment list and check current test definitions.",
    to: "/assessments",
  },
  {
    title: "View Analytics",
    description:
      "Monitor performance by topic, learning objective and difficulty.",
    to: "/analytics",
  },
];

const instructorActions: DashboardAction[] = [
  {
    title: "Create Training",
    description:
      "Start the content structure for a course, module or practice set.",
    to: "/trainings",
  },
  {
    title: "Add Questions",
    description:
      "Build and review the question bank for assessments.",
    to: "/questions",
  },
  {
    title: "Create Assessment",
    description:
      "Select questions and assemble a quiz, pre-test or post-test.",
    to: "/assessments",
  },
  {
    title: "View Analytics",
    description:
      "Review assessment outcomes and identify weaker content areas.",
    to: "/analytics",
  },
];

const participantActions: DashboardAction[] = [
  {
    title: "View My Assessments",
    description:
      "See available assessments and start a new attempt.",
    to: "/my-assessments",
  },
  {
    title: "Continue Assessment",
    description:
      "Return to your assessment list and continue from the assigned test.",
    to: "/my-assessments",
  },
  {
    title: "View Results",
    description:
      "Results and feedback pages are planned for a later phase.",
    disabled: true,
  },
];

const guestActions: DashboardAction[] = [
  {
    title: "Sign In",
    description:
      "Use your account to open the dashboard for your role.",
    to: "/login",
  },
];

function getDashboardContent(role?: string | null) {
  if (role === "ADMIN") {
    return {
      eyebrow: "Admin dashboard",
      title: "Manage the PROJEKT3 assessment platform",
      description:
        "Use this entry point to supervise content, assessments and learning analytics.",
      actions: adminActions,
    };
  }

  if (role === "INSTRUCTOR") {
    return {
      eyebrow: "Instructor dashboard",
      title: "Prepare content and build assessments",
      description:
        "Move from training structure to questions, assessments and analytics without hunting through CRUD pages.",
      actions: instructorActions,
    };
  }

  if (role === "PARTICIPANT") {
    return {
      eyebrow: "Participant dashboard",
      title: "Open your assessments and track progress",
      description:
        "Start assigned assessments from one place. Results views will be added in a later phase.",
      actions: participantActions,
    };
  }

  return {
    eyebrow: "Welcome",
    title: "PROJEKT3 assessment system",
    description:
      "AI supported platform for question generation, exam creation and learning analytics.",
    actions: guestActions,
  };
}

function DashboardCard({ action }: { action: DashboardAction }) {
  return (
    <Card className="flex min-h-48 flex-col">
      <div className="flex-1">
        <h2 className="text-xl font-semibold text-slate-950">
          {action.title}
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          {action.description}
        </p>
      </div>

      {action.disabled || !action.to ? (
        <span className="mt-6 inline-flex w-fit rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">
          Coming soon
        </span>
      ) : (
        <Link
          to={action.to}
          className="mt-6 inline-flex w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Open
        </Link>
      )}
    </Card>
  );
}

function HomePage() {
  const { appUser, firebaseUser, isLoading } = useAuth();
  const dashboard = getDashboardContent(appUser?.role);

  return (
    <PageContainer>
      <section className="mb-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
          {dashboard.eyebrow}
        </p>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
          {dashboard.title}
        </h1>

        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
          {dashboard.description}
        </p>

        {!firebaseUser && !isLoading && (
          <p className="mt-5 text-sm text-slate-500">
            Sign in to see navigation and actions for your assigned role.
          </p>
        )}
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.actions.map((action) => (
          <DashboardCard
            key={action.title}
            action={action}
          />
        ))}
      </section>
    </PageContainer>
  );
}

export default HomePage;
