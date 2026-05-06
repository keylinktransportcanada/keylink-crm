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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Keylink Transport CRM
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to access dispatch, drivers, and operations.
        </p>
      </div>

      {message ? (
        <Alert>
          <AlertTitle>{message.title}</AlertTitle>
          <AlertDescription>{message.body}</AlertDescription>
        </Alert>
      ) : null}

      <AuthForm />
    </div>
  )
}
