"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

export function AttentionLoading() {
  return (
    <SkeletonGroup label="Loading needs attention" className="space-y-6">
      <div className="space-y-2 border-b border-[color:var(--vg-border)] pb-5">
        <Skeleton variant="heading" className="w-56 max-w-full" />
        <Skeleton variant="text" className="w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map(item => (
          <Card key={item} padding="md" className="space-y-2">
            <Skeleton variant="text" className="w-36 max-w-full" />
            <Skeleton variant="heading" className="w-20 max-w-full" />
            <Skeleton variant="text" className="w-48 max-w-full" />
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map(item => (
          <Card key={item} padding="md" className="space-y-3">
            <Skeleton variant="heading" className="w-48 max-w-full" />
            <Skeleton variant="block" className="h-20" />
            <Skeleton variant="block" className="h-20" />
          </Card>
        ))}
      </div>
    </SkeletonGroup>
  );
}

export interface AttentionRetryStateProps {
  title: string;
  message: string;
  guidance?: string;
  headingAs?: "h2" | "h3" | "h4";
}

/**
 * Interactive recovery panel for independent Station or Session failures
 * on Needs attention without discarding valid sibling categories.
 */
export function AttentionRetryState({
  title,
  message,
  guidance = "Check that Station Service is running, then try again.",
  headingAs = "h3",
}: AttentionRetryStateProps) {
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
