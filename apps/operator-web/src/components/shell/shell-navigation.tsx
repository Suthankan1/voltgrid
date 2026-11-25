"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { VoltmarkLockup } from "@/components/voltmark";

const TRANSITIONAL_TABS = [
  { href: "/", label: "Network" },
  { href: "/transactions", label: "Transactions" },
  { href: "/operations", label: "Operations" },
] as const;

export function ShellSidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Workspace sidebar"
      className="hidden border-r border-[color:var(--vg-border)] bg-[color:var(--vg-surface)] md:sticky md:top-0 md:flex md:h-screen md:w-[var(--vg-sidebar-width)] md:shrink-0 md:flex-col md:justify-between"
    >
      <div className="flex flex-col gap-6 p-4">
        <div className="px-2 pt-1">
          <Link
            href="/"
            aria-label="VoltGrid home"
            className="inline-flex rounded-[var(--vg-radius-md)] py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            <VoltmarkLockup size="sm" decorative />
          </Link>
          <p className="mt-1 font-sans text-[0.75rem] leading-[1.125rem] text-[color:var(--vg-text-secondary)]">
            Operator console
          </p>
        </div>

        <nav aria-label="Operator navigation" className="grid gap-1">
          {TRANSITIONAL_TABS.map(tab => {
            const active =
              tab.href === "/"
                ? pathname === "/" || pathname.startsWith("/stations/")
                : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] leading-[1.25rem] transition-colors duration-[var(--vg-transition-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)] ${
                  active
                    ? "border-l-[3px] border-[color:var(--vg-brand)] bg-[color:var(--vg-brand-soft)] font-semibold text-[color:var(--vg-brand)]"
                    : "text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function ShellTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--vg-border)] bg-[color:var(--vg-surface)]">
      <div className="mx-auto flex min-h-[var(--vg-topbar-height)] max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3 md:hidden">
          <Link
            href="/"
            aria-label="VoltGrid home"
            className="inline-flex items-center rounded-[var(--vg-radius-md)] py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            <VoltmarkLockup size="sm" decorative />
          </Link>
          <nav aria-label="Operator navigation" className="flex flex-wrap gap-1">
            {TRANSITIONAL_TABS.map(tab => {
              const active =
                tab.href === "/"
                  ? pathname === "/" || pathname.startsWith("/stations/")
                  : pathname.startsWith(tab.href);

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] leading-[1.25rem] ${
                    active
                      ? "bg-[color:var(--vg-brand-soft)] font-semibold text-[color:var(--vg-brand)]"
                      : "text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)]"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <p className="hidden font-sans text-[0.8125rem] font-medium text-[color:var(--vg-text-secondary)] md:block">
          VoltGrid Operator Console
        </p>

        <Button
          variant="secondary"
          size="md"
          pending={pending}
          pendingLabel="Refreshing…"
          onClick={() => startTransition(() => router.refresh())}
        >
          Refresh data
        </Button>
      </div>
    </header>
  );
}
