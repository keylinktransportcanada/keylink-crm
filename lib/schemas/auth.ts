import { z } from "zod"

export const loginSchema = z.object({
  email: z.email({ message: "Enter a valid email." }),
  password: z.string().min(1, { message: "Enter your password." }),
})

export type LoginInput = z.infer<typeof loginSchema>

export const magicLinkSchema = z.object({
  email: z.email({ message: "Enter a valid email." }),
})

export type MagicLinkInput = z.infer<typeof magicLinkSchema>
