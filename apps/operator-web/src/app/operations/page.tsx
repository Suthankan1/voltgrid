import Link from "next/link";
import { getOperationsSnapshot } from "@/lib/operations-api";

export const dynamic = "force-dynamic";

export default async function Operations({ searchParams }: {
  searchParams: Promise<{ after?: string }>;
}) {
  const snapshot = await getOperationsSnapshot((await searchParams).after);
  return <main className="mx-auto max-w-6xl px-6 py-12">
    <nav className="mb-10 flex gap-6" aria-label="Operator navigation">
      <Link href="/">Stations</Link><Link href="/transactions">Transactions</Link>
    </nav>
    <h1 className="text-3xl font-semibold">Operations status</h1>
    <p className="my-4">Event-driven station projection. Updates may arrive after Station Service changes.</p>
    <Link href="/operations" className="underline">Refresh / first page</Link>
    {snapshot.state === "unavailable" ? <p role="alert" className="my-8">{snapshot.message}</p> : <>
      <p className="my-6">{snapshot.stations.length} stations on this page</p>
      {snapshot.stations.length === 0 ? <p>No projected stations.</p> :
        <div className="overflow-x-auto"><table className="w-full text-left">
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
        href={`/operations?${new URLSearchParams({ after: snapshot.endCursor! })}`}>Next page →</Link>}
    </>}
  </main>;
}
