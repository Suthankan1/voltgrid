import { getOrganizationMembers, inviteMemberAction, updateMemberRoleAction, revokeMemberAction } from "@/lib/admin-api";
import { getSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { revalidatePath } from "next/cache";

const ROLES = [
  "ORG_OWNER",
  "STATION_OPERATOR",
  "BILLING_ANALYST",
  "READ_ONLY",
];

export const dynamic = "force-dynamic";

export default async function MembersAdminPage() {
  const session = await getSession();
  const activeOrgId = session.user?.activeOrganizationId || "org_voltgrid_default";
  const members = await getOrganizationMembers(activeOrgId);

  async function handleInviteMember(formData: FormData) {
    "use server";
    const userId = formData.get("userId") as string;
    const userEmail = formData.get("userEmail") as string;
    const role = formData.get("role") as string;

    if (userId && userEmail && role) {
      await inviteMemberAction(activeOrgId, userId, userEmail, role);
      revalidatePath("/admin/members");
    }
  }

  async function handleUpdateRole(formData: FormData) {
    "use server";
    const userId = formData.get("userId") as string;
    const role = formData.get("role") as string;
    if (userId && role) {
      await updateMemberRoleAction(activeOrgId, userId, role);
      revalidatePath("/admin/members");
    }
  }

  async function handleRevokeMember(formData: FormData) {
    "use server";
    const userId = formData.get("userId") as string;
    if (userId) {
      await revokeMemberAction(activeOrgId, userId);
      revalidatePath("/admin/members");
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--vg-border)] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--vg-text-primary)] sm:text-2xl">
          Team Members & Access Roles
        </h1>
        <p className="mt-1 text-sm text-[color:var(--vg-text-secondary)]">
          Manage member identities, roles, and administrative authorization for {activeOrgId}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6">
            <div className="border-b border-[color:var(--vg-border)] pb-3 mb-4">
              <h2 className="text-base font-semibold text-[color:var(--vg-text-primary)]">
                Organization Members ({members.length})
              </h2>
            </div>

            {members.length === 0 ? (
              <p className="py-6 text-center text-sm text-[color:var(--vg-text-secondary)]">
                No memberships registered in this organization.
              </p>
            ) : (
              <div className="divide-y divide-[color:var(--vg-border)]">
                {members.map(member => (
                  <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[color:var(--vg-text-primary)]">
                          {member.userEmail}
                        </span>
                        <span className="font-mono text-xs text-[color:var(--vg-text-secondary)]">
                          ({member.userId})
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded-full bg-[color:var(--vg-brand-soft)] px-2 py-0.5 font-mono text-[0.6875rem] font-bold text-[color:var(--vg-brand)]">
                          {member.role}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${
                            member.status === "ACTIVE"
                              ? "bg-[color:var(--vg-success-soft)] text-[color:var(--vg-success)]"
                              : "bg-[color:var(--vg-danger-soft)] text-[color:var(--vg-danger)]"
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>
                    </div>

                    {member.status === "ACTIVE" && (
                      <div className="flex items-center gap-2">
                        <form action={handleUpdateRole} className="flex items-center gap-1">
                          <input type="hidden" name="userId" value={member.userId} />
                          <select
                            name="role"
                            defaultValue={member.role}
                            className="rounded-[var(--vg-radius-sm)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-2 py-1 text-xs text-[color:var(--vg-text-primary)]"
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-[var(--vg-radius-sm)] border border-[color:var(--vg-border)] px-2 py-1 text-xs font-medium text-[color:var(--vg-text-primary)] hover:bg-[color:var(--vg-surface-subtle)]"
                          >
                            Update
                          </button>
                        </form>

                        <form action={handleRevokeMember}>
                          <input type="hidden" name="userId" value={member.userId} />
                          <button
                            type="submit"
                            className="rounded-[var(--vg-radius-sm)] bg-[color:var(--vg-danger-soft)] px-2 py-1 text-xs font-semibold text-[color:var(--vg-danger)] hover:bg-[color:var(--vg-danger)] hover:text-[color:var(--vg-text-inverse)]"
                          >
                            Revoke
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card className="p-6 space-y-4">
            <div className="border-b border-[color:var(--vg-border)] pb-3">
              <h2 className="text-base font-semibold text-[color:var(--vg-text-primary)]">
                Invite New Member
              </h2>
              <p className="text-xs text-[color:var(--vg-text-secondary)]">
                Grant organization-scoped role to an authenticated user.
              </p>
            </div>

            <form action={handleInviteMember} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[color:var(--vg-text-secondary)] mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  name="userId"
                  placeholder="usr_operator_10"
                  required
                  className="w-full rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-1.5 text-sm text-[color:var(--vg-text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[color:var(--vg-text-secondary)] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="userEmail"
                  placeholder="operator@voltgrid.lk"
                  required
                  className="w-full rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-1.5 text-sm text-[color:var(--vg-text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[color:var(--vg-text-secondary)] mb-1">
                  Assigned Role
                </label>
                <select
                  name="role"
                  defaultValue="STATION_OPERATOR"
                  className="w-full rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-1.5 text-sm text-[color:var(--vg-text-primary)]"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full mt-2 rounded-[var(--vg-radius-md)] bg-[color:var(--vg-brand)] px-4 py-2 text-xs font-semibold text-[color:var(--vg-text-inverse)] hover:bg-[color:var(--vg-brand-hover)]"
              >
                Send Membership Invite
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
