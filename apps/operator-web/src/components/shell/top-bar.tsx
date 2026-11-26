"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Voltmark } from "@/components/voltmark";
import { resolveRouteMeta } from "@/lib/routes";
import { MobileNav } from "./mobile-nav";

function BreadcrumbSeparator() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      className="shrink-0 text-[color:var(--vg-text-secondary)]"
    >
      <path
        d="m6 4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Contextual top bar with mobile drawer trigger, single-decoded breadcrumbs,
 * and route-preserving manual refresh control.
 */
export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const routeMeta = resolveRouteMeta(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--vg-border)] bg-[color:var(--vg-surface)]">
      <div className="mx-auto flex min-h-[var(--vg-topbar-height)] max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5 md:hidden">
          <MobileNav />
          <Link
            href="/"
            aria-label="VoltGrid overview"
            className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            <Voltmark variant="primary" size="sm" decorative />
          </Link>
        </div>

        <nav
          aria-label="Breadcrumb"
          className="order-last w-full min-w-0 pb-1 sm:pb-0 md:order-none md:w-auto md:flex-1"
        >
          <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] leading-[1.25rem]">
            {routeMeta.breadcrumbs.map((crumb, index) => {
              const isLast = index === routeMeta.breadcrumbs.length - 1;
              const textStyle = crumb.mono
                ? "font-mono text-[0.8125rem]"
                : "font-sans";

              return (
                <li
                  key={`${crumb.label}-${index}`}
                  className="inline-flex min-w-0 items-center gap-1.5"
                >
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  {crumb.href && !crumb.current ? (
                    <Link
                      href={crumb.href}
                      className={`inline-flex min-h-11 max-w-[12rem] items-center truncate rounded-[var(--vg-radius-sm)] px-1 text-[color:var(--vg-text-secondary)] transition-colors duration-[var(--vg-transition-fast)] hover:text-[color:var(--vg-brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)] sm:max-w-[18rem] ${textStyle}`}
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={isLast || crumb.current ? "page" : undefined}
                      className={`max-w-[12rem] truncate px-1 sm:max-w-[20rem] ${textStyle} ${
                        isLast || crumb.current
                          ? "font-semibold text-[color:var(--vg-text-primary)]"
                          : "text-[color:var(--vg-text-secondary)]"
                      }`}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="ml-auto flex max-w-full flex-wrap items-center gap-2">
          <Link
            href="/admin"
            className="hidden items-center gap-1.5 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] px-2.5 py-1.5 font-sans text-xs font-semibold text-[color:var(--vg-text-secondary)] transition-colors hover:border-[color:var(--vg-brand)] hover:text-[color:var(--vg-brand)] sm:inline-flex"
            title="Commercial Administration & Multi-Tenant Management"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2 3.5 3.5v4c0 3 2 5 4.5 6 2.5-1 4.5-3 4.5-6v-4L8 2Z" />
              <path d="m6.5 8 1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Admin</span>
          </Link>

          <form method="post" action="/api/auth/logout">
            <button
              type="submit"
              className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] px-2.5 py-1.5 font-sans text-xs font-medium text-[color:var(--vg-text-secondary)]"
            >
              Sign out
            </button>
          </form>

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
      </div>
    </header>
  );
}
