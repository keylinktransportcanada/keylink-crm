"use client"

import { useTransition } from "react"
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
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/schemas/auth"

import { setNewPassword } from "./actions"

const DARK_INPUT =
  "bg-white/5 border-white/15 text-brand-cloud placeholder:text-brand-cloud/40 focus-visible:border-brand-teal focus-visible:ring-brand-teal/40 hover:border-white/25"

const DARK_LABEL = "text-brand-cloud/80"

const PRIMARY_CTA =
  "bg-brand-gold text-brand-navy hover:bg-brand-gold-light focus-visible:ring-brand-gold/40 font-semibold"

export function ResetPasswordForm() {
  const [pending, startTransition] = useTransition()

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  const onSubmit = (values: ResetPasswordInput) => {
    startTransition(async () => {
      const result = await setNewPassword(values)
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={DARK_LABEL}>New password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
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
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={DARK_LABEL}>Confirm password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
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
          {pending ? "Saving…" : "Set new password"}
        </Button>
      </form>
    </Form>
  )
}
