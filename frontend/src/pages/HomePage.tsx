import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { ActionCard, MetricCard, PageHeader, SectionCard, StatusBadge } from "../components/ui";

function HomePage() {
  const { appUser } = useAuth();
  const isParticipant = appUser?.role === "PARTICIPANT";
  const isAdmin = appUser?.role === "ADMIN";

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <PageHeader
        eyebrow="Educational assessment platform"
        title="Assessment Workspace"
        description={
          <>
          Manage the flow from training curriculum to question bank,
          assessments, solving and results.
          </>
        }
      />

      {isAdmin ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Access" value="Roles" helper="Firebase auth plus backend role records." />
            <MetricCard label="Content" value="Trainings" helper="View all training workspaces." />
            <MetricCard label="Delivery" value="Assessments" helper="Monitor assessment lifecycle." />
            <MetricCard label="System" value="Analytics" helper="Use real submitted-attempt analytics." />
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <ActionCard
              title="Users & Roles"
              description="User administration is visible as an admin area, but write APIs are not implemented yet."
              meta={<StatusBadge status="MVP Limitation" tone="warning" />}
              action={<Link to="/admin/users" className="app-button-secondary">Open Users</Link>}
            />
            <ActionCard
              title="All Trainings"
              description="Review every training workspace and open the real instructor workspace when needed."
              action={<Link to="/admin/trainings" className="app-button-primary">Open Trainings</Link>}
            />
            <ActionCard
              title="All Assessments"
              description="Review draft, published and archived assessments, then open results."
              action={<Link to="/admin/assessments" className="app-button-primary">Open Assessments</Link>}
            />
            <ActionCard
              title="AI Models"
              description="Read configured AI model metadata without exposing provider secrets."
              action={<Link to="/admin/ai-models" className="app-button-secondary">Open AI Models</Link>}
            />
            <ActionCard
              title="System Analytics"
              description="Open topic, learning objective and difficulty analytics backed by real attempts."
              action={<Link to="/admin/system-analytics" className="app-button-secondary">Open Analytics</Link>}
            />
          </div>
        </>
      ) : isParticipant ? (
        <div className="grid gap-6 md:grid-cols-2">
          <SectionCard
            title="My Assessments"
            description={
              <>
              Start assessments that are available to you in the current
              MVP demo.
              </>
            }
          >
            <Link to="/my-assessments" className="app-button-primary">
              Open My Assessments
            </Link>
          </SectionCard>

          <SectionCard
            tone="warning"
            title="My Results"
            description="Result details open after a submitted attempt. A top-level results history is future work."
          >
            <span className="inline-flex rounded-lg border border-amber-300 bg-white/70 px-4 py-2 text-sm font-semibold text-amber-900">
              Available after submission
            </span>
          </SectionCard>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Workspace" value="Training" helper="Start with a central training workspace." />
          <MetricCard label="Content" value="Questions" helper="Draft, review and approve question content." />
          <MetricCard label="Delivery" value="Assessments" helper="Publish approved-question assessments." />
          <MetricCard label="Insight" value="Analytics" helper="Review submitted results and weak areas." />
        </div>
      )}

      {!isParticipant && !isAdmin && (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Link to="/trainings" className="app-button-primary">
            Open My Trainings
          </Link>
          <Link to="/questions" className="app-button-secondary">
            Review Question Bank
          </Link>
          <Link to="/assessments" className="app-button-secondary">
            Manage Assessments
          </Link>
        </div>
      )}
    </div>
  );
}

export default HomePage;
