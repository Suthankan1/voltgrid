import Link from "next/link";
import type { SessionsDirectoryPagination as PaginationModel } from "@/lib/sessions-directory-model";

export interface SessionsDirectoryPaginationProps {
  pagination: PaginationModel;
  hasActiveFilters: boolean;
}

const DISABLED_CONTROL_CLASSES =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] px-4 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-secondary)] opacity-65";

const ACTIVE_LINK_CLASSES =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]";

/**
 * Server-pagination navigation bar preserving active filters and reporting
 * verified `page`, `totalPages`, and `totalElements` counts.
 */
export function SessionsDirectoryPagination({
  pagination,
  hasActiveFilters,
}: SessionsDirectoryPaginationProps) {
  if (pagination.displayTotalPages === 0 || pagination.totalElements === null) {
    return null;
  }

  return (
    <nav
      aria-label="Charging sessions pagination"
      className="flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--vg-border)] p-4 sm:px-6"
    >
      {pagination.previousHref ? (
        <Link href={pagination.previousHref} className={ACTIVE_LINK_CLASSES}>
          ← Previous page
        </Link>
      ) : (
        <span aria-disabled="true" className={DISABLED_CONTROL_CLASSES}>
          ← Previous page
        </span>
      )}

      <div className="min-w-0 text-center">
        <p className="font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)]">
          Page {pagination.displayPage} of {pagination.displayTotalPages}
        </p>
        <p className="mt-0.5 font-sans text-[0.75rem] text-[color:var(--vg-text-secondary)]">
          {pagination.rangeEnd > 0
            ? `Showing ${pagination.rangeStart}–${pagination.rangeEnd} of ${pagination.totalElements} ${hasActiveFilters ? "matching " : ""}${pagination.totalElements === 1 ? "session" : "sessions"}`
            : `${pagination.totalElements} ${hasActiveFilters ? "matching " : ""}${pagination.totalElements === 1 ? "session" : "sessions"}`}
        </p>
      </div>

      {pagination.nextHref ? (
        <Link href={pagination.nextHref} className={ACTIVE_LINK_CLASSES}>
          Next page →
        </Link>
      ) : (
        <span aria-disabled="true" className={DISABLED_CONTROL_CLASSES}>
          Next page →
        </span>
      )}
    </nav>
  );
}
