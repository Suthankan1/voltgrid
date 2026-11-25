"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { VoltmarkLockup } from "@/components/voltmark";
import {
  NAV_GROUPS,
  isNavItemActive,
  isNavItemContextActive,
  resolveRouteMeta,
} from "@/lib/routes";
import { CloseIcon, MenuIcon, NavDestinationIcon } from "./nav-icons";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNav() {
  const pathname = usePathname();
  const routeMeta = resolveRouteMeta(pathname);
  const drawerId = useId();
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const restoreFocusOnCloseRef = useRef(false);
  const prevPathnameRef = useRef(pathname);

  const dismissDrawer = useCallback((restoreFocus: boolean) => {
    restoreFocusOnCloseRef.current = restoreFocus;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      restoreFocusOnCloseRef.current = false;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      if (restoreFocusOnCloseRef.current) {
        restoreFocusOnCloseRef.current = false;
        triggerRef.current?.focus();
      }
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismissDrawer(true);
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) {
        return;
      }

      const focusables = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !drawerRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (!active || active === last || !drawerRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, dismissDrawer]);

  return (
    <div className="flex items-center gap-2 md:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={drawerId}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-2 font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-text-primary)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
      >
        <MenuIcon />
        <span>
          <span className="sr-only">Open navigation </span>Menu
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            aria-hidden="true"
            onClick={() => dismissDrawer(true)}
            className="fixed inset-0 bg-[color:var(--vg-text-primary)]/45 transition-opacity duration-[var(--vg-transition-normal)] motion-reduce:transition-none"
          />

          <div
            ref={drawerRef}
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className="relative z-10 flex h-full w-full max-w-[18rem] flex-col justify-between overflow-y-auto border-r border-[color:var(--vg-border)] bg-[color:var(--vg-surface)] p-4"
          >
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-2 border-b border-[color:var(--vg-border)] pb-3">
                <Link
                  href="/"
                  aria-label="VoltGrid overview"
                  onClick={() => dismissDrawer(false)}
                  className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  <VoltmarkLockup size="sm" decorative />
                </Link>
                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={() => dismissDrawer(true)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  <CloseIcon />
                </button>
              </div>

              <nav aria-label="Mobile navigation" className="grid gap-5">
                {NAV_GROUPS.map(group => (
                  <div key={group.id} className="grid gap-1">
                    <p className="px-3 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[color:var(--vg-text-secondary)]">
                      {group.label}
                    </p>
                    <ul className="grid gap-1">
                      {group.items.map(item => {
                        const active = isNavItemActive(item, routeMeta);
                        const contextActive = isNavItemContextActive(item, routeMeta);

                        if (item.href === null) {
                          return (
                            <li key={item.id}>
                              <span
                                aria-disabled="true"
                                data-context-active={contextActive ? "true" : undefined}
                                className={`flex min-h-11 items-center justify-between gap-3 rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] leading-[1.25rem] ${
                                  contextActive
                                    ? "border-l-[3px] border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface-subtle)] font-semibold text-[color:var(--vg-text-primary)]"
                                    : "cursor-not-allowed text-[color:var(--vg-text-secondary)] opacity-75"
                                }`}
                              >
                                <span className="flex items-center gap-3">
                                  <NavDestinationIcon id={item.id} />
                                  <span>{item.label}</span>
                                </span>
                                <span className="rounded-full bg-[color:var(--vg-neutral-soft)] px-2 py-0.5 text-[0.6875rem] font-medium text-[color:var(--vg-neutral)]">
                                  Soon
                                </span>
                              </span>
                            </li>
                          );
                        }

                        return (
                          <li key={item.id}>
                            <Link
                              href={item.href}
                              aria-current={active ? "page" : undefined}
                              data-context-active={!active && contextActive ? "true" : undefined}
                              onClick={() => dismissDrawer(false)}
                              className={`flex min-h-11 items-center gap-3 rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] leading-[1.25rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)] ${
                                active
                                  ? "border-l-[3px] border-[color:var(--vg-brand)] bg-[color:var(--vg-brand-soft)] font-semibold text-[color:var(--vg-brand)]"
                                  : contextActive
                                    ? "border-l-[3px] border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface-subtle)] font-semibold text-[color:var(--vg-text-primary)]"
                                    : "text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)]"
                              }`}
                            >
                              <NavDestinationIcon id={item.id} />
                              <span>{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>

            <p className="mt-6 border-t border-[color:var(--vg-border)] px-2 pt-3 font-sans text-[0.75rem] leading-[1.125rem] text-[color:var(--vg-text-secondary)]">
              Operator console
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
