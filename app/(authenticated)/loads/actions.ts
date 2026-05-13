"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireRole } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import {
  buildLoadAssignedEmail,
  type LoadAssignedEmailInput,
} from "@/lib/emails/load-assigned"
import {
  buildLoadStatusUpdateEmail,
  shouldNotifyCustomer,
} from "@/lib/emails/load-status-update"
import { buildInvoiceReadyEmail } from "@/lib/emails/invoice-ready"
import { renderInvoicePdfForLoad } from "@/lib/invoice/render"
import { getUsdToCadRate } from "@/lib/fx"
import {
  loadSchema,
  transitionStatusSchema,
  updateLoadSchema,
  type LoadInput,
  type TransitionStatusInput,
  type UpdateLoadInput,
} from "@/lib/schemas/loads"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { LoadStatus } from "@/lib/supabase/types"
import { computeTax, computeTaxAmount } from "@/lib/tax"

// Same env-then-header fallback used by other server actions so emailed
// links stay correct in any deploy context.
async function resolveSiteUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? ""
  return host ? `${proto}://${host}` : ""
}

// Best-effort assignment notification — never blocks the action result.
// Looks up the driver's email + customer name + assembles the email
// payload, then fires through Resend. Failures are swallowed; the
// assignment itself has already committed at this point.
async function notifyDriverAssigned(opts: {
  loadId: string
  driverId: string
}): Promise<void> {
  try {
    const admin = createAdminClient()

    const { data: load } = await admin
      .from("loads")
      .select(
        `id, load_number, customer_id,
         origin_company, origin_city, origin_province,
         destination_company, destination_city, destination_province,
         pickup_date, delivery_date,
         equipment_required, is_cross_border, reference_number`,
      )
      .eq("id", opts.loadId)
      .maybeSingle()
    if (!load) return

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", opts.driverId)
      .maybeSingle()

    const { data: userList } = await admin.auth.admin.listUsers()
    const authUser = userList?.users.find((u) => u.id === opts.driverId)
    const driverEmail = authUser?.email
    if (!driverEmail) return

    let customerName: string | null = null
    if (load.customer_id) {
      const { data: c } = await admin
        .from("customers")
        .select("name")
        .eq("id", load.customer_id)
        .maybeSingle()
      customerName = c?.name ?? null
    }

    const siteUrl = await resolveSiteUrl()
    const payload: LoadAssignedEmailInput = {
      driverFullName: profile?.full_name ?? null,
      loadNumber: load.load_number,
      customerName,
      origin: {
        city: load.origin_city,
        province: load.origin_province,
        company: load.origin_company,
      },
      destination: {
        city: load.destination_city,
        province: load.destination_province,
        company: load.destination_company,
      },
      pickupDate: load.pickup_date,
      deliveryDate: load.delivery_date,
      equipment:
        load.equipment_required && load.equipment_required !== "none"
          ? load.equipment_required.replace(/_/g, " ")
          : null,
      isCrossBorder: Boolean(load.is_cross_border),
      referenceNumber: load.reference_number,
      loadUrl: `${siteUrl}/loads/${load.id}`,
    }

    const { subject, html, text } = buildLoadAssignedEmail(payload)
    await sendEmail({ to: driverEmail, subject, html, text })
  } catch {
    // Swallow — never block assignment on email failure.
  }
}

// Best-effort customer status-update notification. Only fires for the
// status values listed in shouldNotifyCustomer() (loaded, in_transit,
// delivered, etc.) and only if the customer has an email on file.
async function notifyCustomerStatusChange(opts: {
  loadId: string
  status: LoadStatus
}): Promise<void> {
  try {
    if (!shouldNotifyCustomer(opts.status)) return

    const admin = createAdminClient()
    const { data: load } = await admin
      .from("loads")
      .select(
        `id, load_number, customer_id, tracking_slug,
         origin_city, origin_province,
         destination_city, destination_province,
         reference_number`,
      )
      .eq("id", opts.loadId)
      .maybeSingle()
    if (!load) return

    let email: string | null = null
    let customerName: string | null = null
    let contactName: string | null = null
    if (load.customer_id) {
      const { data: c } = await admin
        .from("customers")
        .select("name, email, contact_name")
        .eq("id", load.customer_id)
        .maybeSingle()
      email = c?.email ?? null
      customerName = c?.name ?? null
      contactName = c?.contact_name ?? null
    }
    if (!email) return

    const siteUrl = await resolveSiteUrl()
    const trackingUrl = `${siteUrl}/track/${load.tracking_slug}`

    const built = buildLoadStatusUpdateEmail({
      customerContactName: contactName,
      customerName,
      loadNumber: load.load_number,
      status: opts.status,
      origin: {
        city: load.origin_city,
        province: load.origin_province,
      },
      destination: {
        city: load.destination_city,
        province: load.destination_province,
      },
      trackingUrl,
      referenceNumber: load.reference_number,
    })
    if (!built) return

    await sendEmail({
      to: email,
      subject: built.subject,
      html: built.html,
      text: built.text,
    })
  } catch {
    // Swallow — never block the status transition on a failed email.
  }
}

// Invoice-ready email — sent the moment a load flips to `invoiced`.
// Summary email only (no PDF) for v1; customers reply for the official
// document if they need one. Best-effort, never blocks the transition.
async function notifyCustomerInvoiced(opts: {
  loadId: string
}): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: load } = await admin
      .from("loads")
      .select(
        `id, load_number, customer_id, tracking_slug,
         total_billed_cad, tax_amount_cad, tax_rate_pct, tax_jurisdiction,
         rate_cad, fuel_surcharge_cad, accessorial_charges_cad,
         reference_number, po_number`,
      )
      .eq("id", opts.loadId)
      .maybeSingle()
    if (!load) return

    let email: string | null = null
    let customerName: string | null = null
    let contactName: string | null = null
    let paymentTermsDays = 30
    if (load.customer_id) {
      const { data: c } = await admin
        .from("customers")
        .select("name, email, contact_name, payment_terms_days")
        .eq("id", load.customer_id)
        .maybeSingle()
      email = c?.email ?? null
      customerName = c?.name ?? null
      contactName = c?.contact_name ?? null
      paymentTermsDays = c?.payment_terms_days ?? 30
    }
    if (!email) return

    // Subtotal = rate + fuel + accessorials (before tax). total_billed_cad
    // is the pre-tax total in this schema; tax is tracked separately.
    const toNum = (v: number | string | null) =>
      v === null ? 0 : Number(v)
    const subtotal =
      toNum(load.rate_cad) +
      toNum(load.fuel_surcharge_cad) +
      toNum(load.accessorial_charges_cad)
    const tax = toNum(load.tax_amount_cad)
    const total = subtotal + tax

    const siteUrl = await resolveSiteUrl()
    const trackingUrl = `${siteUrl}/track/${load.tracking_slug}`

    const { subject, html, text } = buildInvoiceReadyEmail({
      customerContactName: contactName,
      customerName,
      loadNumber: load.load_number,
      referenceNumber: load.reference_number,
      poNumber: load.po_number,
      subtotalCad: subtotal,
      taxAmountCad: tax,
      taxRatePct:
        load.tax_rate_pct === null ? null : Number(load.tax_rate_pct),
      taxJurisdiction: load.tax_jurisdiction,
      totalCad: total,
      paymentTermsDays,
      trackingUrl,
      issueDateISO: new Date().toISOString(),
    })

    // Render the invoice PDF and attach it. Best-effort — if the render
    // throws we still send the summary email without the PDF rather than
    // dropping the notification entirely.
    let pdfAttachment: { filename: string; content: Buffer } | null = null
    try {
      const rendered = await renderInvoicePdfForLoad(opts.loadId)
      if (rendered) {
        pdfAttachment = {
          filename: rendered.filename,
          content: rendered.pdf,
        }
      }
    } catch {
      // Ignore — summary-only fallback.
    }

    await sendEmail({
      to: email,
      subject,
      html,
      text,
      attachments: pdfAttachment
        ? [{ ...pdfAttachment, contentType: "application/pdf" }]
        : undefined,
    })
  } catch {
    // Swallow — never block the transition on a failed email.
  }
}

type FieldErrors = Partial<Record<string, string[]>>
type CreateResult = { ok: true; id: string } | { error: FieldErrors }
type SimpleResult = { ok: true } | { error: string }

const MULTIPLIER = 1_000_000 // round CAD to 6 decimal places of the rate

function toCadAmount(
  entered: number | null,
  fxRate: number,
): number | null {
  if (entered === null) return null
  // Two decimals after multiplication; banker rounding isn't needed at this
  // scale of money, plain Math.round is fine.
  return Math.round(entered * fxRate * 100) / 100
}

async function buildRow(input: LoadInput, actorId: string) {
  const fxRate = input.currency === "USD" ? await getUsdToCadRate() : 1
  const rateCad = toCadAmount(input.rate, fxRate)
  const fuelCad = toCadAmount(input.fuel_surcharge, fxRate)
  const accCad = toCadAmount(input.accessorial_charges, fxRate)
  const totalCad =
    rateCad === null && fuelCad === null && accCad === null
      ? null
      : (rateCad ?? 0) + (fuelCad ?? 0) + (accCad ?? 0)

  // Tax: if the client passed an explicit override (edit form), use it
  // verbatim and label the jurisdiction as MANUAL. Otherwise auto-derive
  // from destination + customer's current tax_exempt flag.
  let taxRatePct: number
  let taxJurisdiction: string | null
  if (typeof input.tax_rate_pct === "number") {
    taxRatePct = input.tax_rate_pct
    taxJurisdiction =
      taxRatePct === 0 ? null : input.destination_province || "MANUAL"
  } else {
    const supabase = await createClient()
    const { data: customer } = await supabase
      .from("customers")
      .select("tax_exempt")
      .eq("id", input.customer_id)
      .maybeSingle()
    const tax = computeTax({
      destinationCountry: input.destination_country || "CA",
      destinationProvince: input.destination_province || null,
      customerExempt: customer?.tax_exempt ?? false,
    })
    taxRatePct = tax.rate_pct
    taxJurisdiction = tax.jurisdiction
  }
  const taxAmount =
    totalCad === null ? 0 : computeTaxAmount(totalCad, taxRatePct)

  return {
    customer_id: input.customer_id,
    driver_id: input.driver_id,
    truck_id: input.truck_id,
    trailer_id: input.trailer_id,

    reference_number: input.reference_number || null,
    po_number: input.po_number || null,

    origin_company: input.origin_company || null,
    origin_address: input.origin_address || null,
    origin_city: input.origin_city || null,
    origin_province: input.origin_province || null,
    origin_country: input.origin_country || "CA",

    destination_company: input.destination_company || null,
    destination_address: input.destination_address || null,
    destination_city: input.destination_city || null,
    destination_province: input.destination_province || null,
    destination_country: input.destination_country || "CA",

    pickup_date: input.pickup_date || null,
    delivery_date: input.delivery_date || null,

    load_type: input.load_type,
    commodity: input.commodity || null,
    weight_kg: input.weight_kg,
    pieces: input.pieces,
    equipment_required:
      input.equipment_required === "none" ? null : input.equipment_required,

    currency: input.currency,
    fx_rate_to_cad: Math.round(fxRate * MULTIPLIER) / MULTIPLIER,
    rate_cad: rateCad,
    fuel_surcharge_cad: fuelCad,
    accessorial_charges_cad: accCad,
    total_billed_cad: totalCad,

    is_cross_border: input.is_cross_border,
    customs_broker: input.customs_broker || null,
    pars_pass_number: input.pars_pass_number || null,
    aci_aces_number: input.aci_aces_number || null,

    tax_rate_pct: taxRatePct,
    tax_amount_cad: taxAmount,
    tax_jurisdiction: taxJurisdiction,

    notes: input.notes || null,
    internal_notes: input.internal_notes || null,

    created_by: actorId,
    // status auto-derives below for create; preserved on update.
  }
}

export async function createLoad(input: LoadInput): Promise<CreateResult> {
  const me = await requireRole(["admin", "dispatcher"])

  const parsed = loadSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const row = await buildRow(parsed.data, me.id)
  // A load with a driver attached at creation skips draft and goes straight
  // to assigned. Otherwise it sits in draft until dispatch assigns one.
  const initialStatus = parsed.data.driver_id ? "assigned" : "draft"

  const supabase = await createClient()
  const { data: inserted, error } = await supabase
    .from("loads")
    // load_number is filled by the BEFORE INSERT trigger when blank.
    .insert({ ...row, status: initialStatus, load_number: "" })
    .select("id")
    .single()

  if (error || !inserted) {
    return { error: { _form: [error?.message ?? "Insert failed."] } }
  }

  // Seed the timeline with the initial status.
  await supabase.from("load_status_events").insert({
    load_id: inserted.id,
    status: initialStatus,
    created_by: me.id,
  })

  // Notify the driver if the load was created already assigned to them.
  if (parsed.data.driver_id) {
    await notifyDriverAssigned({
      loadId: inserted.id,
      driverId: parsed.data.driver_id,
    })
  }

  revalidatePath("/loads")
  revalidatePath("/dashboard")
  return { ok: true, id: inserted.id }
}

export async function updateLoad(
  input: UpdateLoadInput,
): Promise<CreateResult> {
  // Accounting can edit (RLS-gated to safe fields); see edit/page.tsx
  // for the rationale.
  const me = await requireRole(["admin", "dispatcher", "accounting"])

  const parsed = updateLoadSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const row = await buildRow(parsed.data, me.id)
  // created_by is set on insert and shouldn't change on update.
  const { created_by: _ignored, ...updateRowBase } = row
  void _ignored

  const supabase = await createClient()

  // Look up the existing status + driver so we can (a) detect a manual
  // status override and emit a timeline event, and (b) fire an assignment
  // email only when driver_id actually changes (not on every edit).
  const { data: prior } = await supabase
    .from("loads")
    .select("status, driver_id")
    .eq("id", parsed.data.id)
    .maybeSingle()

  const overrideStatus =
    parsed.data.status && prior && parsed.data.status !== prior.status
      ? parsed.data.status
      : null

  const driverChanged =
    !!parsed.data.driver_id &&
    parsed.data.driver_id !== (prior?.driver_id ?? null)

  const updateRow = overrideStatus
    ? { ...updateRowBase, status: overrideStatus }
    : updateRowBase

  const { error } = await supabase
    .from("loads")
    .update(updateRow)
    .eq("id", parsed.data.id)

  if (error) {
    return { error: { _form: [error.message] } }
  }

  if (overrideStatus) {
    await supabase.from("load_status_events").insert({
      load_id: parsed.data.id,
      status: overrideStatus,
      location_note: "Status manually corrected via edit form",
      created_by: me.id,
    })
    // A manual status override that flips to a milestone status also
    // notifies the customer.
    await notifyCustomerStatusChange({
      loadId: parsed.data.id,
      status: overrideStatus,
    })
    if (overrideStatus === "invoiced") {
      await notifyCustomerInvoiced({ loadId: parsed.data.id })
    }
  }

  if (driverChanged && parsed.data.driver_id) {
    await notifyDriverAssigned({
      loadId: parsed.data.id,
      driverId: parsed.data.driver_id,
    })
  }

  revalidatePath("/loads")
  revalidatePath(`/loads/${parsed.data.id}`)
  revalidatePath("/dashboard")
  return { ok: true, id: parsed.data.id }
}

export async function transitionLoadStatus(
  input: TransitionStatusInput,
): Promise<SimpleResult> {
  const me = await requireRole(["admin", "dispatcher", "driver", "accounting"])

  const parsed = transitionStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid input." }
  }

  // Role gates: accounting can only set invoiced/paid; driver can only set
  // operational statuses on their own loads (RLS already enforces ownership).
  if (
    me.role === "accounting" &&
    parsed.data.status !== "invoiced" &&
    parsed.data.status !== "paid"
  ) {
    return { error: "Accounting can only mark loads invoiced or paid." }
  }

  const operationalForDriver = new Set([
    "at_pickup",
    "loaded",
    "in_transit",
    "at_delivery",
    "delivered",
  ])
  if (
    me.role === "driver" &&
    !operationalForDriver.has(parsed.data.status)
  ) {
    return { error: "Drivers can only update operational statuses." }
  }

  const supabase = await createClient()

  const { error: updateErr } = await supabase
    .from("loads")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
  if (updateErr) return { error: updateErr.message }

  const { error: eventErr } = await supabase.from("load_status_events").insert({
    load_id: parsed.data.id,
    status: parsed.data.status,
    location_note: parsed.data.location_note || null,
    created_by: me.id,
  })
  if (eventErr) return { error: eventErr.message }

  // Customer-facing status ping (loaded / in_transit / delivered / etc.).
  await notifyCustomerStatusChange({
    loadId: parsed.data.id,
    status: parsed.data.status,
  })

  // Invoice email when accounting flips a load to invoiced.
  if (parsed.data.status === "invoiced") {
    await notifyCustomerInvoiced({ loadId: parsed.data.id })
  }

  revalidatePath("/loads")
  revalidatePath(`/loads/${parsed.data.id}`)
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function deleteLoad(id: string): Promise<SimpleResult> {
  await requireRole(["admin", "dispatcher"])

  const supabase = await createClient()
  const { error } = await supabase.from("loads").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/loads")
  revalidatePath("/dashboard")
  redirect("/loads")
}
