"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Voltmark, VoltmarkLockup } from "@/components/voltmark";
import {
  NAV_GROUPS,
  isNavItemActive,
  isNavItemContextActive,
  resolveRouteMeta,
} from "@/lib/routes";
import { CollapseIcon, NavDestinationIcon } from "./nav-icons";

export function Sidebar() {
  const pathname = usePathname();
  const routeMeta = resolveRouteMeta(pathname);
  const [collapseOverride, setCollapseOverride] = useState<boolean | null>(null);
  const [isXlViewport, setIsXlViewport] = useState<boolean>(true);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => setIsXlViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const isExpanded =
    collapseOverride !== null ? !collapseOverride : isXlViewport;
  const isCompact = !isExpanded;

  const asideWidthClasses =
    collapseOverride === null
      ? "md:w-[var(--vg-sidebar-compact)] xl:w-[var(--vg-sidebar-width)]"
      : isCompact
        ? "md:w-[var(--vg-sidebar-compact)]"
        : "md:w-[var(--vg-sidebar-width)]";

  const labelVisibilityClass =
    collapseOverride === null
      ? "md:sr-only xl:not-sr-only"
      : isCompact
        ? "sr-only"
        : "";

  const expandedOnlyClass =
    collapseOverride === null
      ? "md:hidden xl:block"
      : isCompact
        ? "hidden"
        : "block";

  const compactOnlyClass =
    collapseOverride === null
      ? "md:flex xl:hidden"
      : isCompact
        ? "flex"
        : "hidden";

  const tooltipVisibilityClass =
    collapseOverride === null
      ? "md:block xl:hidden"
      : isCompact
        ? "block"
        : "hidden";

  function handleToggleCollapse() {
    setCollapseOverride(isExpanded);
  }

  return (
    <aside
      aria-label="Workspace sidebar"
      data-collapsed={isCompact ? "true" : "false"}
      className={`hidden border-r border-[color:var(--vg-border)] bg-[color:var(--vg-surface)] transition-[width] duration-[var(--vg-transition-normal)] md:sticky md:top-0 md:flex md:h-screen md:shrink-0 md:flex-col md:justify-between ${asideWidthClasses}`}
    >
      <div className="flex min-w-0 flex-col gap-5 p-3">
        <div
          className={`flex items-center ${
            isCompact && collapseOverride !== null
              ? "justify-center"
              : collapseOverride === null
                ? "md:justify-center xl:justify-between xl:px-2"
                : "justify-between px-2"
          } pt-1`}
        >
          <Link
            href="/"
            aria-label="VoltGrid overview"
            className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            <span className={expandedOnlyClass}>
              <VoltmarkLockup size="sm" decorative />
            </span>
            <span className={`items-center justify-center ${compactOnlyClass}`}>
              <Voltmark variant="primary" size="md" decorative />
            </span>
          </Link>
        </div>

        <nav aria-label="Primary navigation" className="grid min-w-0 gap-5">
          {NAV_GROUPS.map(group => (
            <div key={group.id} className="grid min-w-0 gap-1">
              <p
                className={`px-3 font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[color:var(--vg-text-secondary)] ${labelVisibilityClass}`}
              >
                {group.label}
              </p>

              <ul className="grid min-w-0 gap-1">
                {group.items.map(item => {
                  const active = isNavItemActive(item, routeMeta);
                  const contextActive = isNavItemContextActive(item, routeMeta);
                  const alignClass =
                    collapseOverride === null
                      ? "md:justify-center xl:justify-start"
                      : isCompact
                        ? "justify-center"
                        : "justify-start";

                  if (item.href === null) {
                    return (
                      <li key={item.id} className="group relative min-w-0">
                        <span
                          aria-disabled="true"
                          data-context-active={contextActive ? "true" : undefined}
                          title={`${item.label} (planned for ${item.deferredTo ?? "later slice"})`}
                          className={`flex min-h-11 min-w-0 items-center gap-3 rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] leading-[1.25rem] ${alignClass} ${
                            contextActive
                              ? "border-l-[3px] border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface-subtle)] font-semibold text-[color:var(--vg-text-primary)]"
                              : "cursor-not-allowed text-[color:var(--vg-text-secondary)] opacity-75"
                          }`}
                        >
                          <NavDestinationIcon id={item.id} />
                          <span className={`flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-1.5 gap-y-1 ${labelVisibilityClass}`}>
                            <span className="min-w-0 break-words">{item.label}</span>
                            <span className="shrink-0 rounded-full bg-[color:var(--vg-neutral-soft)] px-1.5 py-0.5 text-[0.6875rem] font-medium text-[color:var(--vg-neutral)]">
                              Soon
                            </span>
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute left-full top-1/2 z-40 ml-2 -translate-y-1/2 whitespace-nowrap rounded-[var(--vg-radius-sm)] bg-[color:var(--vg-text-primary)] px-2.5 py-1 font-sans text-[0.75rem] font-medium text-[color:var(--vg-text-inverse)] opacity-0 transition-opacity duration-[var(--vg-transition-fast)] group-hover:opacity-100 ${tooltipVisibilityClass}`}
                        >
                          {item.label} · Soon
                        </span>
                      </li>
                    );
                  }

                  return (
                    <li key={item.id} className="group relative min-w-0">
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        data-context-active={!active && contextActive ? "true" : undefined}
                        title={isCompact ? item.label : undefined}
                        className={`flex min-h-11 min-w-0 items-center gap-3 rounded-[var(--vg-radius-md)] px-3 py-2 font-sans text-[0.875rem] leading-[1.25rem] transition-colors duration-[var(--vg-transition-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)] ${alignClass} ${
                          active
                            ? "border-l-[3px] border-[color:var(--vg-brand)] bg-[color:var(--vg-brand-soft)] font-semibold text-[color:var(--vg-brand)]"
                            : contextActive
                              ? "border-l-[3px] border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface-subtle)] font-semibold text-[color:var(--vg-text-primary)]"
                              : "text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)]"
                        }`}
                      >
                        <NavDestinationIcon id={item.id} />
                        <span className={`min-w-0 break-words ${labelVisibilityClass}`}>
                          {item.label}
                        </span>
                      </Link>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute left-full top-1/2 z-40 ml-2 -translate-y-1/2 whitespace-nowrap rounded-[var(--vg-radius-sm)] bg-[color:var(--vg-text-primary)] px-2.5 py-1 font-sans text-[0.75rem] font-medium text-[color:var(--vg-text-inverse)] opacity-0 transition-opacity duration-[var(--vg-transition-fast)] group-hover:opacity-100 group-focus-within:opacity-100 ${tooltipVisibilityClass}`}
                      >
                        {item.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-[color:var(--vg-border)] p-3">
        <p
          className={`mb-2 px-2 font-sans text-[0.75rem] leading-[1.125rem] text-[color:var(--vg-text-secondary)] ${expandedOnlyClass}`}
        >
          Operator console
        </p>
        <button
          type="button"
          onClick={handleToggleCollapse}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          className={`flex min-h-11 w-full items-center gap-2 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] px-3 py-2 font-sans text-[0.8125rem] font-medium text-[color:var(--vg-text-secondary)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)] hover:text-[color:var(--vg-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)] ${
            collapseOverride === null
              ? "md:justify-center xl:justify-start"
              : isCompact
                ? "justify-center"
                : "justify-start"
          }`}
        >
          <CollapseIcon collapsed={isCompact} />
          <span className={labelVisibilityClass}>Collapse sidebar</span>
        </button>
      </div>
    </aside>
  );
}
