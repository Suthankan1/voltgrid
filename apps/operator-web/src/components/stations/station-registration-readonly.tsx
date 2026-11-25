import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface StationRegistrationReadOnlyProps {
  backHref: string;
}

/**
 * Restricted read-only state rendered on `/stations/new` when local console writes
 * are disabled. Renders no executable registration form or submission controls.
 */
export function StationRegistrationReadOnly({
  backHref,
}: StationRegistrationReadOnlyProps) {
  return (
    <Card as="section" aria-labelledby="registration-readonly-title" padding="lg">
      <CardHeader>
        <div>
          <CardTitle id="registration-readonly-title">
            Read-only console
          </CardTitle>
          <CardDescription>
            Station registration is disabled outside local write mode.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <Alert variant="info" announce="none" title="Registration restricted">
          This console is running in read-only mode. Creating charging stations requires local operator write mode over a loopback Station Service endpoint.
        </Alert>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--vg-radius-md)] bg-[color:var(--vg-brand)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-text-inverse)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-brand-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            Return to charging stations
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-4 py-2.5 font-sans text-[0.875rem] font-semibold leading-[1.25rem] text-[color:var(--vg-text-primary)] transition-colors duration-[var(--vg-transition-fast)] hover:bg-[color:var(--vg-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            Network overview
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
