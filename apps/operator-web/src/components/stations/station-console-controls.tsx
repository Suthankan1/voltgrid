import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { buildStationRegistrationHref } from "@/lib/routes";

export interface AddStationActionProps {
  returnPath?: string | null;
}

/**
 * Primary action link to station registration when local console writes are enabled.
 */
export function AddStationAction({ returnPath }: AddStationActionProps = {}) {
  return (
    <Link
      href={buildStationRegistrationHref(returnPath)}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--vg-radius-md)] bg-[color:var(--vg-brand)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-text-inverse)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-brand-hover)] active:bg-[color:var(--vg-brand-pressed)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        className="shrink-0"
      >
        <path
          d="M8 3v10M3 8h10"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      <span>Add station</span>
    </Link>
  );
}

/**
 * Concise informational notice rendered when registration is disabled outside local demo mode.
 */
export function ReadOnlyConsoleNotice() {
  return (
    <Alert
      variant="info"
      announce="none"
      className="mb-6"
      title="Read-only console"
    >
      Station registration is disabled outside local demo mode.
    </Alert>
  );
}
