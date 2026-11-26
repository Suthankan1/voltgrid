import { getOrganizations, getSites, createSiteAction } from "@/lib/admin-api";
import { getSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function OrganizationsAdminPage() {
  const session = await getSession();
  const activeOrgId = session.user?.activeOrganizationId || "org_voltgrid_default";

  const organizations = await getOrganizations();
  const sites = await getSites(activeOrgId);

  async function handleCreateSite(formData: FormData) {
    "use server";
    const siteId = formData.get("siteId") as string;
    const name = formData.get("name") as string;
    const orgId = (formData.get("organizationId") as string) || activeOrgId;

    if (siteId && name) {
      await createSiteAction(siteId, orgId, name);
      revalidatePath("/admin/organizations");
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--vg-border)] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--vg-text-primary)] sm:text-2xl">
          Organizations & Charging Sites
        </h1>
        <p className="mt-1 text-sm text-[color:var(--vg-text-secondary)]">
          Manage commercial multi-tenant hierarchy and geographic physical sites across Sri Lanka.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 space-y-4">
          <div className="border-b border-[color:var(--vg-border)] pb-3">
            <h2 className="text-base font-semibold text-[color:var(--vg-text-primary)]">
              Tenant Organizations
            </h2>
            <p className="text-xs text-[color:var(--vg-text-secondary)]">
              Commercial boundary units holding independent fleets, billing, and member roles.
            </p>
          </div>

          <div className="divide-y divide-[color:var(--vg-border)]">
            {organizations.map(org => {
              const isActive = org.id === activeOrgId;
              return (
                <div key={org.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[color:var(--vg-text-primary)]">
                        {org.name}
                      </span>
                      {isActive && (
                        <span className="rounded-full bg-[color:var(--vg-brand-soft)] px-2 py-0.5 text-[0.6875rem] font-bold text-[color:var(--vg-brand)]">
                          Active Scope
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-[color:var(--vg-text-secondary)]">
                      {org.id}
                    </span>
                  </div>
                  <span className="rounded-full bg-[color:var(--vg-success-soft)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--vg-success)]">
                    {org.status}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="border-b border-[color:var(--vg-border)] pb-3">
            <h2 className="text-base font-semibold text-[color:var(--vg-text-primary)]">
              Charging Sites in Scope ({activeOrgId})
            </h2>
            <p className="text-xs text-[color:var(--vg-text-secondary)]">
              Physical locations hosting EV charging stations and grid interconnection equipment.
            </p>
          </div>

          {sites.length === 0 ? (
            <p className="py-4 text-center text-sm text-[color:var(--vg-text-secondary)]">
              No physical sites registered yet for this organization.
            </p>
          ) : (
            <div className="divide-y divide-[color:var(--vg-border)]">
              {sites.map(site => (
                <div key={site.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-sm text-[color:var(--vg-text-primary)]">
                      {site.name}
                    </p>
                    <span className="font-mono text-xs text-[color:var(--vg-text-secondary)]">
                      {site.id}
                    </span>
                  </div>
                  <span className="rounded-full bg-[color:var(--vg-success-soft)] px-2 py-0.5 text-xs font-medium text-[color:var(--vg-success)]">
                    {site.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-[color:var(--vg-border)] pt-4">
            <h3 className="text-sm font-semibold text-[color:var(--vg-text-primary)] mb-2">
              Register New Charging Site
            </h3>
            <form action={handleCreateSite} className="space-y-3">
              <input type="hidden" name="organizationId" value={activeOrgId} />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  name="siteId"
                  placeholder="Site ID (e.g. site_kandy_01)"
                  required
                  className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-1.5 text-sm text-[color:var(--vg-text-primary)]"
                />
                <input
                  type="text"
                  name="name"
                  placeholder="Site Name (e.g. Kandy Supercharger)"
                  required
                  className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-1.5 text-sm text-[color:var(--vg-text-primary)]"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-[var(--vg-radius-md)] bg-[color:var(--vg-brand)] px-4 py-2 text-xs font-semibold text-[color:var(--vg-text-inverse)] hover:bg-[color:var(--vg-brand-hover)]"
              >
                Register Site
              </button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
