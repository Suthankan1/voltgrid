import Link from "next/link";
import { localRegistrationEnabled } from "@/lib/station-registration";
import { RegistrationForm } from "./registration-form";
export const dynamic = "force-dynamic";
export default function NewStation() {
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-6 py-12">
    <Link href="/" className="underline">← Network</Link>
    <h1 className="mt-8 text-3xl font-semibold">Register a charging station</h1>
    <p className="mt-4">New stations start offline. Connectivity changes after the charger sends a BootNotification.</p>
    {localRegistrationEnabled() ? <RegistrationForm /> : <p role="status" className="mt-8">Registration is disabled. This console is in read-only mode.</p>}
  </main>;
}
