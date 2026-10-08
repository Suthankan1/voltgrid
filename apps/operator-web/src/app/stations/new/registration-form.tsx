"use client";
import { useActionState } from "react";
import { registerStationAction } from "./actions";
export function RegistrationForm() {
  const [state, action, pending] = useActionState(registerStationAction, {});
  return <form action={action} className="mt-8 grid max-w-xl gap-6">
    <label className="grid gap-2">Station identifier
      <input name="id" required maxLength={255} defaultValue={state.id} autoComplete="off" className="border p-3" aria-describedby="identifier-help" />
    </label>
    <p id="identifier-help" className="text-sm">Use the same identifier when the charger connects through OCPP. Letters, numbers, dots, underscores, colons and hyphens are supported.</p>
    <label className="grid gap-2">Station name
      <input name="name" required maxLength={255} defaultValue={state.name} className="border p-3" />
    </label>
    {state.message && <p role="alert">{state.message}</p>}
    <button disabled={pending} aria-busy={pending} className="border bg-[#17191c] px-5 py-3 text-white disabled:opacity-60">{pending ? "Registering…" : "Register station"}</button>
  </form>;
}
