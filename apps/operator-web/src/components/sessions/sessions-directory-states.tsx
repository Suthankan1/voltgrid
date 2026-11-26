"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

export function SessionsDirectoryLoading() {
  return (
    <SkeletonGroup label="Loading charging sessions" className="space-y-6">
      <div className="space-y-2 border-b border-[color:var(--vg-border)] pb-5">
        <Skeleton variant="heading" className="w-56 max-w-full" />
        <Skeleton variant="text" className="w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(item => (
          <Card key={item} padding="md" className="space-y-2">
            <Skeleton variant="text" className="w-32 max-w-full" />
            <Skeleton variant="heading" className="w-20 max-w-full" />
            <Skeleton variant="text" className="w-44 max-w-full" />
          </Card>
        ))}
      </div>

      <Card padding="md" className="space-y-4">
        <Skeleton variant="heading" className="w-48 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton variant="block" className="h-11" />
          <Skeleton variant="block" className="h-11" />
          <Skeleton variant="block" className="h-11" />
          <Skeleton variant="block" className="h-11" />
        </div>
      </Card>

      <Card padding="md" className="space-y-4">
        <Skeleton variant="heading" className="w-44 max-w-full" />
        {[1, 2, 3, 4, 5].map(row => (
          <Skeleton key={row} variant="block" className="h-14" />
        ))}
      </Card>
    </SkeletonGroup>
  );
}

export interface SessionsDirectoryErrorStateProps {
  message: string;
}

/**
 * Client-interactive unavailable recovery state preserving active filter and
 * pagination URL parameters on manual retry.
 */
export function SessionsDirectoryErrorState({
  message,
}: SessionsDirectoryErrorStateProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ErrorState
      headingAs="h3"
      title="Unable to load charging sessions"
      message={message}
      guidance="Check that Station Service is running, then try again."
      retrying={pending}
      onRetry={() => startTransition(() => router.refresh())}
    />
  );
}
