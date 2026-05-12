-- Phase 10b — Sales tax (GST/HST) on freight invoices.
--
-- Customer-side:
--   tax_id      — the customer's GST/HST registration number (optional).
--   tax_exempt  — flag for the rare exempt customer (gov, diplomatic, etc.).
--
-- Load-side (denormalized snapshot at invoice time):
--   tax_rate_pct      — 0, 5, 13, or 15 — the rate that applied at the time
--                       the invoice was generated. Stored as the historical
--                       record; future rate changes don't rewrite past loads.
--   tax_amount_cad    — pre-computed tax (subtotal × rate / 100), rounded to
--                       2 decimals. Sourced from rate_cad + fuel_surcharge_cad
--                       + accessorial_charges_cad.
--   tax_jurisdiction  — the province/country code the rate was derived from
--                       (e.g. "ON" for HST 13%, "US" for zero-rated freight).
--
-- total_billed_cad keeps its existing semantics (pre-tax subtotal). The
-- grand-total a customer owes is computed at render time as
-- total_billed_cad + tax_amount_cad. Reports that talk about "revenue" stay
-- pre-tax (the carrier doesn't earn the GST/HST it collects).

alter table public.customers
  add column if not exists tax_id text,
  add column if not exists tax_exempt boolean not null default false;

alter table public.loads
  add column if not exists tax_rate_pct numeric(5, 2) not null default 0
    check (tax_rate_pct >= 0 and tax_rate_pct <= 25),
  add column if not exists tax_amount_cad numeric(12, 2) not null default 0
    check (tax_amount_cad >= 0),
  add column if not exists tax_jurisdiction text;

-- Index lets the accounting tax-summary aggregate cheaply by jurisdiction.
create index if not exists loads_tax_jurisdiction_idx
  on public.loads(tax_jurisdiction)
  where tax_jurisdiction is not null and tax_amount_cad > 0;
