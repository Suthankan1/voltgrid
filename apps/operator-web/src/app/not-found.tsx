import Link from "next/link";
export default function NotFound() {
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-6 py-16">
    <p className="mb-3 font-mono text-sm">404 · Record not found</p>
    <h1 className="text-3xl font-semibold">This station or transaction could not be found.</h1>
    <p className="my-6">Check the identifier or return to the network to choose a current record.</p>
    <Link href="/" className="underline">Return to network</Link>
  </main>;
}
