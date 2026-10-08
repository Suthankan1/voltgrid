"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

export function OperatorNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const tabs = [{href:"/",label:"Network"},{href:"/transactions",label:"Transactions"},{href:"/operations",label:"Operations"}];
  return <header className="border-b border-[#17191c]/20 bg-[#f7f5ef]">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-7 lg:px-10">
      <Link href="/" className="flex items-center gap-3" aria-label="VoltGrid home">
        <span className="grid h-10 w-10 place-items-center bg-[#17191c] font-bold text-white">VG</span>
        <span><strong className="block">VoltGrid</strong><span className="text-xs">Operator console · local demo</span></span>
      </Link>
      <button type="button" disabled={pending} aria-busy={pending}
        onClick={() => startTransition(() => router.refresh())} className="border border-[#17191c]/25 px-4 py-2 disabled:opacity-60">
        {pending ? "Refreshing…" : "Refresh data"}
      </button>
    </div>
    <nav aria-label="Operator navigation" className="mx-auto flex max-w-[1600px] flex-wrap px-5 sm:px-7 lg:px-10">
      {tabs.map(tab => {
        const active = tab.href === "/" ? pathname === "/" || pathname.startsWith("/stations/") : pathname.startsWith(tab.href);
        return <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
          className={`border-b-4 px-5 py-3 text-sm ${active ? "border-[#2457ff] bg-white font-semibold" : "border-transparent hover:bg-white/60"}`}>{tab.label}</Link>;
      })}
    </nav>
  </header>;
}
