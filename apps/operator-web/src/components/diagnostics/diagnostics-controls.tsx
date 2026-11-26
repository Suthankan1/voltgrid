"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { OperationalStatus } from "@/lib/operations-api";
import {
  buildDiagnosticsHref,
  normalizeDiagnosticsParams,
  type DiagnosticsFilterParams,
} from "@/lib/diagnostics-model";

export interface DiagnosticsControlsProps {
  filters: DiagnosticsFilterParams;
  hasActiveFilters: boolean;
}

const STATUS_OPTIONS: ReadonlyArray<{
  value: "" | OperationalStatus;
  label: string;
}> = [
  { value: "", label: "All projected statuses" },
  { value: "ONLINE", label: "Online" },
  { value: "OFFLINE", label: "Offline" },
  { value: "UNAVAILABLE", label: "Unavailable" },
];

/**
 * URL-backed Diagnostics filter and exact single-station lookup toolbar.
 * Submitting filters intentionally omits `after` so cursor state resets cleanly.
 */
export function DiagnosticsControls({
  filters,
  hasActiveFilters,
}: DiagnosticsControlsProps) {
  const router = useRouter();
  const showReset = hasActiveFilters || Boolean(filters.after);
  const formKey = `${filters.status}:${filters.stationId}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const normalized = normalizeDiagnosticsParams({
      status: String(formData.get("status") ?? ""),
      stationId: String(formData.get("stationId") ?? ""),
    });
    router.push(buildDiagnosticsHref(normalized));
  }

  return (
    <Card
      as="section"
      aria-labelledby="diagnostics-controls-title"
      padding="md"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="diagnostics-controls-title"
          className="font-sans text-[1rem] font-semibold leading-[1.5rem] text-[color:var(--vg-text-primary)]"
        >
          Filter projections or look up station
        </h2>
        <p className="font-sans text-[0.8125rem] leading-[1.25rem] text-[color:var(--vg-text-secondary)]">
          Applying filters resets cursor pagination to the first matching page.
        </p>
      </div>

      <form
        key={formKey}
        action="/diagnostics"
        method="get"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Projected status"
            htmlFor="diagnostics-status-select"
            description="Filter Operations Service cursor page by projected operational status."
          >
            {fieldProps => (
              <Select
                {...fieldProps}
                name="status"
                defaultValue={filters.status}
                options={STATUS_OPTIONS}
              />
            )}
          </FormField>

          <FormField
            label="Exact station lookup"
            htmlFor="diagnostics-station-input"
            description="Queries stationStatus(stationId) directly when provided; overrides status filter."
          >
            {fieldProps => (
              <Input
                {...fieldProps}
                name="stationId"
                type="search"
                mono
                maxLength={255}
                placeholder="CP-001"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                defaultValue={filters.stationId}
              />
            )}
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary">
            Apply filters
          </Button>
          {showReset ? (
            <Link
              href="/diagnostics"
              className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
            >
              Reset filters
            </Link>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
