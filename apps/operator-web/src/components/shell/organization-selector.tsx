"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OrganizationSelectorProps {
  activeOrganizationId: string;
  organizations: { id: string; name: string }[];
}

export function OrganizationSelector({ activeOrganizationId, organizations }: OrganizationSelectorProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (organizations.length < 2) return null;

  async function selectOrganization(organizationId: string) {
    setPending(true);
    setError("");
    try {
      const result = await fetch("/api/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!result.ok) throw new Error("Organization could not be selected");
      router.replace("/");
      router.refresh();
    } catch {
      setError("Organization could not be selected.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
      <label htmlFor="operator-organization">Organization</label>
      <select
        id="operator-organization"
        className="max-w-full rounded-md border px-2 py-1"
        value={activeOrganizationId}
        disabled={pending}
        onChange={(event) => void selectOrganization(event.target.value)}
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>{organization.name}</option>
        ))}
      </select>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
