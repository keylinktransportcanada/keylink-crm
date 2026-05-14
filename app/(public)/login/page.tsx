import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { AuthForm } from "./auth-form"

const REASON_MESSAGES: Record<string, { title: string; body: string }> = {
  "signed-out": {
    title: "Signed out",
    body: "You've been signed out. Sign in again to continue.",
  },
  inactive: {
    title: "Account inactive",
    body: "Your account is currently deactivated. Contact your admin to restore access.",
  },
  expired: {
    title: "Link expired",
    body: "That link is no longer valid. Try requesting a new one.",
  },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const message = reason ? REASON_MESSAGES[reason] : undefined

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="size-1.5 rounded-full bg-brand-gold" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-gold">
                Keylink ERP · Sign in
              </span>
            </div>
            <span
              aria-hidden="true"
              className="hidden h-2.5 w-px bg-brand-cloud/20 sm:block"
            />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-cloud/50">
                Beta 2.4.1
              </span>
              <span className="relative inline-flex size-1.5 items-center justify-center">
                <span className="absolute inline-flex size-1.5 animate-ping rounded-full bg-brand-teal-light/70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-brand-teal-light" />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-teal-light">
                Live
              </span>
            </div>
          </div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-brand-cloud">
            Welcome back
          </h1>
          <p className="text-sm leading-relaxed text-brand-cloud/65">
            Sign in to dispatch, drive, or manage the books. Customers
            tracking a shipment can use the secure link from their booking
            confirmation. No account required.
          </p>
        </div>
      </div>

      {message ? (
        <Alert className="border-brand-gold/30 bg-brand-gold/5 text-brand-cloud">
          <AlertTitle className="text-brand-gold">{message.title}</AlertTitle>
          <AlertDescription className="text-brand-cloud/70">
            {message.body}
          </AlertDescription>
        </Alert>
      ) : null}

      <AuthForm />

      <div className="flex flex-col gap-1 text-center">
        <p className="text-xs text-brand-cloud/45">
          Staff account needed? Contact your admin.
        </p>
        <p className="text-xs text-brand-cloud/45">
          Tracking a shipment? Use the link sent with your booking.
        </p>
      </div>
    </div>
  )
}
