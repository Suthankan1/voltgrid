"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

export function DiagnosticsLoading() {
  return (
    <SkeletonGroup label="Loading operational diagnostics" className="space-y-6">
      <div className="space-y-2 border-b border-[color:var(--vg-border)] pb-5">
        <Skeleton variant="heading" className="w-48 max-w-full" />
        <Skeleton variant="text" className="w-80 max-w-full" />
      </div>

      <Card padding="md" className="space-y-4">
        <Skeleton variant="heading" className="w-44 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton variant="block" className="h-11" />
          <Skeleton variant="block" className="h-11" />
          <Skeleton variant="block" className="h-11" />
        </div>
      </Card>

      <Card padding="md" className="space-y-3">
        <Skeleton variant="heading" className="w-52 max-w-full" />
        {[1, 2, 3, 4].map(item => (
          <Skeleton key={item} variant="block" className="h-14" />
        ))}
      </Card>
    </SkeletonGroup>
  );
}

export interface DiagnosticsErrorStateProps {
  message: string;
  invalidCursor?: boolean;
  firstPageHref?: string | null;
}

/**
 * Interactive recovery panel for Operations Service diagnostics errors,
 * providing safe cursor reset recovery alongside manual retry.
 */
export function DiagnosticsErrorState({
  message,
  invalidCursor = false,
  firstPageHref = null,
}: DiagnosticsErrorStateProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ErrorState
      headingAs="h2"
      title={
        invalidCursor
          ? "Diagnostics cursor could not be loaded"
          : "Unable to load operational diagnostics"
      }
      message={message}
      guidance={
        invalidCursor
          ? "Return to the first diagnostics page to re-query Operations Service with a fresh cursor."
          : "Check that Operations Service is running, then try again."
      }
      retrying={pending}
      onRetry={() => startTransition(() => router.refresh())}
      action={
        firstPageHref ? (
          <Link
            href={firstPageHref}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            Return to first page
          </Link>
        ) : null
      }
    />
  );
}
