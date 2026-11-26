import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { StationRegistrationReadOnly } from "@/components/stations/station-registration-readonly";
import { sanitizeStationsReturnPath } from "@/lib/routes";
import { localRegistrationEnabled } from "@/lib/station-registration";
import { RegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";

export interface NewStationPageProps {
  searchParams?: Promise<{
    returnTo?: string | string[];
  }>;
}

export default async function NewStationPage({
  searchParams,
}: NewStationPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const backHref =
    sanitizeStationsReturnPath(resolvedSearchParams.returnTo) ?? "/stations";
  const registrationEnabled = localRegistrationEnabled();

  return (
    <div className="mx-auto w-full max-w-[38rem] space-y-6">
      <div className="space-y-5">
        <div>
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--vg-radius-md)] px-2 py-1.5 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:bg-[color:var(--vg-brand-soft)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            ← Back to charging stations
          </Link>
        </div>

        <PageHeader
          title="Add charging station"
          description="Register a station in your charging network."
          className="mb-0"
        />
      </div>

      {registrationEnabled ? (
        <RegistrationForm backHref={backHref} />
      ) : (
        <StationRegistrationReadOnly backHref={backHref} />
      )}
    </div>
  );
}
