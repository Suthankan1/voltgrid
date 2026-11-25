"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

export function SessionDetailLoading() {
  return (
    <SkeletonGroup label="Loading charging session" className="space-y-6">
      <div className="space-y-3 border-b border-[color:var(--vg-border)] pb-5">
        <Skeleton variant="text" className="w-44 max-w-full" />
        <Skeleton variant="heading" className="w-64 max-w-full" />
        <Skeleton variant="text" className="w-80 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(item => (
          <Card key={item} padding="md" className="space-y-2">
            <Skeleton variant="text" className="w-28 max-w-full" />
            <Skeleton variant="heading" className="w-24 max-w-full" />
            <Skeleton variant="text" className="w-36 max-w-full" />
          </Card>
        ))}
      </div>

      <Card padding="md" className="space-y-4">
        <Skeleton variant="heading" className="w-48 max-w-full" />
        <Skeleton variant="block" className="h-44" />
      </Card>
    </SkeletonGroup>
  );
}

export interface SessionDetailRetryStateProps {
  title: string;
  message: string;
  guidance?: string;
  headingAs?: "h2" | "h3" | "h4";
}

/**
 * Interactive recovery panel for session lookup or partial section failures,
 * retaining active section selection and validated directory return context.
 */
export function SessionDetailRetryState({
  title,
  message,
  guidance = "Check that Station Service is running, then try again.",
  headingAs = "h2",
}: SessionDetailRetryStateProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ErrorState
      headingAs={headingAs}
      title={title}
      message={message}
      guidance={guidance}
      retrying={pending}
      onRetry={() => startTransition(() => router.refresh())}
    />
  );
}
