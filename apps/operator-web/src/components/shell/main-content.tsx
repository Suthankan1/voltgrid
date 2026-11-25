import type { ReactNode } from "react";

export interface MainContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * Single `<main id="main-content">` landmark for the VoltGrid workspace.
 */
export function MainContent({ children, className }: MainContentProps) {
  const classes = [
    "min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 focus:outline-none",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main id="main-content" tabIndex={-1} className={classes}>
      <div className="mx-auto w-full max-w-[1440px]">{children}</div>
    </main>
  );
}
