import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DEFAULT_SESSION_PAGE_SIZE,
  SUPPORTED_SESSION_PAGE_SIZES,
  buildSessionsDirectoryHref,
  type SessionsDirectoryFilters,
} from "@/lib/sessions-directory-model";
import { getSessionCompletenessDisplay } from "@/components/ui/status-indicator";
import type { TransactionDataStatus } from "@/lib/station-api";

export interface SessionsDirectoryFiltersProps {
  filters: SessionsDirectoryFilters;
  hasActiveFilters: boolean;
}

const COMPLETENESS_OPTIONS: ReadonlyArray<{
  value: TransactionDataStatus | "";
  label: string;
}> = [
  { value: "", label: "All completeness states" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETE", label: "Complete" },
  { value: "INCOMPLETE", label: "Missing data" },
  { value: "UNKNOWN", label: "Unknown" },
];

/**
 * URL-backed server filter toolbar matching Station Service's exact `networkTransactionPage`
 * filter parameters without silent lowercasing or unsupported client search claims.
 */
export function SessionsDirectoryFiltersToolbar({
  filters,
  hasActiveFilters,
}: SessionsDirectoryFiltersProps) {
  const showReset =
    hasActiveFilters ||
    filters.page > 0 ||
    filters.size !== DEFAULT_SESSION_PAGE_SIZE;

  const sizeOptions = SUPPORTED_SESSION_PAGE_SIZES.includes(
    filters.size as (typeof SUPPORTED_SESSION_PAGE_SIZES)[number],
  )
    ? [...SUPPORTED_SESSION_PAGE_SIZES]
    : [...SUPPORTED_SESSION_PAGE_SIZES, filters.size].sort((a, b) => a - b);

  const formKey = `${filters.stationId ?? ""}:${filters.transactionId ?? ""}:${filters.integrityStatus ?? ""}:${filters.size}`;

  return (
    <Card
      as="section"
      aria-labelledby="sessions-filter-title"
      padding="md"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="sessions-filter-title"
          className="font-sans text-[1rem] font-semibold leading-[1.5rem] text-[color:var(--vg-text-primary)]"
        >
          Filter charging sessions
        </h2>
        <p className="font-sans text-[0.8125rem] leading-[1.25rem] text-[color:var(--vg-text-secondary)]">
          Applying filters queries Station Service from page 1.
        </p>
      </div>

      <form
        key={formKey}
        action="/sessions"
        method="get"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(150px,0.7fr)_auto]"
      >
        <FormField
          label="Station identifier"
          htmlFor="sessions-filter-station"
          description="Exact case-sensitive identifier."
        >
          {fieldProps => (
            <Input
              {...fieldProps}
              name="stationId"
              type="search"
              mono
              placeholder="CP-001"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={filters.stationId ?? ""}
            />
          )}
        </FormField>

        <FormField
          label="Session identifier"
          htmlFor="sessions-filter-transaction"
          description="Case-preserved identifier filter."
        >
          {fieldProps => (
            <Input
              {...fieldProps}
              name="transactionId"
              type="search"
              mono
              placeholder="TX-001"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={filters.transactionId ?? ""}
            />
          )}
        </FormField>

        <FormField
          label="Data completeness"
          htmlFor="sessions-filter-completeness"
          description="Receipt integrity domain."
        >
          {fieldProps => (
            <Select
              {...fieldProps}
              name="integrityStatus"
              defaultValue={filters.integrityStatus ?? ""}
              options={COMPLETENESS_OPTIONS}
            />
          )}
        </FormField>

        <FormField
          label="Per page"
          htmlFor="sessions-filter-size"
          description="Server page size."
        >
          {fieldProps => (
            <Select
              {...fieldProps}
              name="size"
              defaultValue={String(filters.size)}
              options={sizeOptions.map(count => ({
                value: String(count),
                label: `${count} rows`,
              }))}
            />
          )}
        </FormField>

        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-1 xl:pt-6">
          <Button type="submit" variant="primary" size="md">
            Apply filters
          </Button>
          {showReset ? (
            <Link
              href="/sessions"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-text-primary)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
            >
              Clear filters
            </Link>
          ) : null}
        </div>
      </form>

      {hasActiveFilters ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[color:var(--vg-border)] pt-4">
          <span className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-secondary)]">
            Active filters
          </span>

          {filters.stationId ? (
            <Link
              href={buildSessionsDirectoryHref({
                ...filters,
                stationId: null,
                page: 0,
              })}
              aria-label={`Remove station filter ${filters.stationId}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface-subtle)] px-3 py-1 font-mono text-[0.75rem] text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
            >
              <span>Station: {filters.stationId}</span>
              <span aria-hidden="true">×</span>
            </Link>
          ) : null}

          {filters.transactionId ? (
            <Link
              href={buildSessionsDirectoryHref({
                ...filters,
                transactionId: null,
                page: 0,
              })}
              aria-label={`Remove session filter ${filters.transactionId}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface-subtle)] px-3 py-1 font-mono text-[0.75rem] text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
            >
              <span>Session: {filters.transactionId}</span>
              <span aria-hidden="true">×</span>
            </Link>
          ) : null}

          {filters.integrityStatus ? (
            <Link
              href={buildSessionsDirectoryHref({
                ...filters,
                integrityStatus: null,
                page: 0,
              })}
              aria-label={`Remove completeness filter ${getSessionCompletenessDisplay(filters.integrityStatus).label}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface-subtle)] px-3 py-1 font-sans text-[0.75rem] font-medium text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-brand-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
            >
              <span>
                Completeness: {getSessionCompletenessDisplay(filters.integrityStatus).label}
              </span>
              <span aria-hidden="true">×</span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
