import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { OrganizationSelector } from "@/components/shell/organization-selector";
import { getOrganizations } from "@/lib/admin-api";
import { getSession } from "@/lib/auth";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.user) redirect("/login");
  const organizations = (await getOrganizations()).filter((organization) => organization.status === "ACTIVE");
  return (
    <AppShell>
      <OrganizationSelector
        activeOrganizationId={session.user.activeOrganizationId}
        organizations={organizations}
      />
      {children}
    </AppShell>
  );
}
