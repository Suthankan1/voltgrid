"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Voltmark } from "@/components/voltmark";
import { MobileNav } from "./mobile-nav";

export function ShellTopBar() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--vg-border)] bg-[color:var(--vg-surface)]">
      <div className="mx-auto flex min-h-[var(--vg-topbar-height)] max-w-[1440px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <MobileNav />
          <Link
            href="/"
            aria-label="VoltGrid overview"
            className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)] md:hidden"
          >
            <Voltmark variant="primary" size="sm" decorative />
          </Link>
          <p className="hidden font-sans text-[0.8125rem] font-medium text-[color:var(--vg-text-secondary)] md:block">
            VoltGrid Operator Console
          </p>
        </div>

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
