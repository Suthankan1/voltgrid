import { redirect } from "next/navigation";
import {
  resolveLegacyTransactionsRedirectTarget,
  type RawSessionsSearchParams,
} from "@/lib/sessions-directory-model";

export const dynamic = "force-dynamic";

export default async function LegacyTransactionsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<RawSessionsSearchParams>;
}) {
  const params = await searchParams;
  redirect(resolveLegacyTransactionsRedirectTarget(params));
}
