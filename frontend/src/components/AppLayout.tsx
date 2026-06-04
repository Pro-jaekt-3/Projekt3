import type { ReactNode } from "react";

import Navbar from "./Navbar";

type AppLayoutProps = {
  children: ReactNode;
};

function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />

      <main>{children}</main>
    </div>
  );
}

export default AppLayout;
