// POST /api/loads/[id]/mark-invoiced
// Used by the accounting invoice-queue preview dialog so the client can
// flip a load's status without going through a server action — server
// actions imported into the accounting page client components caused a
// reproducible SSR crash on Netlify (digest 3506949301), so this route
// handler is the stable path.

import { NextResponse } from "next/server"

import { requireRole } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { buildInvoiceReadyEmail } from "@/lib/emails/invoice-ready"
import { renderInvoicePdfForLoad } from "@/lib/invoice/render"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function resolveSiteUrl(request: Request): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  // Fall back to the request's own origin so the tracking URL we put
  // into the email is always reachable.
  return new URL(request.url).origin
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireRole(["admin", "accounting"])
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Missing load id." }, { status: 400 })
  }

  const supabase = await createClient()

  const { error: updateErr } = await supabase
    .from("loads")
    .update({ status: "invoiced" })
    .eq("id", id)
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const { error: eventErr } = await supabase
    .from("load_status_events")
    .insert({
      load_id: id,
      status: "invoiced",
      created_by: me.id,
    })
  if (eventErr) {
    return NextResponse.json({ error: eventErr.message }, { status: 500 })
  }

  // Best-effort customer invoice email with the rendered PDF attached.
  // Failures here don't roll back the status flip — accounting can
  // resend manually if needed.
  let emailSent = false
  try {
    const admin = createAdminClient()
    const { data: load } = await admin
      .from("loads")
      .select(
        `id, load_number, customer_id, tracking_slug,
         tax_amount_cad, tax_rate_pct, tax_jurisdiction,
         rate_cad, fuel_surcharge_cad, accessorial_charges_cad,
         reference_number, po_number`,
      )
      .eq("id", id)
      .maybeSingle()

    if (load && load.customer_id) {
      const { data: c } = await admin
        .from("customers")
        .select("name, email, contact_name, payment_terms_days")
        .eq("id", load.customer_id)
        .maybeSingle()

      if (c?.email) {
        const toNum = (v: number | string | null) =>
          v === null ? 0 : Number(v)
        const subtotal =
          toNum(load.rate_cad) +
          toNum(load.fuel_surcharge_cad) +
          toNum(load.accessorial_charges_cad)
        const tax = toNum(load.tax_amount_cad)
        const siteUrl = await resolveSiteUrl(request)
        const { subject, html, text } = buildInvoiceReadyEmail({
          customerContactName: c.contact_name ?? null,
          customerName: c.name ?? null,
          loadNumber: load.load_number,
          referenceNumber: load.reference_number,
          poNumber: load.po_number,
          subtotalCad: subtotal,
          taxAmountCad: tax,
          taxRatePct:
            load.tax_rate_pct === null ? null : Number(load.tax_rate_pct),
          taxJurisdiction: load.tax_jurisdiction,
          totalCad: subtotal + tax,
          paymentTermsDays: c.payment_terms_days ?? 30,
          trackingUrl: `${siteUrl}/track/${load.tracking_slug}`,
          issueDateISO: new Date().toISOString(),
        })

        let pdfAttachment: { filename: string; content: Buffer } | null =
          null
        try {
          const rendered = await renderInvoicePdfForLoad(id)
          if (rendered) {
            pdfAttachment = {
              filename: rendered.filename,
              content: rendered.pdf,
            }
          }
        } catch {
          // PDF render failed — summary-only fallback.
        }

        const send = await sendEmail({
          to: c.email,
          subject,
          html,
          text,
          attachments: pdfAttachment
            ? [{ ...pdfAttachment, contentType: "application/pdf" }]
            : undefined,
        })
        emailSent = send.ok
      }
    }
  } catch {
    // Swallow — status flip is the source of truth.
  }

  return NextResponse.json({ ok: true, emailSent })
}
