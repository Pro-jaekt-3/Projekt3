import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  Brain,
  BarChart3,
  BookOpen,
  Library,
  FileText,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { useRole, type Role } from "@/lib/role-context";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/users", label: "Users & Roles", icon: Users },
    { to: "/app/trainings", label: "All Trainings", icon: GraduationCap },
    { to: "/app/assessments", label: "All Assessments", icon: ClipboardList },
    { to: "/app/ai-models", label: "AI Models", icon: Brain },
    { to: "/app/ai-insights", label: "AI Insights", icon: Sparkles },
    { to: "/app/system-analytics", label: "System Analytics", icon: BarChart3 },
  ],
  instructor: [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/trainings", label: "My Trainings", icon: GraduationCap },
    { to: "/app/questions", label: "Question Bank", icon: Library },
    { to: "/app/assessments", label: "Assessments", icon: ClipboardList },
    { to: "/app/results", label: "Results", icon: BarChart3 },
    { to: "/app/ai-insights", label: "AI Insights", icon: Sparkles },
  ],
  participant: [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/my-assessments", label: "My Assessments", icon: FileText },
    { to: "/app/my-results", label: "My Results", icon: CheckSquare },
  ],
};

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV[role];

  return (
    <nav className="flex h-full flex-col gap-1">
      <div className="px-3 pb-4 pt-1">
        <Link to="/app/dashboard" className="flex items-center gap-2" onClick={onNavigate}>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">PROJEKT3</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {role}
            </div>
          </div>
        </Link>
      </div>
      <div className="px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.to ||
            (!item.exact && pathname.startsWith(item.to) && item.to !== "/app/dashboard") ||
            (item.to === "/app/dashboard" && pathname === "/app/dashboard");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="mt-auto px-3 pb-4 pt-6">
        <div className="rounded-md border bg-surface p-3">
          <div className="flex items-start gap-2">
            <BookOpen className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              <div className="font-medium text-foreground">Prototype mode</div>
              Static demo data only.
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
