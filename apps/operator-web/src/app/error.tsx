"use client";
import Link from "next/link";
export default function ErrorPage({retry}: {error: Error & {digest?:string}; retry: () => void}) {
  return <div className="mx-auto max-w-3xl py-8">
    <h1 className="text-3xl font-semibold">This view could not be loaded.</h1>
    <p role="alert" className="my-6">Try again, or return to the network. Service details are not shown here.</p>
    <button onClick={retry} className="mr-6 border px-5 py-3">Try again</button>
    <Link href="/" className="underline">Return to network</Link>
  </div>;
}
