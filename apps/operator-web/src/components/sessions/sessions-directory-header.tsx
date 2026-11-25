import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";

export function SessionsDirectoryHeader() {
  return (
    <PageHeader
      title="Charging sessions"
      description="Monitor and inspect charging activity across your network."
      actions={
        <Link
          href="/stations"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-text-primary)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
        >
          Browse stations
        </Link>
      }
    />
  );
}
