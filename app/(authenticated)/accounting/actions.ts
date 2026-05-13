"use server"

// Co-located server actions for the /accounting page. We invoke the
// loads-side transitionLoadStatus indirectly via this wrapper so the
// client component can import from its own route group (sidesteps the
// brief SSR crash we hit when a client component pulled the action
// straight from app/(authenticated)/loads/actions.ts).

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { buildInvoiceReadyEmail } from "@/lib/emails/invoice-ready"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

import { headers } from "next/headers"

async function resolveSiteUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? ""
  return host ? `${proto}://${host}` : ""
}

type Result = { ok: true } | { error: string }

export async function markLoadInvoiced(loadId: string): Promise<Result> {
  const me = await requireRole(["admin", "accounting"])

  if (!loadId) return { error: "Missing load id." }

  const supabase = await createClient()

  // Flip status to invoiced. RLS already enforces who can do this.
  const { error: updateErr } = await supabase
    .from("loads")
    .update({ status: "invoiced" })
    .eq("id", loadId)
  if (updateErr) return { error: updateErr.message }

  // Timeline event.
  const { error: eventErr } = await supabase
    .from("load_status_events")
    .insert({
      load_id: loadId,
      status: "invoiced",
      created_by: me.id,
    })
  if (eventErr) return { error: eventErr.message }

  // Best-effort customer invoice email — same template the email-only
  // path uses. Swallowed failures so a Resend hiccup never rolls back
  // the status flip.
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
      .eq("id", loadId)
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
        const siteUrl = await resolveSiteUrl()
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
        await sendEmail({ to: c.email, subject, html, text })
      }
    }
  } catch {
    // Ignore email failure — status flip already committed.
  }

  revalidatePath("/accounting")
  revalidatePath("/loads")
  revalidatePath(`/loads/${loadId}`)
  revalidatePath("/dashboard")
  return { ok: true }
}
