import Link from "next/link";
import { ADMIN_NAV_ITEMS } from "@/lib/routes";
import { getOrganizations, getAdministrativeAuditEvents } from "@/lib/admin-api";
import { getSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";

export const dynamic = "force-dynamic";

export default async function AdminHubPage() {
  const session = await getSession();
  const currentOrgId = session.user?.activeOrganizationId || "org_voltgrid_default";

  const organizations = await getOrganizations();
  const auditEvents = await getAdministrativeAuditEvents(currentOrgId, 0, 5);

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--vg-border)] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--vg-text-primary)] sm:text-2xl">
          Platform & Organization Administration
        </h1>
        <p className="mt-1 text-sm text-[color:var(--vg-text-secondary)]">
          Manage commercial multi-tenant organizations, physical charging sites, member role assignments, device credentials, and compliance audit trails.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Tenant Organizations"
          value={organizations.length}
          href="/admin/organizations"
        />
        <MetricCard
          label="Active Organization"
          value={currentOrgId}
          href="/admin/organizations"
        />
        <MetricCard
          label="Your Effective Role"
          value={session.user?.roles?.[0] || "OPERATOR"}
          href="/admin/members"
        />
        <MetricCard
          label="Audit Events (Org)"
          value={auditEvents.totalElements}
          href="/admin/audit"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {ADMIN_NAV_ITEMS.map(item => (
          <Link
            key={item.id}
            href={item.href}
            className="group block rounded-[var(--vg-radius-lg)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface)] p-6 transition-all duration-[var(--vg-transition-fast)] hover:border-[color:var(--vg-brand)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vg-focus)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[color:var(--vg-text-primary)] group-hover:text-[color:var(--vg-brand)]">
                {item.label}
              </h2>
              <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-[color:var(--vg-text-secondary)] transition-transform duration-[var(--vg-transition-fast)] group-hover:translate-x-1 group-hover:text-[color:var(--vg-brand)]"
              >
                <path d="M6 3.5 10.5 8 6 12.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-2 text-sm text-[color:var(--vg-text-secondary)]">
              {item.description}
            </p>
          </Link>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between border-b border-[color:var(--vg-border)] pb-3">
          <h2 className="text-base font-semibold text-[color:var(--vg-text-primary)]">
            Recent Administrative Activity
          </h2>
          <Link
            href="/admin/audit"
            className="text-xs font-semibold text-[color:var(--vg-brand)] hover:underline"
          >
            View full log →
          </Link>
        </div>

        {auditEvents.content.length === 0 ? (
          <p className="py-6 text-center text-sm text-[color:var(--vg-text-secondary)]">
            No administrative events recorded yet for this organization.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-[color:var(--vg-border)]">
            {auditEvents.content.map(event => (
              <div key={event.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[color:var(--vg-text-primary)]">
                      {event.eventType}
                    </span>
                    <span className="rounded bg-[color:var(--vg-surface-subtle)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-[color:var(--vg-brand)]">
                      {event.resourceType}:{event.resourceId}
                    </span>
                  </div>
                  <p className="text-xs text-[color:var(--vg-text-secondary)]">
                    Actor: <span className="font-mono">{event.actorId}</span> ({event.actorType})
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      event.outcome === "SUCCESS"
                        ? "bg-[color:var(--vg-success-soft)] text-[color:var(--vg-success)]"
                        : "bg-[color:var(--vg-danger-soft)] text-[color:var(--vg-danger)]"
                    }`}
                  >
                    {event.outcome}
                  </span>
                  <p className="mt-1 font-mono text-[0.6875rem] text-[color:var(--vg-text-secondary)]">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
