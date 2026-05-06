# Keylink Transport CRM — Project Spec

This file is the source of truth for Claude Code working on this repo. Read it fully before generating code. Update it as decisions are made.

## About Keylink

Keylink Transport is a Canadian transportation and logistics company (keylinktransport.ca). The marketing site is custom HTML/JS/React on Netlify. This CRM is a separate internal app for dispatch, drivers, and accounting — not part of the public site.

## Deployment & architecture

The CRM lives on a subdomain of the existing site, **not** inside the marketing site's codebase.

- **Public site** — keylinktransport.ca, untouched. Existing Netlify project stays as-is. The only change to it is a "Staff Login" link in the header/footer pointing to the CRM subdomain.
- **CRM** — `app.keylinktransport.ca` (or `crm.keylinktransport.ca` — operator picks). New, separate Netlify site, separate GitHub repo, separate deploy pipeline. Set up via a CNAME record in the domain's DNS.
- **Why separate:** the public site is a stable marketing asset; the CRM changes constantly and has auth, state, and a database. Mixing them means every CRM deploy risks the marketing site, and the public site bundle would carry CRM code it doesn't need. Separation also keeps SEO concerns out of an authenticated app.
- **Single sign-in entry point:** drivers and employees bookmark `app.keylinktransport.ca/login` directly, or click "Staff Login" from the public site footer. There is no auth on the public site itself.
- **CORS / cookies:** Supabase auth cookies are scoped to the CRM subdomain only. The public site does not need any Supabase config.

## Goals

A simple, internal CRM that:
- Lets the admin onboard employee accounts (no public signup).
- Gives dispatch a board to create and assign loads.
- Lets drivers update load status and upload documents from a phone-friendly dashboard.
- Stores invoices, BOLs, PODs, rate confirmations, and customs docs against each load.
- Supports basic in-app messaging between dispatch and drivers.
- Surfaces simple reports (revenue, loads per driver, etc.).

Out of scope for v1: ELD integration, GPS-grade live tracking, public customer portal, accounting software sync, RSS feed (defer to v2 widget).

## Tech stack

- **Framework:** Next.js 16 (App Router) with TypeScript. Note: in Next.js 16 the root middleware file is named `proxy.ts` (was `middleware.ts` in Next.js 15); the helper module under `lib/supabase/middleware.ts` keeps its name.
- **Hosting:** Netlify, deployed as a separate site at `app.keylinktransport.ca`. Not part of the marketing site repo.
- **Auth + DB + Storage:** Supabase. Use Row Level Security from day one.
- **Styling:** Tailwind CSS + shadcn/ui components.
- **Forms:** react-hook-form + zod.
- **Tables:** TanStack Table.
- **Dates:** date-fns.
- **Icons:** lucide-react.
- **Notifications (later phases):** Resend for email, Twilio for SMS.

Do not introduce new top-level dependencies without flagging it.

## User roles

Stored as `role` enum on the `profiles` table:
- `admin` — full access; only role that can create accounts.
- `dispatcher` — create/edit loads, assign drivers, message anyone, view all docs.
- `driver` — sees only their assigned loads; can update status, upload BOL/POD; messages dispatch.
- `accounting` — read-only access to loads + documents; can upload/mark invoices.

## Data model (v1)

```
profiles (extends auth.users)
  id (uuid, PK, references auth.users)
  role (enum: admin | dispatcher | driver | accounting)
  full_name
  phone
  employee_id (string, unique, human-readable like KL-0042)
  hire_date
  active (bool)
  created_at, updated_at

driver_profiles (1:1 with profiles where role = driver)
  profile_id (PK, FK profiles)
  licence_number, licence_class, licence_province, licence_expiry
  medical_cert_expiry         -- DOT physical / Canadian medical
  fast_card_number, fast_card_expiry  -- 5-year expiry, cross-border
  abstract_last_pulled        -- CVOR driver abstract last review date
  emergency_contact_name, emergency_contact_phone
  hire_date
  notes

customers
  id, name, contact_name, email, phone, address, billing_address
  payment_terms_days (default 30)
  credit_limit_cad
  notes
  active (bool)

trucks
  id, truck_number (unique), make, model, year, plate, plate_province, plate_expiry
  vin
  status (enum: active|maintenance|out_of_service|retired)
  current_odometer_km
  insurance_policy, insurance_expiry
  ifta_decal_year, ifta_decal_expiry
  safety_sticker_expiry        -- annual safety / CVIP
  cvor_certificate_expiry      -- linked at company level but stored per truck for convenience
  notes

trailers
  id, trailer_number (unique), type (dry_van|reefer|flatbed|step_deck|tank|other)
  plate, plate_province, plate_expiry
  vin
  status, last_inspection_date, next_inspection_due
  notes

loads
  id, load_number (unique, auto-generated like L-2026-0001)
  customer_id (FK), driver_id (FK profiles, nullable), truck_id (FK trucks, nullable), trailer_id (FK trailers, nullable)
  origin_company, origin_address, origin_city, origin_province, origin_country
  destination_company, destination_address, destination_city, destination_province, destination_country
  pickup_date, pickup_window_start, pickup_window_end
  delivery_date, delivery_window_start, delivery_window_end
  status (enum: draft|assigned|dispatched|at_pickup|loaded|in_transit|at_delivery|delivered|invoiced|paid|cancelled)
  load_type (ftl|ltl|partial)
  commodity, weight_kg, pieces, equipment_required (refrigeration|hazmat|tarps|oversize|none)
  rate_cad (numeric), currency (default CAD)
  fuel_surcharge_cad, accessorial_charges_cad, total_billed_cad
  is_cross_border (bool)
  customs_broker, pars_pass_number, aci_aces_number   -- cross-border tracking numbers
  reference_number, po_number                          -- customer references
  notes, internal_notes
  created_by, created_at, updated_at

load_status_events
  id, load_id (FK), status, location_note (free text — "crossed Peace Bridge"), latitude (nullable), longitude (nullable), created_by, created_at

documents
  id, load_id (FK, nullable — some docs are not load-scoped)
  truck_id (FK, nullable), driver_id (FK, nullable)
  type (enum: bol|pod|invoice|rate_con|customs|cci|inspection|maintenance|driver_licence|medical|fast_card|insurance|registration|other)
  file_path (Supabase Storage path), file_name, mime_type, size_bytes
  expiry_date (nullable — used for licence/medical/insurance/permits)
  uploaded_by, uploaded_at

inspections (DVIR — pre/post-trip, legally required)
  id, truck_id (FK), trailer_id (FK, nullable), driver_id (FK profiles)
  inspection_type (pre_trip|post_trip|en_route)
  inspection_date
  defects_found (bool), defects_description, severity (none|minor|major)
  signed_by_driver (bool), corrected_at, corrected_by
  notes

maintenance_records
  id, truck_id (FK)
  service_type (oil_change|tire|brake|annual_inspection|repair|other)
  service_date, odometer_km, cost_cad
  vendor, description
  next_due_date, next_due_odometer_km
  document_id (FK to documents, nullable)
  created_by, created_at

fuel_records (basis for IFTA reporting)
  id, truck_id (FK), driver_id (FK profiles)
  purchase_date, jurisdiction (province/state), litres, total_cad
  odometer_km, vendor, receipt_document_id
  created_at

trip_distances (for IFTA — kilometres per jurisdiction per trip)
  id, load_id (FK), truck_id (FK)
  jurisdiction, distance_km
  entered_at, entered_by

messages
  id, thread_id, sender_id, recipient_id (nullable for group), body, created_at, read_at

threads
  id, subject, load_id (FK, nullable), created_by, created_at

alerts (auto-generated, surfaced on dashboards)
  id, type (expiring_document|maintenance_due|unassigned_load|delivery_late|driver_hos_low|invoice_overdue|inspection_failed)
  severity (info|warning|critical)
  entity_type (driver|truck|trailer|load|customer), entity_id
  message, due_date (nullable)
  resolved (bool), resolved_at, resolved_by
  created_at

audit_log
  id, actor_id (FK profiles), action, entity_type, entity_id, before_json, after_json, created_at
```

Naming: snake_case in DB, camelCase in TS. Generate types with `supabase gen types typescript`.

## Dashboard landing pages by role

The `/dashboard` route is role-aware and is the most-viewed screen in the app. Each role gets a different layout. Real data only — no placeholder counts after Phase 1.

### Admin landing (also serves as company overview)

Top row: KPI cards.
- Active employees by role (admin / dispatcher / driver / accounting).
- Active trucks vs total fleet.
- Loads in progress today.
- Revenue billed this month (CAD).

Middle: **Compliance & expiry alerts** — single most valuable widget for an Ontario carrier. Shows everything that expires in the next 30/60/90 days, sorted by urgency:
- Driver licences, medical certs, FAST cards.
- Truck insurance, plates, IFTA decals, annual safety stickers, CVOR certificate.
- Trailer plates and inspections.
Each alert has the entity, expiry date, days remaining, and a link to fix.

Bottom: recent activity feed (loads created, employees added, big status changes), and a "Quick actions" tile (Add employee, Add truck, Add customer).

### Dispatcher landing (the operational command centre)

Top row: today-focused KPIs.
- Loads pending pickup today, in transit, delivered today, unassigned.
- On-time performance for last 7 days.
- Drivers available right now (active + not on a load).
- Trucks available (active, not in maintenance).

Middle: **Live load board** — table or kanban grouped by status, with each load showing customer, origin → destination, driver, truck, pickup/delivery windows. Drag-to-reassign in v1.5; for v1, an "Assign" action opens a dialog.

Right rail (or below on mobile):
- **Driver availability panel** — names, current load (if any), HOS hours remaining (manual entry in v1, ELD later), cell phone, last status update timestamp.
- **Truck availability panel** — truck number, status, next maintenance due, current driver if assigned.
- **Cross-border crossings today** — separate widget because PARS/ACI tracking matters.
- **Alerts** — late deliveries, drivers approaching HOS limit, unassigned loads with pickup today, customer messages awaiting reply.

Quick actions: New load, Assign driver, Send check call, Message a driver.

### Driver landing (mobile-first, designed for one-handed phone use)

This screen is the driver's whole working interface. Built for 375px width, big tap targets, minimal text.

Top: **Today's load card** — large, single-screen view.
- Customer name, pickup and delivery addresses (tap to open in Google/Apple Maps).
- Pickup and delivery windows.
- Equipment needed.
- Reference numbers.
- Big status update buttons: "At pickup" → "Loaded" → "In transit" → "At delivery" → "Delivered". Each tap creates a `load_status_events` row, optionally with a location note.

Below the load card:
- **HOS hours remaining** — visual gauge (manual entry until ELD integration).
- **Documents needed** — checklist for this load: BOL uploaded? POD uploaded? Customs docs (if cross-border)? One-tap upload from phone camera.
- **Pre-trip inspection (DVIR)** — required by Ontario MTO and US FMCSA before a driver can roll. Quick checklist with defect reporting. If any major defect is found, truck status flips to `out_of_service` and dispatch is notified automatically.
- **Truck assigned** — truck number, fuel level note, next maintenance due, any open defects.
- **My compliance** — warns if driver's licence, medical, or FAST card expires within 30 days.
- **Message dispatch** — single-tap thread back to the on-duty dispatcher.
- **Upcoming loads** — collapsed list of next 3 assigned loads.

### Accounting landing

Top KPIs.
- Loads delivered but not invoiced (action queue — these need invoices).
- Outstanding A/R total, broken down 0–30 / 31–60 / 61–90 / 90+ days.
- Revenue this month (and vs same month prior year if data exists).
- Loads paid this month.

Middle:
- **Invoice queue** — table of delivered loads awaiting invoice generation. One-click "Generate invoice" pulls load + customer details into a draft.
- **Aging A/R** — by customer, with last contact date.
- **Recent payments** — newest first.

Right/bottom:
- Quick actions: Mark invoice paid, Upload invoice, Generate IFTA mileage extract for the quarter.
- IFTA quarter status — shows current quarter's km-per-jurisdiction summary so the bookkeeper isn't surprised at filing time. (Quarterly deadlines: Apr 30, Jul 31, Oct 31, Jan 31.)

## Industry-standard features (research-backed, scoped for v1 vs later)

These are the features modern trucking dispatch software ships with. Not all belong in v1, but the data model above is built to support them so we don't paint ourselves into a corner.

**In v1 (MVP):**
- Load board with status workflow (draft → assigned → in_transit → delivered → invoiced → paid).
- Manual location notes ("crossed Peace Bridge", "at receiver") on status updates.
- Document storage tied to loads, drivers, and trucks with expiry tracking.
- Pre-trip / post-trip inspection (DVIR) — legally required in Canada and US.
- Compliance/expiry alerts engine — drives the dashboard alerts widget.
- Cross-border fields on loads (PARS, ACI/ACE, customs broker) — Keylink runs Canada–US.
- Maintenance log and maintenance-due alerts.
- Basic IFTA inputs (fuel records, trip distances by jurisdiction) and a quarterly extract — not auto-filing, but enough that the bookkeeper isn't reconstructing from receipts.
- In-app messaging.
- Role-aware dashboards as above.

**Phase 2 / nice-to-have:**
- Customer-facing tracking links (read-only public URL with current status, no auth) — shippers expect this in 2026.
- Email / SMS notifications on status changes (Resend + Twilio).
- Recurring load templates (Toro TMS-style — same customer, same lane, repeat weekly).
- Lane profitability and revenue-per-mile reports.
- Driver settlement / pay calculation per load.
- RSS news widget (FreightWaves, Today's Trucking, CTA, Canadian Trucking Alliance).

**v2+ / would require external integration:**
- Real-time GPS / live truck map — needs an ELD (Motive, Samsara, Geotab) or telematics provider.
- Automated HOS — needs ELD integration.
- Auto IFTA filing — needs fuel card data feed (e.g. Comdata, EFS).
- Accounting sync (QuickBooks Online has a Canadian version).
- AI dispatch suggestions / route optimization.
- Load board integrations (DAT, Truckstop, Loadlink for Canada).
- Blockchain BOL / smart-contract payment-on-delivery (genuinely emerging in 2026 but still bleeding edge).

## Canadian compliance & cross-border specifics

The CRM needs to be built knowing Keylink is a Canadian carrier that crosses into the US. These are real regulatory artifacts the system should help track, not just nice-to-haves.

- **CVOR (Ontario)** — every Ontario carrier has a CVOR certificate, renewed annually or biennially based on safety rating. Certificate copy must be in every truck. Track expiry on the company profile and surface in alerts.
- **NSC (National Safety Code)** — federal framework that CVOR enforces locally; relevant for inter-provincial operation.
- **IFTA** — required because Keylink crosses provinces and into the US. Quarterly filing of km-per-jurisdiction and litres-per-jurisdiction. Decals on each truck expire annually (Dec 31). The CRM tracks fuel purchases and trip distances; export a CSV the bookkeeper uses to file.
- **IRP / cab card** — registration system for inter-jurisdictional trucks; lists every province/state the truck is authorized in. Track expiry per truck.
- **CBSA carrier code** — needed to bring freight into Canada. Used on PARS barcodes attached to BOLs at the border.
- **PARS (Pre-Arrival Review System)** — northbound (US → Canada) cargo data; barcode is generated and attached to the BOL before the truck reaches the border.
- **ACI eManifest** — Canadian-side electronic cargo data, transmitted to CBSA at least 1 hour before arrival.
- **ACE Manifest** — US-side equivalent for southbound (Canada → US) loads.
- **FAST card** — driver-level trusted-traveller program for cross-border, 5-year expiry. Track on driver_profiles.
- **Bill of Lading + Canada Customs Invoice (CCI)** — required physical/digital docs per cross-border load.
- **Driver hours of service** — Canadian federal HOS rules differ from US (Canadian: 13 hours driving / 14 on-duty / 16-hour window; US: 11/14 with 70-in-8 cycle). When a driver crosses, they switch to whichever jurisdiction's rules they're in. v1 just tracks driver-entered hours; ELD comes later.
- **DVIR (Driver Vehicle Inspection Report)** — pre-trip and post-trip inspections are legally required and must be retained. The `inspections` table covers this.

These are the artifacts that get a carrier in trouble at audit time if they're not tracked. The compliance/expiry alerts widget pays for the whole CRM.

## RLS policy summary

- `admin` bypasses most checks (service role for some flows, never exposed to client).
- `driver` can `select`/`update` only loads where `driver_id = auth.uid()`.
- `driver` can insert into `load_status_events`, `inspections`, `fuel_records`, and `documents` only for their own loads/trucks.
- `driver` reads only their own `driver_profiles` row and their own personal documents (licence, medical, FAST).
- `dispatcher` can read/write all loads, customers, trucks, trailers, status events, alerts.
- `dispatcher` can read all driver_profiles but cannot modify driver compliance fields (admin-only).
- `accounting` is select-only on loads, customers, trucks, fuel_records, trip_distances; can insert/update `documents` of type `invoice` and update `loads.status` to `invoiced`/`paid`.
- `messages` and `threads` readable only by participants.
- `audit_log` readable by admin only; written by triggers, never by clients.

Write RLS as SQL migrations under `supabase/migrations/`. Every table gets RLS on, no exceptions.

## Project conventions

- App Router, server components by default. Use client components only for interactivity.
- One feature per folder under `app/(authenticated)/` — e.g. `app/(authenticated)/loads/`.
- Server actions for mutations; no API routes unless there's a reason.
- Auth-gate via middleware that checks the session and redirects to `/login`.
- Role checks in a shared `requireRole()` helper used in server components.
- All forms validate with zod schemas defined in `lib/schemas/`.
- Error states, empty states, and loading skeletons are required, not optional.
- Mobile-first — drivers will use phones. Test layouts at 375px width.
- Commit after each green phase. Conventional commits.

## Folder layout

```
app/
  (public)/
    login/
  (authenticated)/
    layout.tsx          # auth + role guard
    dashboard/          # role-aware landing
    loads/
    drivers/            # admin/dispatcher only
    customers/
    trucks/
    documents/
    messages/
    admin/
      employees/        # admin only — onboarding
components/
  ui/                   # shadcn
  loads/
  shared/
lib/
  supabase/
    client.ts
    server.ts
    middleware.ts
  schemas/
  utils/
supabase/
  migrations/
```

## Build phases

1. **Foundation** — auth, RLS, admin employee onboarding, role-aware shell. *(current)*
2. **Loads & dispatch board** — load CRUD, assignment, status workflow, dispatcher dashboard.
3. **Trucks, trailers & customers** — full management screens. Compliance/expiry fields on trucks.
4. **Drivers & compliance** — driver_profiles, driver compliance docs (licence/medical/FAST), document expiry tracking, alerts engine. The dashboard alerts widget lights up here.
5. **Driver mobile experience** — driver landing page, status updates with location notes, BOL/POD upload from phone, DVIR pre-trip / post-trip.
6. **Documents & storage** — full Supabase Storage integration across loads, drivers, trucks. Expiry surfaced on dashboards.
7. **Maintenance** — maintenance log, mileage and time-based intervals, dispatcher warning when assigning a truck due for service.
8. **Messaging** — threads scoped to loads or freeform.
9. **IFTA basics** — fuel records, trip distances, quarterly km/litre extract by jurisdiction.
10. **Accounting view** — invoice queue, aging A/R, payment recording.
11. **Reports** — revenue per period, per driver, per customer, on-time rate.
12. **Polish + v2** — customer tracking links, email/SMS notifications, RSS widget, recurring load templates.

Each phase ships behind a working app. No half-built phase merges. Phases 2–5 are the real product; everything else is sequencing.

## Things to ask the operator before assuming

- Subdomain choice: `app.keylinktransport.ca` vs `crm.keylinktransport.ca` (default: `app`).
- Exact Canadian provinces / US states they run.
- Keylink's CVOR number, IFTA base jurisdiction, CBSA carrier code (so we can pre-fill the company profile).
- Whether they want imperial or metric — default: metric (km, kg, litres) for ops, CAD for money. They should confirm.
- Who the first admin user is.
- Whether multi-currency is needed in v1 (default: no, CAD only). Note that some US shippers pay in USD — flag this.
- Whether they have an existing customer list, truck list, or driver list to import.
