"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"

import { sendPasswordReset, signInWithPassword } from "./actions"
import {
  loginSchema,
  passwordResetRequestSchema,
  type LoginInput,
  type PasswordResetRequestInput,
} from "@/lib/schemas/auth"

const DARK_INPUT =
  "bg-white/5 border-white/15 text-brand-cloud placeholder:text-brand-cloud/40 focus-visible:border-brand-teal focus-visible:ring-brand-teal/40 hover:border-white/25"

const DARK_LABEL = "text-brand-cloud/80"

const PRIMARY_CTA =
  "bg-brand-gold text-brand-navy hover:bg-brand-gold-light focus-visible:ring-brand-gold/40 font-semibold"

const GHOST_OUTLINE_DARK =
  "border-white/15 bg-transparent text-brand-cloud hover:bg-white/5 hover:text-brand-cloud"

type Mode = "password" | "reset-request"

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("password")
  const [resetSent, setResetSent] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {mode === "password" ? (
        <PasswordForm onForgot={() => setMode("reset-request")} />
      ) : resetSent ? (
        <ResetSent
          onBack={() => {
            setResetSent(false)
            setMode("password")
          }}
        />
      ) : (
        <ResetRequestForm
          onBack={() => setMode("password")}
          onSent={() => setResetSent(true)}
        />
      )}
    </div>
  )
}

function PasswordForm({ onForgot }: { onForgot: () => void }) {
  const [pending, startTransition] = useTransition()

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = (values: LoginInput) => {
    startTransition(async () => {
      const result = await signInWithPassword(values)
      if (result && "error" in result) {
        toast.error(result.error)
      }
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={DARK_LABEL}>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  className={DARK_INPUT}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-baseline justify-between">
                <FormLabel className={DARK_LABEL}>Password</FormLabel>
                <button
                  type="button"
                  onClick={onForgot}
                  className="text-xs text-brand-cloud/50 hover:text-brand-teal-light hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  className={DARK_INPUT}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={pending}
          size="lg"
          className={cn("w-full", PRIMARY_CTA)}
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Form>
  )
}

function ResetRequestForm({
  onBack,
  onSent,
}: {
  onBack: () => void
  onSent: () => void
}) {
  const [pending, startTransition] = useTransition()

  const form = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: "" },
  })

  const onSubmit = (values: PasswordResetRequestInput) => {
    startTransition(async () => {
      const result = await sendPasswordReset(values)
      if (result && "error" in result) {
        form.setError("email", { type: "manual", message: result.error })
        return
      }
      onSent()
    })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-brand-cloud/60">
          Enter the email associated with your account. If it exists, we&apos;ll
          send a password reset link.
        </p>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={DARK_LABEL}>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  className={DARK_INPUT}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onBack}
            className={cn("flex-1", GHOST_OUTLINE_DARK)}
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={pending}
            size="lg"
            className={cn("flex-1", PRIMARY_CTA)}
          >
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function ResetSent({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-md border border-brand-teal/30 bg-brand-teal/5 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-brand-cloud">Check your inbox</p>
        <p className="text-sm text-brand-cloud/65">
          If an account exists for that email, a password reset link has been
          sent. The link is valid for one hour.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        className={GHOST_OUTLINE_DARK}
      >
        Back to sign in
      </Button>
    </div>
  )
}
