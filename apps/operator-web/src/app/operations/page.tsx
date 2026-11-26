import { redirect } from "next/navigation";
import {
  resolveLegacyOperationsRedirectTarget,
  type RawDiagnosticsSearchParams,
} from "@/lib/diagnostics-model";

export const dynamic = "force-dynamic";

export default async function LegacyOperationsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<RawDiagnosticsSearchParams>;
}) {
  const params = await searchParams;
  redirect(resolveLegacyOperationsRedirectTarget(params));
}
