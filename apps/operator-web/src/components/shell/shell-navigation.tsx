"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { VoltmarkLockup } from "@/components/voltmark";
import { NAV_ITEMS, isNavItemActive, resolveRouteMeta } from "@/lib/routes";

export function ShellTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const routeMeta = resolveRouteMeta(pathname);
  const availableItems = NAV_ITEMS.filter(item => item.href !== null);

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--vg-border)] bg-[color:var(--vg-surface)]">
      <div className="mx-auto flex min-h-[var(--vg-topbar-height)] max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3 md:hidden">
          <Link
            href="/"
            aria-label="VoltGrid overview"
            className="inline-flex items-center rounded-[var(--vg-radius-md)] py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            <VoltmarkLockup size="sm" decorative />
          </Link>
          <nav aria-label="Mobile navigation" className="flex flex-wrap gap-1">
            {availableItems.map(item => {
              const active = isNavItemActive(item, routeMeta);

              return (
                <Link
                  key={item.id}
                  href={item.href!}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] leading-[1.25rem] ${
                    active
                      ? "bg-[color:var(--vg-brand-soft)] font-semibold text-[color:var(--vg-brand)]"
                      : "text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)]"
                  }`}
                >
                  {item.label}
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
