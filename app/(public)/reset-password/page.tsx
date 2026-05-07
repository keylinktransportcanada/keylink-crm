import Image from "next/image"

import { ResetPasswordForm } from "./reset-form"

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
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
              Reset password
            </span>
          </div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-brand-cloud">
            Set a new password
          </h1>
          <p className="text-sm text-brand-cloud/60">
            Choose a strong password you haven&apos;t used before. You&apos;ll
            be signed in once it&apos;s saved.
          </p>
        </div>
      </div>

      <ResetPasswordForm />
    </div>
  )
}
