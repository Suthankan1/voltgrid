"use client";

import { useState } from "react";
import { Button, type ButtonSize } from "@/components/ui/button";

export interface CopyValueButtonProps {
  value: string;
  label: string;
  ariaLabel?: string;
  size?: ButtonSize;
}

/**
 * Accessible copy button with polite live-region feedback and graceful
 * fallback if the browser denies clipboard access.
 */
export function CopyValueButton({
  value,
  label,
  ariaLabel,
  size = "sm",
}: CopyValueButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setStatus("copied");
        return;
      }
      setStatus("failed");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant="secondary"
        size={size}
        aria-label={ariaLabel ?? label}
        onClick={handleCopy}
      >
        {label}
      </Button>
      <span
        role="status"
        aria-live="polite"
        className="font-sans text-[0.75rem] font-medium text-[color:var(--vg-text-secondary)]"
      >
        {status === "copied"
          ? "Copied"
          : status === "failed"
            ? "Copy unavailable"
            : ""}
      </span>
    </div>
  );
}
