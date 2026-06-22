import { useNavigate } from "@tanstack/react-router";
import {
  LogOut,
  ChevronDown,
  User as UserIcon,
  Shield,
  GraduationCap,
  UserCircle2,
  Menu,
} from "lucide-react";
import { useRole, type Role } from "@/lib/role-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Props {
  onOpenSidebar?: () => void;
  pageTitle?: string;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  instructor: "Instructor",
  participant: "Participant",
};

const ROLE_ICON = {
  admin: Shield,
  instructor: GraduationCap,
  participant: UserCircle2,
};

export function TopBar({ onOpenSidebar, pageTitle }: Props) {
  const { role, user, setRole, logout } = useRole();
  const navigate = useNavigate();
  const RoleIcon = ROLE_ICON[role];

  const onLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur sm:px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenSidebar}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="truncate text-sm font-medium text-muted-foreground">{pageTitle}</div>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <RoleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">View as: {ROLE_LABEL[role]}</span>
              <span className="sm:hidden">{ROLE_LABEL[role]}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">
              Prototype role switcher
              <div className="mt-0.5 font-normal text-muted-foreground">
                Production roles come from auth.
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
              <DropdownMenuRadioItem value="admin">
                <Shield className="mr-2 h-4 w-4" /> Admin
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="instructor">
                <GraduationCap className="mr-2 h-4 w-4" /> Instructor
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="participant">
                <UserCircle2 className="mr-2 h-4 w-4" /> Participant
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-1.5">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="hidden h-3.5 w-3.5 opacity-60 sm:inline" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="font-medium">{user.name}</div>
              <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
              <div className="mt-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <RoleIcon className="h-3 w-3" />
                {ROLE_LABEL[role]}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <UserIcon className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
