const navigationItems = [
  {
    label: "Overview",
    href: "#",
    active: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />
      </svg>
    ),
  },
  {
    label: "Stations",
    href: "#",
    active: false,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 2h8a2 2 0 0 1 2 2v5.17a3 3 0 0 1 2 2.83v3.5a1.5 1.5 0 0 0 3 0V9h-2V7h1l-2-2 1.4-1.4 3 3A2 2 0 0 1 24 8v7.5a3.5 3.5 0 0 1-7 0V12a1 1 0 0 0-1-1v9h1v2H5v-2h1V4a2 2 0 0 1 2-2Zm1 2v6h7V4H8Zm0 8v8h7v-8H8Z" />
      </svg>
    ),
  },
  {
    label: "Operations",
    href: "#",
    active: false,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 5v4.59l3.2 3.2-1.4 1.42L11 12.41V7h2Z" />
      </svg>
    ),
  },
];

const metrics = [
  {
    label: "Total stations",
    value: "—",
    description: "Registered charging stations",
  },
  {
    label: "Online stations",
    value: "—",
    description: "Currently connected",
  },
  {
    label: "Active transactions",
    value: "—",
    description: "Charging sessions in progress",
  },
  {
    label: "Network status",
    value: "Ready",
    description: "Operator platform available",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="flex w-full flex-col bg-slate-950 text-slate-100 lg:fixed lg:inset-y-0 lg:w-64">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 font-bold text-slate-950">
            V
          </div>

          <div>
            <p className="text-lg font-semibold tracking-tight">VoltGrid</p>
            <p className="text-xs text-slate-400">Operator Console</p>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto p-4 lg:flex-1 lg:flex-col">
          {navigationItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`flex min-w-fit items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                item.active
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="h-5 w-5 fill-current">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden border-t border-white/10 p-5 lg:block">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Environment
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Development
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-64">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Charging network
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Overview
              </h1>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              AWS Dev
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <section>
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Network summary
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Current state of the VoltGrid charging network.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm font-medium text-slate-500">
                    {metric.label}
                  </p>

                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {metric.value}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {metric.description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="font-semibold text-slate-950">
                  Station activity
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Live station data will appear here once GraphQL is connected.
                </p>
              </div>

              <div className="flex min-h-72 items-center justify-center px-6 py-12">
                <div className="max-w-sm text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                    <svg
                      className="h-6 w-6 fill-slate-500"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M7 2h8a2 2 0 0 1 2 2v16h1v2H4v-2h2V4a2 2 0 0 1 2-2Zm1 2v6h7V4H8Zm0 8v8h7v-8H8Z" />
                    </svg>
                  </div>

                  <h3 className="mt-4 font-medium text-slate-900">
                    No station data loaded
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    The next frontend slice will connect this dashboard to the
                    Station Service GraphQL API.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-slate-950">
                Platform services
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Backend capabilities supporting the operator console.
              </p>

              <div className="mt-6 space-y-5">
                <ServiceStatus
                  name="Station Service"
                  description="OCPP, stations and transactions"
                />

                <ServiceStatus
                  name="Authorization Service"
                  description="Charging-token authorization"
                />

                <ServiceStatus
                  name="Operations Service"
                  description="Operational network projections"
                />
              </div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}

function ServiceStatus({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-900">{name}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>

      <span className="mt-1 flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Ready
      </span>
    </div>
  );
}