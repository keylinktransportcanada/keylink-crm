// Renders a draft invoice PDF for a load. Uses @react-pdf/renderer which
// requires the Node runtime (not Edge).
import { readFile } from "node:fs/promises"
import path from "node:path"

import { renderToBuffer } from "@react-pdf/renderer"
import { addDays, format, parseISO } from "date-fns"
import { NextResponse } from "next/server"

import { requireRole } from "@/lib/auth"
import { InvoicePdf } from "@/lib/invoice/invoice-template"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Anyone who can already see the load detail page can pull its invoice.
  await requireRole(["admin", "dispatcher", "accounting"])

  const { id } = await params
  const supabase = await createClient()

  const { data: load, error } = await supabase
    .from("loads")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error || !load) {
    return new NextResponse("Load not found", { status: 404 })
  }

  const { data: customer, error: customerErr } = await supabase
    .from("customers")
    .select(
      "name, contact_name, email, phone, address, billing_address, payment_terms_days, tax_id",
    )
    .eq("id", load.customer_id)
    .maybeSingle()

  if (customerErr || !customer) {
    return new NextResponse("Customer not found", { status: 404 })
  }

  const today = format(new Date(), "yyyy-MM-dd")
  const termsDays = customer.payment_terms_days ?? 30
  const dueDate = format(addDays(parseISO(today), termsDays), "yyyy-MM-dd")

  const logo = await readFile(
    path.join(process.cwd(), "public", "logo-keylink.png"),
  ).catch(() => null)

  const pdf = await renderToBuffer(
    InvoicePdf({
      load,
      customer,
      meta: {
        invoiceNumber: `INV-${load.load_number}`,
        invoiceDate: today,
        dueDate,
        logo,
      },
    }),
  )

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${`INV-${load.load_number}.pdf`}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
