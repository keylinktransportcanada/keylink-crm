import Link from "next/link"
import { format, parseISO } from "date-fns"
import {
  AlertTriangle,
  BadgeCheck,
  CircleDollarSign,
  FileText,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

import { InvoicePreviewDialog } from "./invoice-preview-dialog"

const formatCAD = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      }).format(value)

const formatCAD2 = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
      }).format(value)

const formatDate = (iso: string | null) => {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "PP")
  } catch {
    return iso
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_PER_DAY)
}

type AgingBucket = "0-30" | "31-60" | "61-90" | "90+"
function bucketFor(days: number): AgingBucket {
  if (days <= 30) return "0-30"
  if (days <= 60) return "31-60"
  if (days <= 90) return "61-90"
  return "90+"
}
const BUCKET_TONE: Record<AgingBucket, string> = {
  "0-30": "bg-emerald-50 text-emerald-800",
  "31-60": "bg-amber-50 text-amber-800",
  "61-90": "bg-orange-50 text-orange-800",
  "90+": "bg-red-100 text-red-900",
}

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  await requireRole(["admin", "accounting"])
  const supabase = await createClient()

  // Next 16 hands a Promise; guard against the edge case where it's
  // undefined or resolves to undefined so a destructure can't throw.
  const resolved = (await searchParams) ?? {}
  const sort = resolved.sort
  const invoiceQueueDir: "asc" | "desc" = sort === "asc" ? "asc" : "desc"

  // ---------------------------------------------------------------------
  // Pull all invoiced + paid loads in one shot, then resolve invoice/paid
  // dates from load_status_events so we don't rely on loads.updated_at
  // (which moves on every edit).
  // ---------------------------------------------------------------------
  const [
    { data: deliveredLoads },
    { data: invoicedLoads },
    { data: paidLoads },
  ] = await Promise.all([
    supabase
      .from("loads")
      .select(
        "id, load_number, customer_id, total_billed_cad, delivery_date, currency, fx_rate_to_cad, rate_cad",
      )
      .eq("status", "delivered")
      .order("delivery_date", { ascending: invoiceQueueDir === "asc" }),
    supabase
      .from("loads")
      .select(
        "id, load_number, customer_id, total_billed_cad, delivery_date, tax_rate_pct, tax_amount_cad, tax_jurisdiction",
      )
      .eq("status", "invoiced"),
    supabase
      .from("loads")
      .select(
        "id, load_number, customer_id, total_billed_cad, delivery_date, tax_rate_pct, tax_amount_cad, tax_jurisdiction",
      )
      .eq("status", "paid")
      .order("updated_at", { ascending: false })
      .limit(20),
  ])

  const allLoadIds = [
    ...(invoicedLoads ?? []).map((l) => l.id),
    ...(paidLoads ?? []).map((l) => l.id),
  ]

  // Fetch the relevant status events so we can pin the actual invoice and
  // payment dates per load.
  const { data: events } = allLoadIds.length
    ? await supabase
        .from("load_status_events")
        .select("load_id, status, created_at")
        .in("load_id", allLoadIds)
        .in("status", ["invoiced", "paid"])
        .order("created_at", { ascending: true })
    : { data: [] }

  // For each load, keep the first "invoiced" event (when it was invoiced) and
  // the first "paid" event (when it was paid).
  const invoicedAtByLoad = new Map<string, string>()
  const paidAtByLoad = new Map<string, string>()
  for (const e of events ?? []) {
    if (e.status === "invoiced" && !invoicedAtByLoad.has(e.load_id)) {
      invoicedAtByLoad.set(e.load_id, e.created_at)
    }
    if (e.status === "paid" && !paidAtByLoad.has(e.load_id)) {
      paidAtByLoad.set(e.load_id, e.created_at)
    }
  }

  // Resolve customer names for everything we display.
  const customerIds = [
    ...new Set([
      ...(deliveredLoads ?? []).map((l) => l.customer_id),
      ...(invoicedLoads ?? []).map((l) => l.customer_id),
      ...(paidLoads ?? []).map((l) => l.customer_id),
    ]),
  ]
  const { data: customers } = customerIds.length
    ? await supabase
        .from("customers")
        .select("id, name, payment_terms_days")
        .in("id", customerIds)
    : { data: [] }
  const customerById = new Map(
    (customers ?? []).map(
      (c) =>
        [c.id, { name: c.name, terms: c.payment_terms_days ?? 30 }] as const,
    ),
  )

  // ---------------------------------------------------------------------
  // A/R aging per customer. Bucket each invoiced load by days since the
  // invoiced event. Per-customer sub-totals + grand totals per bucket.
  // ---------------------------------------------------------------------
  type CustomerAging = {
    customerId: string
    name: string
    terms: number
    buckets: Record<AgingBucket, number>
    total: number
    oldestInvoicedAt: string | null
  }
  const agingByCustomer = new Map<string, CustomerAging>()
  const bucketTotals: Record<AgingBucket, number> = {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  }
  for (const l of invoicedLoads ?? []) {
    const invoicedAt = invoicedAtByLoad.get(l.id)
    const days = invoicedAt ? daysAgo(invoicedAt) : 0
    const bucket = bucketFor(days)
    const amount = Number(l.total_billed_cad ?? 0)
    const c = customerById.get(l.customer_id)
    const entry =
      agingByCustomer.get(l.customer_id) ?? {
        customerId: l.customer_id,
        name: c?.name ?? "—",
        terms: c?.terms ?? 30,
        buckets: { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
        total: 0,
        oldestInvoicedAt: null as string | null,
      }
    entry.buckets[bucket] += amount
    entry.total += amount
    if (invoicedAt) {
      if (
        !entry.oldestInvoicedAt ||
        invoicedAt < entry.oldestInvoicedAt
      ) {
        entry.oldestInvoicedAt = invoicedAt
      }
    }
    agingByCustomer.set(l.customer_id, entry)
    bucketTotals[bucket] += amount
  }
  const arRows = Array.from(agingByCustomer.values()).sort(
    (a, b) => b.buckets["90+"] - a.buckets["90+"] || b.total - a.total,
  )
  const arGrandTotal =
    bucketTotals["0-30"] +
    bucketTotals["31-60"] +
    bucketTotals["61-90"] +
    bucketTotals["90+"]

  const queueGrandTotal = (deliveredLoads ?? []).reduce(
    (s, l) => s + Number(l.total_billed_cad ?? 0),
    0,
  )

  // ---------------------------------------------------------------------
  // Tax collected this quarter — aggregated from invoiced + paid loads
  // whose invoiced event landed inside the current quarter window.
  // ---------------------------------------------------------------------
  const now = new Date()
  const currentQ = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4
  const qStartMonth = (currentQ - 1) * 3 + 1
  const qEndMonth = qStartMonth + 2
  const year = now.getUTCFullYear()
  const qStart = `${year}-${String(qStartMonth).padStart(2, "0")}-01`
  const qEndLastDay = new Date(Date.UTC(year, qEndMonth, 0)).getUTCDate()
  const qEnd = `${year}-${String(qEndMonth).padStart(2, "0")}-${String(qEndLastDay).padStart(2, "0")}`

  type TaxAgg = { count: number; collected: number; rate: number }
  const taxByJurisdiction = new Map<string, TaxAgg>()
  let totalTaxCollected = 0
  for (const l of [...(invoicedLoads ?? []), ...(paidLoads ?? [])]) {
    const invoicedAt = invoicedAtByLoad.get(l.id)
    if (!invoicedAt) continue
    const day = invoicedAt.slice(0, 10)
    if (day < qStart || day > qEnd) continue
    const amount = Number(l.tax_amount_cad ?? 0)
    if (amount <= 0) continue
    const code = l.tax_jurisdiction ?? "—"
    const entry =
      taxByJurisdiction.get(code) ?? {
        count: 0,
        collected: 0,
        rate: Number(l.tax_rate_pct ?? 0),
      }
    entry.count += 1
    entry.collected += amount
    taxByJurisdiction.set(code, entry)
    totalTaxCollected += amount
  }
  const taxRows = Array.from(taxByJurisdiction.entries())
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.collected - a.collected)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="size-1.5 rounded-full bg-brand-gold" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
            Books
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-4xl uppercase tracking-wide text-brand-navy lg:text-5xl">
            Accounting
          </h1>
          <p className="text-sm text-muted-foreground">
            Invoice queue, A/R aging, and recent payments. Click a load number
            to open the detail view.
          </p>
        </div>
      </header>

      {/* Summary strip ----------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile
          icon={FileText}
          label="Awaiting invoice"
          value={(deliveredLoads ?? []).length.toString()}
          subtle={formatCAD(queueGrandTotal)}
          accent="amber"
        />
        <SummaryTile
          icon={CircleDollarSign}
          label="A/R outstanding"
          value={formatCAD(arGrandTotal)}
          subtle={`${arRows.length} customer${arRows.length === 1 ? "" : "s"}`}
          accent="indigo"
        />
        <SummaryTile
          icon={AlertTriangle}
          label="90+ days overdue"
          value={formatCAD(bucketTotals["90+"])}
          subtle={
            bucketTotals["90+"] > 0
              ? "Needs collection follow-up"
              : "All clean"
          }
          accent={bucketTotals["90+"] > 0 ? "red" : "emerald"}
        />
        <SummaryTile
          icon={BadgeCheck}
          label="Paid (last 20)"
          value={formatCAD(
            (paidLoads ?? []).reduce(
              (s, l) => s + Number(l.total_billed_cad ?? 0),
              0,
            ),
          )}
          subtle={`${(paidLoads ?? []).length} loads`}
          accent="emerald"
        />
      </div>

      {/* Invoice queue ----------------------------------------------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-brand-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Invoice queue
            </h2>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {(deliveredLoads ?? []).length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Delivered loads ready to invoice.
            </p>
            {/* Sort toggle — uses URL search param so the order survives
                refresh and can be linked to. */}
            <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
              <Link
                href="/accounting?sort=desc"
                scroll={false}
                className={cn(
                  "px-2.5 py-1 transition-colors",
                  invoiceQueueDir === "desc"
                    ? "bg-brand-navy text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-pressed={invoiceQueueDir === "desc"}
              >
                Newest
              </Link>
              <Link
                href="/accounting?sort=asc"
                scroll={false}
                className={cn(
                  "px-2.5 py-1 transition-colors border-l border-border",
                  invoiceQueueDir === "asc"
                    ? "bg-brand-navy text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
                aria-pressed={invoiceQueueDir === "asc"}
              >
                Oldest
              </Link>
            </div>
          </div>
        </div>
        {(deliveredLoads ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Nothing waiting to invoice. Nice.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {(deliveredLoads ?? []).map((l) => {
              const c = customerById.get(l.customer_id)
              const amount = formatCAD2(
                l.total_billed_cad === null
                  ? null
                  : Number(l.total_billed_cad),
              )
              const deliveredLabel = `delivered ${formatDate(l.delivery_date)}`
              return (
                // The whole row is a button that opens the invoice
                // preview dialog. The PDF inside the dialog has its own
                // "Open / Download" link for users who want to save it.
                <li key={l.id}>
                  <InvoicePreviewDialog
                    loadId={l.id}
                    loadNumber={l.load_number}
                    customerName={c?.name ?? null}
                    amountLabel={amount}
                    deliveredAtLabel={deliveredLabel}
                  >
                    <div className="flex flex-wrap items-center gap-3 px-2 py-2.5">
                      <span className="font-mono text-sm font-medium">
                        {l.load_number}
                      </span>
                      <span className="text-sm">{c?.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {deliveredLabel}
                      </span>
                      <span className="ml-auto text-sm font-medium tabular-nums">
                        {amount}
                      </span>
                      <span
                        className={buttonVariants({
                          size: "sm",
                          variant: "outline",
                        })}
                      >
                        <FileText />
                        Preview invoice
                      </span>
                    </div>
                  </InvoicePreviewDialog>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* A/R aging ---------------------------------------------------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="size-4 text-brand-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              A/R aging
            </h2>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {arRows.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            By customer, days since invoiced.
          </p>
        </div>
        {arRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No outstanding invoices.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="border-b border-border px-2 py-2 text-left">
                    Customer
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    0–30
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    31–60
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    61–90
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    90+
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Total
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Oldest
                  </th>
                </tr>
              </thead>
              <tbody>
                {arRows.map((r) => (
                  <tr key={r.customerId} className="align-top">
                    <td className="border-b border-border/50 px-2 py-2.5">
                      <Link
                        href="/customers"
                        className="font-medium hover:underline"
                      >
                        {r.name}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">
                        Net {r.terms}
                      </div>
                    </td>
                    {(
                      ["0-30", "31-60", "61-90", "90+"] as AgingBucket[]
                    ).map((b) => (
                      <td
                        key={b}
                        className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums"
                      >
                        {r.buckets[b] > 0 ? (
                          <span
                            className={cn(
                              "inline-flex rounded-md px-1.5 py-0.5 text-xs font-semibold",
                              BUCKET_TONE[b],
                            )}
                          >
                            {formatCAD(r.buckets[b])}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    ))}
                    <td className="border-b border-border/50 px-2 py-2.5 text-right font-semibold tabular-nums">
                      {formatCAD(r.total)}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right text-xs text-muted-foreground tabular-nums">
                      {r.oldestInvoicedAt ? formatDate(r.oldestInvoicedAt) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-2 py-2.5">Totals</td>
                  {(["0-30", "31-60", "61-90", "90+"] as AgingBucket[]).map(
                    (b) => (
                      <td
                        key={b}
                        className="px-2 py-2.5 text-right tabular-nums"
                      >
                        {formatCAD(bucketTotals[b])}
                      </td>
                    ),
                  )}
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatCAD(arGrandTotal)}
                  </td>
                  <td className="px-2 py-2.5" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent payments --------------------------------------------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-4 text-emerald-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent payments
            </h2>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {(paidLoads ?? []).length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Last 20 paid loads, newest first.
          </p>
        </div>
        {(paidLoads ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No payments recorded yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {(paidLoads ?? []).map((l) => {
              const c = customerById.get(l.customer_id)
              const paidAt = paidAtByLoad.get(l.id)
              return (
                <li key={l.id}>
                  <Link
                    href={`/loads/${l.id}`}
                    className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-muted/30"
                  >
                    <span className="font-mono text-sm font-medium">
                      {l.load_number}
                    </span>
                    <span className="text-sm">{c?.name ?? "—"}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      paid {formatDate(paidAt ?? null)}
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {formatCAD2(
                        l.total_billed_cad === null
                          ? null
                          : Number(l.total_billed_cad),
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Tax collected this quarter ---------------------------------- */}
      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-brand-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Tax collected · Q{currentQ} {year}
            </h2>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {formatCAD(totalTaxCollected)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {qStart} → {qEnd}
          </p>
        </div>
        {taxRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No GST/HST collected on invoices issued this quarter yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="border-b border-border px-2 py-2 text-left">
                    Jurisdiction
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Rate
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Invoices
                  </th>
                  <th className="border-b border-border px-2 py-2 text-right">
                    Tax collected (CAD)
                  </th>
                </tr>
              </thead>
              <tbody>
                {taxRows.map((r) => (
                  <tr key={r.code}>
                    <td className="border-b border-border/50 px-2 py-2.5">
                      <span className="font-mono text-xs font-semibold">
                        {r.code}
                      </span>
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums">
                      {r.rate % 1 === 0
                        ? `${r.rate.toFixed(0)}%`
                        : `${r.rate.toFixed(2)}%`}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums">
                      {r.count}
                    </td>
                    <td className="border-b border-border/50 px-2 py-2.5 text-right tabular-nums font-semibold">
                      {formatCAD(r.collected)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-2 py-2.5">Total</td>
                  <td className="px-2 py-2.5" />
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {taxRows.reduce((s, r) => s + r.count, 0)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {formatCAD(totalTaxCollected)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Tax counted on the date the invoice was issued. Remittance schedule
          set by your CRA filing frequency (monthly, quarterly, or annual).
        </p>
      </section>

      {/* Driver settlements entry point ------------------------------ */}
      <Link
        href="/accounting/settlements"
        className="group flex items-start gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)] transition-all hover:-translate-y-0.5 hover:border-brand-gold/40 hover:shadow-[0_4px_8px_rgba(18,41,74,0.06),0_16px_32px_-12px_rgba(18,41,74,0.18)]"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold"
          aria-hidden="true"
        >
          <Wallet className="size-5" />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-sm font-semibold text-brand-navy">
            Driver settlements →
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Pay-period statements per driver. Snapshots the pay rate at the
            time of generation, supports bonuses and deductions, locks once
            the payment is recorded.
          </p>
        </div>
      </Link>

      {/* IFTA entry point -------------------------------------------- */}
      <Link
        href="/accounting/ifta"
        className="group flex items-start gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)] transition-all hover:-translate-y-0.5 hover:border-brand-gold/40 hover:shadow-[0_4px_8px_rgba(18,41,74,0.06),0_16px_32px_-12px_rgba(18,41,74,0.18)]"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold"
          aria-hidden="true"
        >
          <TrendingUp className="size-5" />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-sm font-semibold text-brand-navy">
            IFTA quarterly →
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Fuel by jurisdiction, kilometres by jurisdiction, and quarterly
            CSV export for filing (Apr 30 / Jul 31 / Oct 31 / Jan 31
            deadlines).
          </p>
        </div>
      </Link>
    </div>
  )
}

const TILE_ACCENT: Record<
  "amber" | "indigo" | "emerald" | "red",
  string
> = {
  amber: "text-amber-700 bg-amber-100",
  indigo: "text-indigo-700 bg-indigo-100",
  emerald: "text-emerald-700 bg-emerald-100",
  red: "text-red-700 bg-red-100",
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  subtle,
  accent,
}: {
  icon: typeof FileText
  label: string
  value: string
  subtle: string
  accent: keyof typeof TILE_ACCENT
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
          {label}
        </span>
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
            TILE_ACCENT[accent],
          )}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
      </div>
      <span className="font-display text-2xl tracking-wide tabular-nums text-brand-navy">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{subtle}</span>
    </div>
  )
}
