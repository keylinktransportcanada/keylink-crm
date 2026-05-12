// Sales-tax rules for Canadian freight invoices.
//
// CRA "place of supply" for freight services: tax is based on the destination
// of the shipment. A load delivered to Ontario gets 13% HST; a load delivered
// to Alberta gets 5% GST. A load delivered to the US is zero-rated.
//
// We don't model PST/QST separately — freight services are mostly exempt from
// PST in BC/SK/MB and from QST in Quebec for inter-provincial movement. If
// Keylink ever needs to charge PST on a local Quebec move, the dispatcher can
// override the auto-computed rate on the load.

export type TaxComputation = {
  rate_pct: number
  jurisdiction: string | null
  label: string // "HST 13% (ON)" / "GST 5% (AB)" / "Zero-rated (US)" / "Exempt"
}

// HST provinces and their rates (as of 2026).
const HST_RATE: Record<string, number> = {
  ON: 13,
  NB: 15,
  NL: 15,
  NS: 15,
  PE: 15,
}

// GST provinces — flat 5% federal rate, PST handled separately if applicable.
const GST_RATE = 5
const GST_PROVINCES = new Set([
  "AB",
  "BC",
  "MB",
  "SK",
  "QC", // QC's QST is separate; we charge GST only.
  "YT",
  "NT",
  "NU",
])

export function computeTax({
  destinationCountry,
  destinationProvince,
  customerExempt,
}: {
  destinationCountry: string | null
  destinationProvince: string | null
  customerExempt: boolean
}): TaxComputation {
  if (customerExempt) {
    return { rate_pct: 0, jurisdiction: null, label: "Exempt customer" }
  }
  const country = (destinationCountry ?? "CA").toUpperCase()
  if (country !== "CA") {
    // US, MX, anywhere outside Canada: zero-rated for IFTA carriers.
    return {
      rate_pct: 0,
      jurisdiction: country,
      label: `Zero-rated (${country})`,
    }
  }

  const prov = (destinationProvince ?? "").toUpperCase()
  if (prov in HST_RATE) {
    return {
      rate_pct: HST_RATE[prov],
      jurisdiction: prov,
      label: `HST ${HST_RATE[prov]}% (${prov})`,
    }
  }
  if (GST_PROVINCES.has(prov)) {
    return {
      rate_pct: GST_RATE,
      jurisdiction: prov,
      label: `GST ${GST_RATE}% (${prov})`,
    }
  }
  // Unknown / blank province: default to GST 5% so freight still gets taxed.
  // Bookkeeper can correct on edit if the province lookup fails.
  return {
    rate_pct: GST_RATE,
    jurisdiction: prov || null,
    label: `GST ${GST_RATE}%`,
  }
}

export function computeTaxAmount(
  subtotalCad: number,
  ratePct: number,
): number {
  // Two-decimal rounding to match how customers will see it on the invoice.
  return Math.round((subtotalCad * ratePct) / 100 * 100) / 100
}
