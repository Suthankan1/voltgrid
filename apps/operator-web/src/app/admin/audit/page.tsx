import { getAdministrativeAuditEvents } from "@/lib/admin-api";
import { getSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  const activeOrgId = session.user?.activeOrganizationId || "org_voltgrid_default";

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "0", 10);
  const auditData = await getAdministrativeAuditEvents(activeOrgId, page, 30);

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--vg-border)] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--vg-text-primary)] sm:text-2xl">
          Administrative Audit Trail
        </h1>
        <p className="mt-1 text-sm text-[color:var(--vg-text-secondary)]">
          Immutable, chronological record of tenant administration, membership adjustments, and device credential lifecycle events for {activeOrgId}.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between border-b border-[color:var(--vg-border)] pb-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--vg-text-primary)]">
              Audit Event Log
            </h2>
            <p className="text-xs text-[color:var(--vg-text-secondary)]">
              Total events recorded: {auditData.totalElements} · Page {auditData.number + 1} of {Math.max(1, auditData.totalPages)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {page > 0 && (
              <a
                href={`/admin/audit?page=${page - 1}`}
                className="rounded-[var(--vg-radius-sm)] border border-[color:var(--vg-border)] px-3 py-1 text-xs font-medium text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)]"
              >
                Previous
              </a>
            )}
            {auditData.number + 1 < auditData.totalPages && (
              <a
                href={`/admin/audit?page=${page + 1}`}
                className="rounded-[var(--vg-radius-sm)] border border-[color:var(--vg-border)] px-3 py-1 text-xs font-medium text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)]"
              >
                Next
              </a>
            )}
          </div>
        </div>

        {auditData.content.length === 0 ? (
          <p className="py-8 text-center text-sm text-[color:var(--vg-text-secondary)]">
            No administrative audit events found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] text-[color:var(--vg-text-secondary)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Timestamp</th>
                  <th className="px-3 py-2 font-semibold">Event Type</th>
                  <th className="px-3 py-2 font-semibold">Actor</th>
                  <th className="px-3 py-2 font-semibold">Resource</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                  <th className="px-3 py-2 font-semibold">Outcome</th>
                  <th className="px-3 py-2 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--vg-border)] font-mono">
                {auditData.content.map(event => (
                  <tr key={event.id} className="hover:bg-[color:var(--vg-surface-subtle)]">
                    <td className="px-3 py-2.5 text-[color:var(--vg-text-secondary)] whitespace-nowrap">
                      {new Date(event.createdAt).toISOString().replace("T", " ").substring(0, 19)}
                    </td>
                    <td className="px-3 py-2.5 font-sans font-semibold text-[color:var(--vg-text-primary)]">
                      {event.eventType}
                    </td>
                    <td className="px-3 py-2.5 text-[color:var(--vg-text-secondary)]">
                      {event.actorId} <span className="text-[0.6875rem]">({event.actorType})</span>
                    </td>
                    <td className="px-3 py-2.5 text-[color:var(--vg-brand)]">
                      {event.resourceType}:{event.resourceId}
                    </td>
                    <td className="px-3 py-2.5 text-[color:var(--vg-text-primary)]">
                      {event.action}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[0.6875rem] font-bold ${
                          event.outcome === "SUCCESS"
                            ? "bg-[color:var(--vg-success-soft)] text-[color:var(--vg-success)]"
                            : "bg-[color:var(--vg-danger-soft)] text-[color:var(--vg-danger)]"
                        }`}
                      >
                        {event.outcome}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[color:var(--vg-text-secondary)] max-w-xs truncate" title={event.metadata || ""}>
                      {event.metadata || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
