import Image from "next/image"

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
    title: "Sign-in link expired",
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
        {/* Compact logo for mobile (brand panel is hidden < lg). */}
        <Image
          src="/logo-keylink.png"
          alt="Keylink Transport"
          width={150}
          height={40}
          priority
          className="h-8 w-auto lg:hidden"
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <span className="size-1.5 rounded-full bg-brand-gold" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
              Sign in
            </span>
          </div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-brand-cloud">
            Welcome back
          </h1>
          <p className="text-sm text-brand-cloud/60">
            Use your Keylink credentials to access dispatch, drivers, and
            operations.
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

      <p className="text-center text-xs text-brand-cloud/40">
        Need an account? Contact your admin.
      </p>
    </div>
  )
}
