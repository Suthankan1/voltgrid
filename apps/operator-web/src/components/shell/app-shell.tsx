import type { ReactNode } from "react";
import { MainContent } from "./main-content";
import { Sidebar } from "./sidebar";
import { ShellTopBar } from "./shell-navigation";

export interface AppShellProps {
  children: ReactNode;
}

/**
 * Shared VoltGrid application shell providing skip link, persistent sidebar,
 * top bar, and porcelain workspace `<main>` landmark.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[color:var(--vg-canvas)] text-[color:var(--vg-text-primary)] md:flex">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ShellTopBar />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
