export default function LoginPage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold">Sign in to VoltGrid</h1>
      <p className="mt-3">Use your organization’s identity provider to access the operator console.</p>
      <form action="/api/auth/login" method="get" className="mt-6">
        <button className="rounded-md border px-4 py-2 font-semibold" type="submit">
          Continue to sign in
        </button>
      </form>
    </main>
  );
}
