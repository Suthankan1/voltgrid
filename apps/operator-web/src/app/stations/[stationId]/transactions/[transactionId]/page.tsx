import { notFound, redirect } from "next/navigation";
import { decodePathIdentifier } from "@/lib/path-identifier";
import { buildLegacyTransactionToSessionRedirectHref } from "@/lib/session-detail-model";

export const dynamic = "force-dynamic";

export default async function LegacyTransactionRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{
    stationId: string;
    transactionId: string;
  }>;
  searchParams?: Promise<{
    section?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const { stationId, transactionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const decodedStationId = decodePathIdentifier(stationId);
  const decodedTransactionId = decodePathIdentifier(transactionId);

  if (decodedStationId === null || decodedTransactionId === null) {
    notFound();
  }

  redirect(
    buildLegacyTransactionToSessionRedirectHref(
      decodedStationId,
      decodedTransactionId,
      resolvedSearchParams ?? {},
    ),
  );
}
