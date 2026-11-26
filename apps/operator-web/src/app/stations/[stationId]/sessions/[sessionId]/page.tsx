import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionDetailRetryState } from "@/components/sessions/session-detail-states";
import { SessionDetailView } from "@/components/sessions/session-detail-view";
import { PageHeader } from "@/components/shell/page-header";
import { decodePathIdentifier } from "@/lib/path-identifier";
import { buildStationHref } from "@/lib/routes";
import {
  buildSessionDetailModel,
  sanitizeSessionDetailReturnPath,
} from "@/lib/session-detail-model";
import { getSessionPageData } from "@/lib/station-api";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{
    stationId: string;
    sessionId: string;
  }>;
  searchParams?: Promise<{
    section?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const { stationId, sessionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const decodedStationId = decodePathIdentifier(stationId);
  const decodedSessionId = decodePathIdentifier(sessionId);

  if (decodedStationId === null || decodedSessionId === null) {
    notFound();
  }

  const pageData = await getSessionPageData(
    decodedStationId,
    decodedSessionId,
  );

  if (pageData.state === "not-found") {
    notFound();
  }

  if (pageData.state === "unavailable") {
    const safeReturn = sanitizeSessionDetailReturnPath(
      resolvedSearchParams?.returnTo,
      decodedStationId,
    );
    const backHref = safeReturn ?? buildStationHref(decodedStationId);
    const backLabel =
      safeReturn && safeReturn.startsWith("/sessions")
        ? "Back to Charging sessions"
        : `Back to ${decodedStationId}`;

    return (
      <div className="space-y-6">
        <div>
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--vg-radius-md)] px-2 py-1.5 font-sans text-[0.875rem] font-semibold text-[color:var(--vg-brand)] underline-offset-4 hover:bg-[color:var(--vg-brand-soft)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            ← {backLabel}
          </Link>
        </div>

        <PageHeader
          eyebrow="Charging session"
          title={`Session ${decodedSessionId}`}
          description={`Station ${decodedStationId}`}
        />

        <SessionDetailRetryState
          title="Unable to load charging session"
          message={pageData.message}
        />
      </div>
    );
  }

  const model = buildSessionDetailModel(pageData, {
    section: resolvedSearchParams?.section,
    returnTo: resolvedSearchParams?.returnTo,
  });

  return <SessionDetailView model={model} />;
}
