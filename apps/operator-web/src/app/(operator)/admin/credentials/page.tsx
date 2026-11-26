import {
  provisionStationCredentialAction,
  rotateStationCredentialAction,
  revokeStationCredentialAction,
} from "@/lib/admin-api";
import { getStationSnapshot } from "@/lib/station-api";
import { Card } from "@/components/ui/card";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function StationCredentialsPage() {
  const snapshot = await getStationSnapshot();
  const stations = snapshot.state === "live" ? snapshot.stations : [];

  async function handleProvision(formData: FormData) {
    "use server";
    const stationId = formData.get("stationId") as string;
    const password = formData.get("password") as string;

    if (stationId && password) {
      await provisionStationCredentialAction(stationId, password);
      revalidatePath("/admin/credentials");
    }
  }

  async function handleRotate(formData: FormData) {
    "use server";
    const stationId = formData.get("stationId") as string;
    const newPassword = formData.get("newPassword") as string;

    if (stationId && newPassword) {
      await rotateStationCredentialAction(stationId, newPassword);
      revalidatePath("/admin/credentials");
    }
  }

  async function handleRevoke(formData: FormData) {
    "use server";
    const stationId = formData.get("stationId") as string;
    if (stationId) {
      await revokeStationCredentialAction(stationId);
      revalidatePath("/admin/credentials");
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--vg-border)] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--vg-text-primary)] sm:text-2xl">
          Charging Station Device Identity & Credentials
        </h1>
        <p className="mt-1 text-sm text-[color:var(--vg-text-secondary)]">
          Manage PBKDF2-salted passwords and device authentication tokens for OCPP 2.0.1 WebSocket connections.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6">
            <div className="border-b border-[color:var(--vg-border)] pb-3 mb-4">
              <h2 className="text-base font-semibold text-[color:var(--vg-text-primary)]">
                Fleet Device Credentials
              </h2>
              <p className="text-xs text-[color:var(--vg-text-secondary)]">
                Passwords are salted with cryptographic random salts and hashed with PBKDF2WithHmacSHA256 (65,536 iterations). Raw passwords are never stored in plaintext.
              </p>
            </div>

            {stations.length === 0 ? (
              <p className="py-6 text-center text-sm text-[color:var(--vg-text-secondary)]">
                No stations available to manage credentials.
              </p>
            ) : (
              <div className="divide-y divide-[color:var(--vg-border)]">
                {stations.map(station => (
                  <div key={station.id} className="py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[color:var(--vg-text-primary)]">
                            {station.name}
                          </span>
                          <span className="rounded bg-[color:var(--vg-surface-subtle)] px-2 py-0.5 font-mono text-xs text-[color:var(--vg-brand)]">
                            {station.id}
                          </span>
                        </div>
                        <p className="text-xs text-[color:var(--vg-text-secondary)]">
                          Status: {station.status} · Algorithm: PBKDF2WithHmacSHA256
                        </p>
                      </div>

                      <form action={handleRevoke}>
                        <input type="hidden" name="stationId" value={station.id} />
                        <button
                          type="submit"
                          className="rounded-[var(--vg-radius-sm)] border border-[color:var(--vg-danger-soft)] px-2.5 py-1 text-xs font-medium text-[color:var(--vg-danger)] hover:bg-[color:var(--vg-danger-soft)]"
                        >
                          Revoke Credential
                        </button>
                      </form>
                    </div>

                    <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-3">
                      <form action={handleRotate} className="flex gap-2">
                        <input type="hidden" name="stationId" value={station.id} />
                        <input
                          type="password"
                          name="newPassword"
                          placeholder="Rotate to new password…"
                          required
                          className="flex-1 rounded-[var(--vg-radius-sm)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-2.5 py-1 text-xs text-[color:var(--vg-text-primary)]"
                        />
                        <button
                          type="submit"
                          className="rounded-[var(--vg-radius-sm)] bg-[color:var(--vg-brand)] px-3 py-1 text-xs font-semibold text-[color:var(--vg-text-inverse)] hover:bg-[color:var(--vg-brand-hover)]"
                        >
                          Rotate
                        </button>
                      </form>
                    </div>
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
                Provision New Credential
              </h2>
              <p className="text-xs text-[color:var(--vg-text-secondary)]">
                Assign initial OCPP basic authentication credential to a newly deployed station.
              </p>
            </div>

            <form action={handleProvision} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[color:var(--vg-text-secondary)] mb-1">
                  Target Station ID
                </label>
                <input
                  type="text"
                  name="stationId"
                  placeholder="STATION-001"
                  required
                  className="w-full rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-1.5 text-sm text-[color:var(--vg-text-primary)] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[color:var(--vg-text-secondary)] mb-1">
                  Initial Secret Password
                </label>
                <input
                  type="password"
                  name="password"
                  placeholder="Min 8 characters…"
                  required
                  className="w-full rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-1.5 text-sm text-[color:var(--vg-text-primary)]"
                />
              </div>

              <div className="rounded-[var(--vg-radius-sm)] bg-[color:var(--vg-surface-subtle)] p-2 text-[0.6875rem] text-[color:var(--vg-text-secondary)]">
                The password will be hashed with an independent 16-byte cryptographically secure salt before persisting.
              </div>

              <button
                type="submit"
                className="w-full rounded-[var(--vg-radius-md)] bg-[color:var(--vg-brand)] px-4 py-2 text-xs font-semibold text-[color:var(--vg-text-inverse)] hover:bg-[color:var(--vg-brand-hover)]"
              >
                Provision Credential
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
