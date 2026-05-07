import { z } from "zod"

export const ROLE_VALUES = [
  "admin",
  "dispatcher",
  "driver",
  "accounting",
] as const

export const ROLE_LABEL: Record<(typeof ROLE_VALUES)[number], string> = {
  admin: "Admin",
  dispatcher: "Dispatcher",
  driver: "Driver",
  accounting: "Accounting",
}

export const createEmployeeSchema = z.object({
  full_name: z
    .string()
    .min(2, { message: "Full name is required (min 2 chars)." })
    .max(120),
  email: z.email({ message: "Enter a valid email." }),
  phone: z.string().max(40).optional().or(z.literal("")),
  role: z.enum(ROLE_VALUES, { message: "Pick a role." }),
  employee_id: z
    .string()
    .regex(/^KL-\d{4,}$/i, { message: "Format must be KL-NNNN." })
    .max(20),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>

export const updateEmployeeSchema = z.object({
  id: z.uuid({ message: "Invalid employee id." }),
  full_name: z
    .string()
    .min(2, { message: "Full name is required (min 2 chars)." })
    .max(120),
  phone: z.string().max(40).optional().or(z.literal("")),
  role: z.enum(ROLE_VALUES),
})

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>

export const setPasswordSchema = z
  .object({
    id: z.uuid({ message: "Invalid employee id." }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." })
      .max(128, { message: "Password is too long." }),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  })

export type SetPasswordInput = z.infer<typeof setPasswordSchema>
