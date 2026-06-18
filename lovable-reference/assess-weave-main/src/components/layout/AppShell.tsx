import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { SidebarNav } from "./SidebarNav";
import { TopBar } from "./TopBar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface Props {
  children: ReactNode;
  pageTitle?: string;
}

export function AppShell({ children, pageTitle }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen w-full bg-surface">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <SidebarNav />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
          <div className="flex h-full flex-col pt-4">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenSidebar={() => setMobileOpen(true)} pageTitle={pageTitle} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
