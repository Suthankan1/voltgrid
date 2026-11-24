"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "./button";
import { Card } from "./card";

export interface ErrorStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Plain-language summary of what could not be loaded. */
  title?: string;
  /** Safe, user-facing explanation (never raw exception stacks or secrets). */
  message: string;
  /** Optional next-step guidance. */
  guidance?: string;
  /** Optional retry callback rendered as an accessible secondary button. */
  onRetry?: () => void;
  /** Label for the retry button. */
  retryLabel?: string;
  /** Disables duplicate retries while a retry is in flight. */
  retrying?: boolean;
  /** Optional custom recovery action node. */
  action?: ReactNode;
  /** Heading tag matching page hierarchy. */
  headingAs?: "h2" | "h3" | "h4";
}

/**
 * Unavailable/error recovery surface with optional retry control and safe operator messaging.
 */
export function ErrorState({
  title = "Unable to load data",
  message,
  guidance,
  onRetry,
  retryLabel = "Try again",
  retrying = false,
  action,
  headingAs = "h2",
  className,
  ...props
}: ErrorStateProps) {
  const Heading = headingAs;

  return (
    <Card
      as="section"
      role="alert"
      padding="md"
      className={
        className
          ? `border-[color:var(--vg-danger)]/35 bg-[color:var(--vg-danger-soft)] ${className}`
          : "border-[color:var(--vg-danger)]/35 bg-[color:var(--vg-danger-soft)]"
      }
      {...props}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[color:var(--vg-danger)]"
        >
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
            <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10 6.25v4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="10" cy="13.75" r="0.85" fill="currentColor" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <Heading className="font-sans text-[1rem] font-semibold leading-[1.5rem] text-[color:var(--vg-danger)]">
            {title}
          </Heading>
          <p className="mt-1 font-sans text-[0.875rem] leading-[1.375rem] text-[color:var(--vg-text-primary)]">
            {message}
          </p>
          {guidance ? (
            <p className="mt-1 font-sans text-[0.8125rem] leading-[1.25rem] text-[color:var(--vg-text-secondary)]">
              {guidance}
            </p>
          ) : null}
          {onRetry || action ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {onRetry ? (
                <Button
                  variant="secondary"
                  pending={retrying}
                  pendingLabel="Retrying…"
                  onClick={onRetry}
                >
                  {retryLabel}
                </Button>
              ) : null}
              {action}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
