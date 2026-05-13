"use client"

// Route-level error boundary for /accounting. Catches render-time errors
// so we see what went wrong instead of Netlify's generic "server error"
// page. Production stack traces are intentionally minimal — Next.js
// strips them; the digest is enough to grep server logs.

export default function AccountingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto mt-12 flex max-w-xl flex-col gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <h1 className="text-base font-semibold">
        Accounting page failed to load
      </h1>
      <p className="text-muted-foreground">
        Something went wrong rendering this page. The development team has
        been logged the error.
      </p>
      <pre className="overflow-auto rounded-md border border-border bg-card p-3 text-xs">
        {error.message}
        {error.digest ? `\nDigest: ${error.digest}` : ""}
      </pre>
      <div>
        <button
          onClick={() => reset()}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
