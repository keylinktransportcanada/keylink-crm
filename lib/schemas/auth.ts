import { z } from "zod"

export const loginSchema = z.object({
  email: z.email({ message: "Enter a valid email." }),
  password: z.string().min(1, { message: "Enter your password." }),
})

export type LoginInput = z.infer<typeof loginSchema>

export const passwordResetRequestSchema = z.object({
  email: z.email({ message: "Enter a valid email." }),
})

export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." })
      .max(72, { message: "Password is too long." }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  })

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
