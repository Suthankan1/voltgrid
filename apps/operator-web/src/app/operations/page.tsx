import Link from "next/link";
import { getOperationsSnapshot, type OperationalStatus } from "@/lib/operations-api";

export const dynamic = "force-dynamic";

export default async function Operations({ searchParams }: {
  searchParams: Promise<{ after?: string | string[]; status?: string | string[] }>;
}) {
  const params = await searchParams;
  const after = Array.isArray(params.after) ? params.after[0] : params.after;
  const requestedStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = ["ONLINE", "OFFLINE", "UNAVAILABLE"].includes(requestedStatus ?? "")
    ? requestedStatus as OperationalStatus : undefined;
  const snapshot = await getOperationsSnapshot(after, status);
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-6 py-12">
    <h1 className="text-3xl font-semibold">Operations status</h1>
    <p className="my-4">Event-driven station projection. Updates may arrive after Station Service changes.</p>
    <form action="/operations" className="my-6 flex flex-wrap items-end gap-4">
      <label className="grid gap-2" htmlFor="operational-status">Station status
        <select id="operational-status" name="status" defaultValue={status ?? ""} className="border p-3">
          <option value="">All statuses</option>
          {["ONLINE", "OFFLINE", "UNAVAILABLE"].map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <button className="border px-5 py-3">Apply status filter</button>
      <Link href="/operations" className="px-3 py-3 underline">Reset / first page</Link>
    </form>
    {snapshot.state === "unavailable" ? <p role="alert" className="my-8">{snapshot.message}</p> : <>
      <p className="my-6">{snapshot.stations.length} stations on this page</p>
      {snapshot.stations.length === 0 ? <p>No projected stations.</p> :
        <div role="region" aria-label="Station status table" tabIndex={0} className="overflow-x-auto"><table className="w-full text-left">
          <caption className="sr-only">Projected station statuses</caption>
          <thead><tr>{["Station", "Status", "Status changed", "Projection updated"].map(label =>
            <th key={label} scope="col" className="border-b p-3">{label}</th>)}</tr></thead>
          <tbody>{snapshot.stations.map(station => <tr key={station.stationId}>
            <td className="border-b p-3"><Link className="underline" href={`/stations/${encodeURIComponent(station.stationId)}`}>{station.stationId}</Link></td>
            <td className="border-b p-3">{station.currentStatus}</td>
            <td className="border-b p-3">{station.statusChangedAt}</td>
            <td className="border-b p-3">{station.updatedAt}</td>
          </tr>)}</tbody>
        </table></div>}
      {snapshot.hasNextPage && <Link className="mt-6 inline-block underline"
        href={`/operations?${new URLSearchParams({ after: snapshot.endCursor!, ...(status ? { status } : {}) })}`}>Next page →</Link>}
    </>}
  </main>;
}
