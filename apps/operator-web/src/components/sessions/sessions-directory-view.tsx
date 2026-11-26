"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { SessionsDirectoryModel } from "@/lib/sessions-directory-model";
import { SessionsDirectoryFiltersToolbar } from "./sessions-directory-filters";
import { SessionsDirectoryPagination } from "./sessions-directory-pagination";
import { SessionsDirectoryRecords } from "./sessions-directory-records";

type PageLifecycleFilter = "ALL" | "ACTIVE";

export interface SessionsDirectoryViewProps {
  model: SessionsDirectoryModel;
  errorFallback: ReactNode;
}

/**
 * Coordinates the URL-backed filter toolbar, server-paginated session records,
 * explicitly scoped current-page lifecycle toggle, and distinct empty/no-match/error states.
 */
export function SessionsDirectoryView({
  model,
  errorFallback,
}: SessionsDirectoryViewProps) {
  const [lifecycleFilter, setLifecycleFilter] =
    useState<PageLifecycleFilter>("ALL");

  const isLive = model.availability === "live";
  const visibleRows =
    lifecycleFilter === "ACTIVE"
      ? model.rows.filter(row => row.transaction.status === "ACTIVE")
      : model.rows;

  const { pagination } = model;
  const serverScopeLabel = !isLive
    ? "Unavailable"
    : pagination.totalElements === null
      ? "Unavailable"
      : pagination.rangeEnd > 0
        ? `Showing ${pagination.rangeStart}–${pagination.rangeEnd} of ${pagination.totalElements} ${model.hasActiveFilters ? "matching " : ""}${pagination.totalElements === 1 ? "session" : "sessions"}`
        : `${pagination.totalElements} ${model.hasActiveFilters ? "matching " : ""}${pagination.totalElements === 1 ? "session" : "sessions"}`;

  return (
    <div className="space-y-6">
      <SessionsDirectoryFiltersToolbar
        filters={model.filters}
        hasActiveFilters={model.hasActiveFilters}
      />

      <Card
        as="section"
        aria-labelledby="sessions-directory-list-title"
        padding="none"
        className="overflow-hidden"
      >
        <div className="space-y-4 border-b border-[color:var(--vg-border)] p-5 sm:p-6">
          <CardHeader>
            <div className="min-w-0 flex-1">
              <CardTitle id="sessions-directory-list-title">
                Session records
              </CardTitle>
              <CardDescription>
                Ordered by most recent start time across the network. Station and session filters run on the server.
              </CardDescription>
            </div>
            <p className="font-sans text-[0.8125rem] font-medium text-[color:var(--vg-text-secondary)]">
              {serverScopeLabel}
            </p>
          </CardHeader>

          {isLive && model.rows.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-[color:var(--vg-text-primary)]">
                  Current page only
                </p>
                <p className="mt-0.5 font-sans text-[0.75rem] leading-[1.125rem] text-[color:var(--vg-text-secondary)]">
                  Filters only the {model.rows.length} {model.rows.length === 1 ? "session" : "sessions"} loaded on this page ({visibleRows.length} shown). Server totals and page counts do not change.
                </p>
              </div>

              <div
                role="group"
                aria-label="Current page lifecycle filter"
                className="flex flex-wrap items-center gap-2"
              >
                <Button
                  type="button"
                  size="md"
                  variant={lifecycleFilter === "ALL" ? "primary" : "secondary"}
                  aria-pressed={lifecycleFilter === "ALL"}
                  onClick={() => setLifecycleFilter("ALL")}
                >
                  All on page
                </Button>
                <Button
                  type="button"
                  size="md"
                  variant={lifecycleFilter === "ACTIVE" ? "primary" : "secondary"}
                  aria-pressed={lifecycleFilter === "ACTIVE"}
                  onClick={() => setLifecycleFilter("ACTIVE")}
                >
                  Active on page
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {!isLive ? (
          <div className="p-5 sm:p-6">{errorFallback}</div>
        ) : model.directoryState === "results" ? (
          visibleRows.length > 0 ? (
            <SessionsDirectoryRecords
              rows={visibleRows}
              caption="Charging sessions retrieved for the current server page and active directory filters"
            />
          ) : (
            <div className="p-5 sm:p-6">
              <EmptyState
                kind="no-matches"
                headingAs="h3"
                title="No active sessions on this page"
                description="All sessions loaded on this server page have ended. Switch back to view every loaded row or inspect another page."
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setLifecycleFilter("ALL")}
                  >
                    Show all on page
                  </Button>
                }
              />
            </div>
          )
        ) : model.directoryState === "no-matches" ? (
          <div className="p-5 sm:p-6">
            <EmptyState
              kind="no-matches"
              headingAs="h3"
              title="No charging sessions match the selected filters"
              description="Try clearing or adjusting the station identifier, session identifier, or completeness filter."
              action={
                <Link
                  href="/sessions"
                  className="inline-flex min-h-11 items-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
                >
                  Clear filters
                </Link>
              }
            />
          </div>
        ) : (
          <div className="p-5 sm:p-6">
            <EmptyState
              kind="empty"
              headingAs="h3"
              title="No charging sessions recorded"
              description="Station Service is reachable, but no charging sessions have been recorded in the network yet."
            />
          </div>
        )}

        <SessionsDirectoryPagination
          pagination={model.pagination}
          hasActiveFilters={model.hasActiveFilters}
        />
      </Card>
    </div>
  );
}
