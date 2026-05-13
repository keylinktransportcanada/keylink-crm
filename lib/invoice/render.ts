import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"

import { renderToBuffer } from "@react-pdf/renderer"
import { addDays, format, parseISO } from "date-fns"

import { createAdminClient } from "@/lib/supabase/admin"

import {
  InvoicePdf,
  type InvoiceCustomer,
  type InvoiceLoad,
} from "./invoice-template"

// Shared invoice-PDF renderer. Used by:
//   - GET /loads/[id]/invoice (the download route)
//   - notifyCustomerInvoiced (attaches the same PDF to the email)
//
// Pulls the load + customer with the admin client so the caller doesn't
// need to be authed; callers must enforce their own access control before
// invoking this.

export type RenderInvoiceResult = {
  pdf: Buffer
  filename: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
}

export async function renderInvoicePdfForLoad(
  loadId: string,
): Promise<RenderInvoiceResult | null> {
  const admin = createAdminClient()

  const { data: load } = await admin
    .from("loads")
    .select("*")
    .eq("id", loadId)
    .maybeSingle()
  if (!load) return null

  const { data: customer } = await admin
    .from("customers")
    .select(
      "name, contact_name, email, phone, address, billing_address, payment_terms_days, tax_id",
    )
    .eq("id", load.customer_id)
    .maybeSingle()
  if (!customer) return null

  const today = format(new Date(), "yyyy-MM-dd")
  const termsDays = customer.payment_terms_days ?? 30
  const dueDate = format(addDays(parseISO(today), termsDays), "yyyy-MM-dd")
  const invoiceNumber = `INV-${load.load_number}`

  const logo = await readFile(
    path.join(process.cwd(), "public", "logo-keylink.png"),
  ).catch(() => null)

  const pdf = await renderToBuffer(
    InvoicePdf({
      load: load as InvoiceLoad,
      customer: customer as InvoiceCustomer,
      meta: {
        invoiceNumber,
        invoiceDate: today,
        dueDate,
        logo,
      },
    }),
  )

  return {
    pdf,
    filename: `${invoiceNumber}.pdf`,
    invoiceNumber,
    invoiceDate: today,
    dueDate,
  }
}
