"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VoltmarkLockup } from "@/components/voltmark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

interface PersonaOption {
  key: string;
  name: string;
  role: string;
  description: string;
  organization: string;
}

const PERSONAS: PersonaOption[] = [
  {
    key: "platform_admin",
    name: "Kasun Silva",
    role: "PLATFORM_ADMIN",
    organization: "org_voltgrid_default",
    description: "Global administrative authority across all commercial tenant organizations and hardware.",
  },
  {
    key: "org_owner",
    name: "Dilshan Perera",
    role: "ORG_OWNER",
    organization: "org_voltgrid_default",
    description: "Full management of organization sites, station credentials, and operator team memberships.",
  },
  {
    key: "station_operator",
    name: "Nimal Fernando",
    role: "STATION_OPERATOR",
    organization: "org_voltgrid_default",
    description: "Daily charging operations, equipment monitoring, remote start/stop, and session diagnostics.",
  },
  {
    key: "billing_analyst",
    name: "Anoma Jayasinghe",
    role: "BILLING_ANALYST",
    organization: "org_voltgrid_default",
    description: "Access to metering records, energy consumption data, and settlement auditing.",
  },
  {
    key: "read_only",
    name: "Rohan De Silva",
    role: "READ_ONLY",
    organization: "org_voltgrid_default",
    description: "Read-only access for compliance oversight, safety auditing, and operational verification.",
  },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";

  const [selectedPersona, setSelectedPersona] = useState<string>("platform_admin");
  const [emailInput, setEmailInput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handlePersonaLogin(personaKey: string) {
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: personaKey, returnTo }),
      });

      if (!res.ok) {
        throw new Error("Authentication failed");
      }

      startTransition(() => {
        router.push(returnTo);
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput) return;
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput, returnTo }),
      });

      if (!res.ok) {
        throw new Error("Authentication failed");
      }

      startTransition(() => {
        router.push(returnTo);
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-var(--vg-topbar-height)-2rem)] flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center">
            <VoltmarkLockup size="lg" decorative />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--vg-text-primary)] sm:text-3xl">
            Commercial Operator Portal
          </h1>
          <p className="text-sm text-[color:var(--vg-text-secondary)]">
            Identity-verified access and multi-tenant authorization for Sri Lanka EV network operations.
          </p>
        </div>

        {error && (
          <Alert variant="error" title="Authentication Error">
            {error}
          </Alert>
        )}

        <Card className="space-y-6 p-6 sm:p-8">
          <div className="space-y-4">
            <div className="border-b border-[color:var(--vg-border)] pb-3">
              <h2 className="text-base font-semibold text-[color:var(--vg-text-primary)]">
                Select Identity Persona
              </h2>
              <p className="text-xs text-[color:var(--vg-text-secondary)]">
                Sign in with an authenticated commercial role for multi-tenant access verification.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-1">
              {PERSONAS.map(persona => {
                const isSelected = selectedPersona === persona.key;
                return (
                  <div
                    key={persona.key}
                    onClick={() => setSelectedPersona(persona.key)}
                    className={`cursor-pointer rounded-[var(--vg-radius-md)] border p-3.5 transition-all duration-[var(--vg-transition-fast)] ${
                      isSelected
                        ? "border-[color:var(--vg-brand)] bg-[color:var(--vg-brand-soft)] ring-1 ring-[color:var(--vg-brand)]"
                        : "border-[color:var(--vg-border)] bg-[color:var(--vg-surface)] hover:bg-[color:var(--vg-surface-subtle)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[color:var(--vg-text-primary)]">
                          {persona.name}
                        </span>
                        <span className="rounded-full bg-[color:var(--vg-surface-subtle)] px-2 py-0.5 font-mono text-[0.6875rem] font-semibold text-[color:var(--vg-brand)]">
                          {persona.role}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-[color:var(--vg-text-secondary)]">
                        {persona.organization}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--vg-text-secondary)]">
                      {persona.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                pending={isPending}
                pendingLabel="Authenticating…"
                onClick={() => handlePersonaLogin(selectedPersona)}
              >
                Sign in as {PERSONAS.find(p => p.key === selectedPersona)?.name}
              </Button>
            </div>
          </div>

          <div className="relative border-t border-[color:var(--vg-border)] pt-4 text-center">
            <span className="bg-[color:var(--vg-surface)] px-2 text-xs text-[color:var(--vg-text-secondary)]">
              Or sign in with custom operator email
            </span>
            <form onSubmit={handleEmailLogin} className="mt-4 flex gap-2">
              <input
                type="email"
                placeholder="operator@voltgrid.lk"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="flex-1 rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border-control)] bg-[color:var(--vg-surface)] px-3 py-2 text-sm text-[color:var(--vg-text-primary)] placeholder:text-[color:var(--vg-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--vg-focus)]"
              />
              <Button variant="secondary" size="md" type="submit" pending={isPending}>
                Sign in
              </Button>
            </form>
          </div>
        </Card>

        <div className="rounded-[var(--vg-radius-md)] border border-[color:var(--vg-border)] bg-[color:var(--vg-surface-subtle)] p-4 text-xs text-[color:var(--vg-text-secondary)] space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-[color:var(--vg-text-primary)]">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" className="text-[color:var(--vg-brand)]">
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm0 3.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM6.75 7.5h2.5v5h-2.5v-5Z" />
            </svg>
            Commercial Security Architecture (VG-202)
          </div>
          <p>
            Operator authentication enforces OpenID Connect (OIDC) identity standards, tenant-scoped resource authorization, salted PBKDF2 charging station credentials, and an immutable administrative audit log.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm text-[color:var(--vg-text-secondary)]">Loading operator portal…</div>}>
      <LoginContent />
    </Suspense>
  );
}
