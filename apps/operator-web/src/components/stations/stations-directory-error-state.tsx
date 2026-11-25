"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ErrorState } from "@/components/ui/error-state";

export interface StationsDirectoryErrorStateProps {
  message: string;
}

/**
 * Client-interactive unavailable state offering manual refresh retry while
 * keeping active search and connectivity parameters intact.
 */
export function StationsDirectoryErrorState({
  message,
}: StationsDirectoryErrorStateProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ErrorState
      headingAs="h3"
      title="Unable to load charging stations"
      message={message}
      guidance="Check that Station Service is running, then try again."
      retrying={pending}
      onRetry={() => startTransition(() => router.refresh())}
    />
  );
}
