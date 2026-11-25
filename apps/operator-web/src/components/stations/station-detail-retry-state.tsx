"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ErrorState } from "@/components/ui/error-state";

export interface StationDetailRetryStateProps {
  title: string;
  message: string;
  guidance?: string;
  headingAs?: "h2" | "h3" | "h4";
}

/**
 * Interactive section or page recovery surface using App Router refresh while
 * retaining active section and validated directory return context.
 */
export function StationDetailRetryState({
  title,
  message,
  guidance = "Check that Station Service is running, then try again.",
  headingAs = "h2",
}: StationDetailRetryStateProps) {
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
