"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ErrorState } from "@/components/ui/error-state";

export interface OverviewErrorStateProps {
  message: string;
}

/**
 * Client-interactive unavailable state offering a safe manual refresh retry.
 */
export function OverviewErrorState({ message }: OverviewErrorStateProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ErrorState
      headingAs="h3"
      title="Unable to load network overview"
      message={message}
      guidance="Check that Station Service is running, then try again."
      retrying={pending}
      onRetry={() => startTransition(() => router.refresh())}
    />
  );
}
