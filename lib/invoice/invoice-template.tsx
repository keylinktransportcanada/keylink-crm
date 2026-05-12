// First-pass invoice template. Visual layout only — tax handling, bank
// instructions, and exact field set will change once accounting weighs in.
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import { KEYLINK_INFO } from "./keylink-info"

export type InvoiceLoad = {
  load_number: string
  status: string
  currency: string
  rate_cad: number | null
  fuel_surcharge_cad: number | null
  accessorial_charges_cad: number | null
  total_billed_cad: number | null
  fx_rate_to_cad: number | null
  pickup_date: string | null
  delivery_date: string | null
  origin_company: string | null
  origin_address: string | null
  origin_city: string | null
  origin_province: string | null
  origin_country: string | null
  destination_company: string | null
  destination_address: string | null
  destination_city: string | null
  destination_province: string | null
  destination_country: string | null
  commodity: string | null
  weight_kg: number | null
  pieces: number | null
  equipment_required: string | null
  reference_number: string | null
  po_number: string | null
  is_cross_border: boolean | null
  customs_broker: string | null
  pars_pass_number: string | null
  aci_aces_number: string | null
  tax_rate_pct?: number | null
  tax_amount_cad?: number | null
  tax_jurisdiction?: string | null
}

export type InvoiceCustomer = {
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  billing_address: string | null
  address: string | null
  payment_terms_days: number | null
  tax_id?: string | null
}

export type InvoiceMeta = {
  invoiceNumber: string
  invoiceDate: string  // YYYY-MM-DD
  dueDate: string      // YYYY-MM-DD
  logo?: Buffer | null
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  brand: {
    flexDirection: "column",
    maxWidth: 280,
  },
  brandLogo: {
    height: 36,
    width: 140,
    objectFit: "contain",
    marginBottom: 8,
  },
  brandWordmark: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    color: "#0f172a",
  },
  brandTagline: {
    marginTop: 2,
    fontSize: 8,
    color: "#64748b",
    letterSpacing: 1,
  },
  brandLines: {
    marginTop: 6,
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.4,
  },
  invoiceMeta: {
    alignItems: "flex-end",
  },
  invoiceLabel: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 4,
    color: "#0f172a",
  },
  metaRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  metaKey: {
    width: 80,
    fontSize: 9,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#0f172a",
  },

  // Address blocks
  blockGrid: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 18,
  },
  block: {
    flex: 1,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    borderLeft: "2pt solid #0f172a",
  },
  blockLabel: {
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  blockTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  blockLine: {
    fontSize: 9,
    color: "#334155",
    marginTop: 1,
    lineHeight: 1.3,
  },

  // Section heading
  sectionHeading: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 6,
  },

  // Cargo / lane
  lane: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  laneEnd: {
    flex: 1,
    padding: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
  },
  laneArrow: {
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#94a3b8",
    fontFamily: "Helvetica-Bold",
  },
  laneCity: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  laneSub: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 1,
  },

  cargoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  cargoCell: {
    width: "25%",
    paddingVertical: 4,
  },
  cargoKey: {
    fontSize: 7,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cargoVal: {
    fontSize: 9,
    color: "#0f172a",
    marginTop: 1,
  },

  // Line items table
  table: {
    marginTop: 4,
    borderTop: "1pt solid #e2e8f0",
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottom: "1pt solid #e2e8f0",
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottom: "1pt solid #f1f5f9",
  },
  tableCellDesc: {
    flex: 1,
    fontSize: 10,
  },
  tableCellAmount: {
    width: 110,
    fontSize: 10,
    textAlign: "right",
  },

  // Totals
  totals: {
    marginTop: 12,
    alignSelf: "flex-end",
    width: 240,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsKey: {
    fontSize: 9,
    color: "#64748b",
  },
  totalsVal: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  totalsGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 4,
    borderTop: "1pt solid #0f172a",
    borderBottom: "2pt solid #0f172a",
  },
  totalsGrandKey: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  totalsGrandVal: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    paddingTop: 10,
    borderTop: "1pt solid #e2e8f0",
  },
  footerText: {
    fontSize: 8,
    color: "#64748b",
    lineHeight: 1.5,
  },
  footerLabel: {
    fontFamily: "Helvetica-Bold",
    color: "#334155",
  },

  taxNote: {
    marginTop: 4,
    fontSize: 7,
    color: "#94a3b8",
    fontStyle: "italic",
  },
})

function formatMoney(value: number | null, currency: string): string {
  if (value === null || Number.isNaN(value)) return "—"
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  // YYYY-MM-DD → e.g. "May 28, 2026". Hand-rolled to avoid pulling date-fns
  // through @react-pdf — Helvetica fonts handle plain ASCII fine.
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10))
  if (!y || !m || !d) return iso
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  return `${months[m - 1]} ${d}, ${y}`
}

function joinAddress(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(", ")
}

export function InvoicePdf({
  load,
  customer,
  meta,
}: {
  load: InvoiceLoad
  customer: InvoiceCustomer
  meta: InvoiceMeta
}) {
  const fxRate = Number(load.fx_rate_to_cad ?? 1) || 1
  const linehaul =
    load.rate_cad === null ? null : Number(load.rate_cad) / fxRate
  const fuel =
    load.fuel_surcharge_cad === null
      ? null
      : Number(load.fuel_surcharge_cad) / fxRate
  const accessorials =
    load.accessorial_charges_cad === null
      ? null
      : Number(load.accessorial_charges_cad) / fxRate

  const subtotal =
    (linehaul ?? 0) + (fuel ?? 0) + (accessorials ?? 0)
  // Tax stored on the load (CAD always) — convert back to invoice currency
  // for display so a USD-priced load shows the tax in USD too.
  const taxRatePct = Number(load.tax_rate_pct ?? 0)
  const taxCad = Number(load.tax_amount_cad ?? 0)
  const tax = taxCad / fxRate
  const total = subtotal + tax
  const taxLabel =
    taxRatePct > 0
      ? `${load.tax_jurisdiction && ["ON", "NB", "NL", "NS", "PE"].includes(load.tax_jurisdiction) ? "HST" : "GST"} ${taxRatePct % 1 === 0 ? taxRatePct.toFixed(0) : taxRatePct.toFixed(2)}%${load.tax_jurisdiction ? ` (${load.tax_jurisdiction})` : ""}`
      : "Tax (zero-rated)"

  const billingAddress =
    customer.billing_address ?? customer.address ?? "Address on file"

  return (
    <Document
      title={`Invoice ${meta.invoiceNumber}`}
      author={KEYLINK_INFO.legalName}
      subject={`Invoice for load ${load.load_number}`}
    >
      <Page size="LETTER" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.brand}>
            {meta.logo ? (
              <Image src={meta.logo} style={styles.brandLogo} />
            ) : (
              <Text style={styles.brandWordmark}>KEYLINK TRANSPORT</Text>
            )}
            <View style={styles.brandLines}>
              <Text>{KEYLINK_INFO.legalName}</Text>
              {KEYLINK_INFO.addressLines.map((line, i) => (
                <Text key={i}>{line}</Text>
              ))}
              <Text>
                {KEYLINK_INFO.phone} &middot; {KEYLINK_INFO.email}
              </Text>
              <Text>
                {KEYLINK_INFO.usdotNumber} &middot; {KEYLINK_INFO.mcNumber}
              </Text>
              <Text>{KEYLINK_INFO.gstHstNumber}</Text>
            </View>
          </View>

          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Invoice #</Text>
              <Text style={styles.metaValue}>{meta.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Issued</Text>
              <Text style={styles.metaValue}>{formatDate(meta.invoiceDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Due</Text>
              <Text style={styles.metaValue}>{formatDate(meta.dueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Load #</Text>
              <Text style={styles.metaValue}>{load.load_number}</Text>
            </View>
          </View>
        </View>

        {/* BILL TO + REFERENCES */}
        <View style={styles.blockGrid}>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Bill to</Text>
            <Text style={styles.blockTitle}>{customer.name}</Text>
            {customer.contact_name ? (
              <Text style={styles.blockLine}>{customer.contact_name}</Text>
            ) : null}
            <Text style={styles.blockLine}>{billingAddress}</Text>
            {customer.email ? (
              <Text style={styles.blockLine}>{customer.email}</Text>
            ) : null}
            {customer.phone ? (
              <Text style={styles.blockLine}>{customer.phone}</Text>
            ) : null}
          </View>

          <View style={styles.block}>
            <Text style={styles.blockLabel}>References</Text>
            <Text style={styles.blockLine}>
              <Text style={styles.footerLabel}>PO #: </Text>
              {load.po_number ?? "—"}
            </Text>
            <Text style={styles.blockLine}>
              <Text style={styles.footerLabel}>Customer ref: </Text>
              {load.reference_number ?? "—"}
            </Text>
            {load.is_cross_border ? (
              <>
                <Text style={styles.blockLine}>
                  <Text style={styles.footerLabel}>PARS: </Text>
                  {load.pars_pass_number ?? "—"}
                </Text>
                <Text style={styles.blockLine}>
                  <Text style={styles.footerLabel}>ACI/ACE: </Text>
                  {load.aci_aces_number ?? "—"}
                </Text>
                <Text style={styles.blockLine}>
                  <Text style={styles.footerLabel}>Customs broker: </Text>
                  {load.customs_broker ?? "—"}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        {/* LANE */}
        <Text style={styles.sectionHeading}>Service summary</Text>
        <View style={styles.lane}>
          <View style={styles.laneEnd}>
            <Text style={styles.laneCity}>
              {load.origin_company ||
                joinAddress(load.origin_city, load.origin_province) ||
                "Origin"}
            </Text>
            <Text style={styles.laneSub}>
              {joinAddress(
                load.origin_address,
                load.origin_city,
                load.origin_province,
                load.origin_country,
              ) || "—"}
            </Text>
            <Text style={styles.laneSub}>
              Pickup: {formatDate(load.pickup_date)}
            </Text>
          </View>
          <Text style={styles.laneArrow}>→</Text>
          <View style={styles.laneEnd}>
            <Text style={styles.laneCity}>
              {load.destination_company ||
                joinAddress(load.destination_city, load.destination_province) ||
                "Destination"}
            </Text>
            <Text style={styles.laneSub}>
              {joinAddress(
                load.destination_address,
                load.destination_city,
                load.destination_province,
                load.destination_country,
              ) || "—"}
            </Text>
            <Text style={styles.laneSub}>
              Delivery: {formatDate(load.delivery_date)}
            </Text>
          </View>
        </View>

        <View style={styles.cargoRow}>
          <View style={styles.cargoCell}>
            <Text style={styles.cargoKey}>Commodity</Text>
            <Text style={styles.cargoVal}>{load.commodity ?? "—"}</Text>
          </View>
          <View style={styles.cargoCell}>
            <Text style={styles.cargoKey}>Weight</Text>
            <Text style={styles.cargoVal}>
              {load.weight_kg != null ? `${load.weight_kg} kg` : "—"}
            </Text>
          </View>
          <View style={styles.cargoCell}>
            <Text style={styles.cargoKey}>Pieces</Text>
            <Text style={styles.cargoVal}>{load.pieces ?? "—"}</Text>
          </View>
          <View style={styles.cargoCell}>
            <Text style={styles.cargoKey}>Equipment</Text>
            <Text style={styles.cargoVal}>
              {load.equipment_required ?? "—"}
            </Text>
          </View>
        </View>

        {/* LINE ITEMS */}
        <Text style={styles.sectionHeading}>Charges ({load.currency})</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Description</Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: 110, textAlign: "right" },
              ]}
            >
              Amount
            </Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.tableCellDesc}>
              Line haul — {load.load_number}
            </Text>
            <Text style={styles.tableCellAmount}>
              {formatMoney(linehaul, load.currency)}
            </Text>
          </View>

          {fuel != null && fuel > 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellDesc}>Fuel surcharge</Text>
              <Text style={styles.tableCellAmount}>
                {formatMoney(fuel, load.currency)}
              </Text>
            </View>
          ) : null}

          {accessorials != null && accessorials > 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.tableCellDesc}>Accessorial charges</Text>
              <Text style={styles.tableCellAmount}>
                {formatMoney(accessorials, load.currency)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* TOTALS */}
        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsKey}>Subtotal</Text>
            <Text style={styles.totalsVal}>
              {formatMoney(subtotal, load.currency)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsKey}>{taxLabel}</Text>
            <Text style={styles.totalsVal}>
              {formatMoney(tax, load.currency)}
            </Text>
          </View>
          <View style={styles.totalsGrand}>
            <Text style={styles.totalsGrandKey}>
              Total ({load.currency})
            </Text>
            <Text style={styles.totalsGrandVal}>
              {formatMoney(total, load.currency)}
            </Text>
          </View>
          {customer.tax_id ? (
            <Text style={styles.taxNote}>
              Customer GST/HST: {customer.tax_id}
            </Text>
          ) : null}
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            <Text style={styles.footerLabel}>Payment terms: </Text>
            {customer.payment_terms_days != null
              ? `Net ${customer.payment_terms_days}`
              : "Net 30"}{" "}
            &middot; Due {formatDate(meta.dueDate)}
          </Text>
          <Text style={styles.footerText}>
            {KEYLINK_INFO.paymentInstructions}
          </Text>
          <Text style={styles.footerText}>
            Questions? Contact {KEYLINK_INFO.email} or {KEYLINK_INFO.phone}.
            Thank you for your business.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
