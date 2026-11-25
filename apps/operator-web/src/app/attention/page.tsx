import { AttentionView } from "@/components/attention/attention-view";
import {
  DEFAULT_ATTENTION_SESSION_PREVIEW_LIMIT,
  DEFAULT_ATTENTION_STATION_PREVIEW_LIMIT,
  buildAttentionModel,
} from "@/lib/attention-model";
import { getNetworkTransactionPage, getStationSnapshot } from "@/lib/station-api";

export const dynamic = "force-dynamic";

export default async function AttentionPage() {
  const [stationSnapshot, incompleteSessionsPage] = await Promise.all([
    getStationSnapshot(),
    getNetworkTransactionPage(0, DEFAULT_ATTENTION_SESSION_PREVIEW_LIMIT, {
      integrityStatus: "INCOMPLETE",
    }),
  ]);

  const model = buildAttentionModel(stationSnapshot, incompleteSessionsPage, {
    stationPreviewLimit: DEFAULT_ATTENTION_STATION_PREVIEW_LIMIT,
    sessionPreviewLimit: DEFAULT_ATTENTION_SESSION_PREVIEW_LIMIT,
  });

  return <AttentionView model={model} />;
}
