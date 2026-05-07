import { z } from "zod"

export const customerSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Name is required (min 2 chars)." })
    .max(120),
  contact_name: z.string().max(120),
  email: z
    .string()
    .max(200)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Enter a valid email.",
    }),
  phone: z.string().max(40),
  address: z.string().max(400),
  billing_address: z.string().max(400),
  payment_terms_days: z
    .number({ message: "Must be a number." })
    .int()
    .min(0)
    .max(365),
  credit_limit_cad: z
    .number({ message: "Must be a number." })
    .min(0)
    .max(100_000_000)
    .nullable(),
  notes: z.string().max(2000),
  active: z.boolean(),
})

export type CustomerInput = z.infer<typeof customerSchema>

export const updateCustomerSchema = customerSchema.extend({
  id: z.uuid({ message: "Invalid customer id." }),
})

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
