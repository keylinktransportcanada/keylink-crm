-- Sample data for local dev / demo. Idempotent — re-running won't duplicate
-- rows because every insert pins the primary key and uses ON CONFLICT.
-- Loads use the auto-generated load_number trigger (the column is left null).
--
-- All seed UUIDs are valid v4 (third group starts with "4", fourth group with
-- "8") so Zod's z.uuid() in the load form accepts them.

-- ---------------------------------------------------------------------------
-- Cleanup so this seed can be re-applied cleanly. Targets only rows with the
-- seed-specific UUID prefixes; real test data is untouched.
-- Order matters: status events → loads → trailers/trucks → customers (FKs).
-- ---------------------------------------------------------------------------
-- Old (invalid-UUID) batch from the first seed attempt.
delete from public.loads
 where id::text like '44444444-%';
delete from public.trailers
 where id::text like '33333333-%';
delete from public.trucks
 where id::text like '22222222-%';
delete from public.customers
 where id::text like '11111111-%';

-- Current batch — clean lse first because it has no unique key for
-- ON CONFLICT, so an unconditional re-insert would dupe the timeline.
delete from public.load_status_events
 where load_id::text like '10ad0001-%';

-- ---------------------------------------------------------------------------
-- Customers (10) — mix of Canadian and US shippers, varied payment terms.
-- ---------------------------------------------------------------------------
insert into public.customers (
  id, name, contact_name, email, phone, address, billing_address,
  payment_terms_days, credit_limit_cad, active, notes
) values
  ('c0000001-0000-4000-8000-000000000001', 'Westbridge Foods Ltd.',          'Jenna Park',     'jenna@westbridge.ca',     '604-555-0102', '120 Industrial Way, Burnaby, BC',          '120 Industrial Way, Burnaby, BC V5A 1B2',     30,  150000, true,  'Reefer required for most lanes.'),
  ('c0000001-0000-4000-8000-000000000002', 'Maple Logistics Inc.',           'Daniel Tran',    'd.tran@maplelog.ca',      '416-555-0214', '88 Steelcase Rd, Markham, ON',             '88 Steelcase Rd, Markham, ON L3R 4N5',         45,  250000, true,  'Net-45 terms — long-time partner.'),
  ('c0000001-0000-4000-8000-000000000003', 'Sunbelt Distributors',           'Ana Cortez',     'billing@sunbelt-us.com',  '253-555-0911', '4500 Port Way, Tacoma, WA',                '4500 Port Way, Tacoma, WA 98421',              30,  200000, true,  'US shipper — invoices in USD.'),
  ('c0000001-0000-4000-8000-000000000004', 'Pacific Lumber Co.',             'Greg Holm',      'shipping@paclumber.ca',   '250-555-0488', '15 Mill Road, Nanaimo, BC',                '15 Mill Road, Nanaimo, BC V9R 6L1',            30,   80000, true,  null),
  ('c0000001-0000-4000-8000-000000000005', 'Northstar Beverage',             'Priya Suresh',   'priya@northstarbev.ca',   '587-555-0707', '900 Glenmore Tr SE, Calgary, AB',          '900 Glenmore Tr SE, Calgary, AB T2C 3R6',      60,   90000, true,  'Slow payer — confirm PO before dispatch.'),
  ('c0000001-0000-4000-8000-000000000006', 'Cascade Auto Parts',             'Marco Rivera',   'marco@cascadeauto.com',   '503-555-0322', '2200 NE Sandy Blvd, Portland, OR',         '2200 NE Sandy Blvd, Portland, OR 97232',       30,  120000, true,  null),
  ('c0000001-0000-4000-8000-000000000007', 'Great Lakes Steel Supply',       'Hannah Boyd',    'h.boyd@gls-steel.ca',     '519-555-0610', '40 Wharncliffe Rd, London, ON',            '40 Wharncliffe Rd, London, ON N6H 2B1',        30,  175000, true,  'Flatbed loads. Tarps required.'),
  ('c0000001-0000-4000-8000-000000000008', 'Polaris Cold Chain',             'Liam Forsyth',   'liam@polariscold.com',    '514-555-0145', '1010 Côte-Vertu, Montréal, QC',            '1010 Côte-Vertu, Montréal, QC H4N 1C1',        30,  140000, true,  'Reefer 0°C. Lumper paid by shipper.'),
  ('c0000001-0000-4000-8000-000000000009', 'Coastal Plastics Group',         'Emily Wong',     'emily@coastalplastics.ca','778-555-0828', '50 Tilbury Rd, Delta, BC',                 '50 Tilbury Rd, Delta, BC V3M 6V4',             45,   60000, true,  null),
  ('c0000001-0000-4000-8000-00000000000a', 'Borderline Freight Brokers',     'Ahmed Khan',     'ops@borderlineFB.com',    '905-555-0419', '300 Britannia Rd E, Mississauga, ON',      '300 Britannia Rd E, Mississauga, ON L4Z 1X9',  30,  100000, false, 'Inactive — collection issues 2025.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Trucks (10) — fleet across statuses, varied compliance dates.
-- Compliance dates are absolute so the alerts widget has predictable items
-- to surface; "today" in BC during the test window is around 2026-05.
-- ---------------------------------------------------------------------------
insert into public.trucks (
  id, truck_number, make, model, year, plate, plate_province, plate_expiry,
  vin, status, current_odometer_km, insurance_policy, insurance_expiry,
  ifta_decal_year, ifta_decal_expiry, safety_sticker_expiry,
  cvor_certificate_expiry, notes
) values
  ('70000001-0000-4000-8000-000000000001', 'KL-101', 'Freightliner', 'Cascadia',   2022, 'BC101AB', 'BC', '2026-09-15', '1FUJGLDR8NLBP1101', 'active',         412000, 'NW-INS-101', '2026-08-30', 2026, '2026-12-31', '2026-11-12', '2027-02-01', null),
  ('70000001-0000-4000-8000-000000000002', 'KL-102', 'Volvo',        'VNL 760',    2021, 'BC102CD', 'BC', '2026-06-08', '4V4NC9EH9MN1234567','active',         586400, 'NW-INS-102', '2026-05-22', 2026, '2026-12-31', '2026-07-30', '2026-12-15', 'Plate due — flag at 30 days.'),
  ('70000001-0000-4000-8000-000000000003', 'KL-103', 'Kenworth',     'T680',       2023, 'BC103EF', 'BC', '2027-03-22', '1XKYDP9X0PJ987654','active',         128900, 'NW-INS-103', '2027-01-10', 2027, '2027-12-31', '2027-04-15', '2027-04-15', null),
  ('70000001-0000-4000-8000-000000000004', 'KL-104', 'Peterbilt',    '579',        2020, 'BC104GH', 'BC', '2026-05-14', '1XPBDP9X1LD555214','maintenance',    742300, 'NW-INS-104', '2026-04-30', 2026, '2026-12-31', '2026-06-01', '2026-09-09', 'In shop — DPF replacement.'),
  ('70000001-0000-4000-8000-000000000005', 'KL-105', 'Mack',         'Anthem',     2019, 'BC105IJ', 'BC', '2026-07-20', '1M1AN09Y8KM088112', 'active',        833100, 'NW-INS-105', '2026-10-05', 2026, '2026-12-31', '2026-08-22', '2026-10-30', null),
  ('70000001-0000-4000-8000-000000000006', 'KL-106', 'Freightliner', 'Cascadia',   2024, 'BC106KL', 'BC', '2027-08-01', '1FUJGLDR8RLBP2206', 'active',         54200,  'NW-INS-106', '2027-06-12', 2027, '2027-12-31', '2027-09-12', '2027-09-12', 'New tractor — first service due 80,000 km.'),
  ('70000001-0000-4000-8000-000000000007', 'KL-107', 'International','LT625',      2021, 'BC107MN', 'BC', '2026-11-30', '3HSDZAPR8MN772113', 'active',        611800, 'NW-INS-107', '2026-12-20', 2026, '2026-12-31', '2026-12-01', '2027-01-04', null),
  ('70000001-0000-4000-8000-000000000008', 'KL-108', 'Volvo',        'VNL 740',    2022, 'BC108OP', 'BC', '2026-10-10', '4V4NC9EH3NN221002', 'out_of_service', 977500, 'NW-INS-108', '2026-09-15', 2026, '2026-12-31', '2026-09-15', '2026-09-15', 'Engine teardown. ETA back: late summer.'),
  ('70000001-0000-4000-8000-000000000009', 'KL-109', 'Kenworth',     'W990',       2023, 'BC109QR', 'BC', '2027-02-14', '1XKWD49X9PJ001119', 'active',        205400, 'NW-INS-109', '2027-04-01', 2027, '2027-12-31', '2027-02-28', '2027-05-19', null),
  ('70000001-0000-4000-8000-00000000000a', 'KL-110', 'Peterbilt',    '389',        2018, 'BC110ST', 'BC', '2026-04-25', '1XPHDP9X4JD771101', 'retired',        1142000,'NW-INS-110', '2026-04-05', 2026, '2026-12-31', '2026-05-01', '2026-05-01', 'Sold Apr 2026 — kept for history.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Trailers (4) — handful so loads can reference them.
-- ---------------------------------------------------------------------------
insert into public.trailers (
  id, trailer_number, type, plate, plate_province, plate_expiry, vin,
  status, last_inspection_date, next_inspection_due, notes
) values
  ('7a000001-0000-4000-8000-000000000001', 'TR-201', 'dry_van', 'BC201ZA', 'BC', '2026-12-01', '1JJV532D8KL228111', 'active',      '2026-04-10', '2026-10-10', null),
  ('7a000001-0000-4000-8000-000000000002', 'TR-202', 'reefer',  'BC202ZB', 'BC', '2026-11-18', '1UYVS2538MM880001', 'active',      '2026-03-22', '2026-09-22', '−5°C calibrated 2026-03.'),
  ('7a000001-0000-4000-8000-000000000003', 'TR-203', 'flatbed', 'BC203ZC', 'BC', '2026-09-30', '1JJV532D9NL112233', 'maintenance', '2026-01-15', '2026-07-15', 'Tarp ring repair.'),
  ('7a000001-0000-4000-8000-000000000004', 'TR-204', 'reefer',  'BC204ZD', 'BC', '2027-01-22', '1UYVS2536PM660004', 'active',      '2026-05-01', '2026-11-01', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Loads (11) — covers every status from draft through paid + a cancelled
-- one. load_number is auto-filled by the BEFORE INSERT trigger when blank,
-- so we leave it as an empty string.
-- ---------------------------------------------------------------------------
insert into public.loads (
  id, load_number,
  customer_id, truck_id, trailer_id,
  origin_company, origin_address, origin_city, origin_province, origin_country,
  destination_company, destination_address, destination_city, destination_province, destination_country,
  pickup_date, delivery_date,
  status, load_type, commodity, weight_kg, pieces, equipment_required,
  currency, fx_rate_to_cad, rate_cad, fuel_surcharge_cad, accessorial_charges_cad, total_billed_cad,
  is_cross_border, customs_broker, pars_pass_number, aci_aces_number,
  reference_number, po_number, notes, internal_notes
) values
  -- 1. DRAFT (no truck, no trailer yet)
  ('10ad0001-0000-4000-8000-000000000001', '',
   'c0000001-0000-4000-8000-000000000001', null, null,
   'Westbridge Foods', '120 Industrial Way', 'Burnaby', 'BC', 'CA',
   'Sunbelt DC', '4500 Port Way', 'Tacoma', 'WA', 'US',
   '2026-05-12', '2026-05-13',
   'draft', 'ftl', 'Frozen produce', 18500, 26, 'refrigeration',
   'CAD', 1.0, 2950.00, 320.00, 0, 3270.00,
   true, 'Livingston', null, null,
   'WB-2026-441', null, 'Reefer −18°C. Driver needs FAST.', 'Quote pending.'),

  -- 2. ASSIGNED
  ('10ad0001-0000-4000-8000-000000000002', '',
   'c0000001-0000-4000-8000-000000000002', '70000001-0000-4000-8000-000000000001', '7a000001-0000-4000-8000-000000000001',
   'Maple Logistics — Markham DC', '88 Steelcase Rd', 'Markham', 'ON', 'CA',
   'Great Lakes Steel — London', '40 Wharncliffe Rd', 'London', 'ON', 'CA',
   '2026-05-09', '2026-05-09',
   'assigned', 'ftl', 'Mixed retail freight', 21000, 14, null,
   'CAD', 1.0, 1850.00, 220.00, 75.00, 2145.00,
   false, null, null, null,
   'ML-2046', '6601-22', null, null),

  -- 3. DISPATCHED
  ('10ad0001-0000-4000-8000-000000000003', '',
   'c0000001-0000-4000-8000-000000000005', '70000001-0000-4000-8000-000000000003', '7a000001-0000-4000-8000-000000000002',
   'Northstar Beverage', '900 Glenmore Tr SE', 'Calgary', 'AB', 'CA',
   'Coastal Plastics Group', '50 Tilbury Rd', 'Delta', 'BC', 'CA',
   '2026-05-08', '2026-05-09',
   'dispatched', 'ftl', 'Bottled water (24-pallet)', 24000, 24, 'refrigeration',
   'CAD', 1.0, 2400.00, 280.00, 0, 2680.00,
   false, null, null, null,
   null, 'NS-7710', null, null),

  -- 4. AT PICKUP
  ('10ad0001-0000-4000-8000-000000000004', '',
   'c0000001-0000-4000-8000-000000000007', '70000001-0000-4000-8000-000000000005', '7a000001-0000-4000-8000-000000000003',
   'Great Lakes Steel — London', '40 Wharncliffe Rd', 'London', 'ON', 'CA',
   'Cascade Auto Parts', '2200 NE Sandy Blvd', 'Portland', 'OR', 'US',
   '2026-05-07', '2026-05-11',
   'at_pickup', 'ftl', 'Steel coil — 22 ton', 22000, 8, 'tarps',
   'USD', 1.36, 5440.00, 612.00, 0, 6052.00,
   true, 'A.N. Deringer', 'PARS-78812114', 'ACE-0044112', 'GLS-99221', 'CAP-118811', 'Tarp + winch straps required.', null),

  -- 5. LOADED
  ('10ad0001-0000-4000-8000-000000000005', '',
   'c0000001-0000-4000-8000-000000000008', '70000001-0000-4000-8000-000000000007', '7a000001-0000-4000-8000-000000000004',
   'Polaris Cold Chain — Montreal', '1010 Côte-Vertu', 'Montréal', 'QC', 'CA',
   'Westbridge Foods', '120 Industrial Way', 'Burnaby', 'BC', 'CA',
   '2026-05-06', '2026-05-12',
   'loaded', 'ftl', 'Frozen seafood', 19800, 22, 'refrigeration',
   'CAD', 1.0, 6200.00, 720.00, 150.00, 7070.00,
   false, null, null, null,
   'PCC-3340', null, 'Hold at −20°C. Continuous run.', null),

  -- 6. IN TRANSIT (cross-border)
  ('10ad0001-0000-4000-8000-000000000006', '',
   'c0000001-0000-4000-8000-000000000003', '70000001-0000-4000-8000-000000000002', '7a000001-0000-4000-8000-000000000001',
   'Sunbelt Distributors', '4500 Port Way', 'Tacoma', 'WA', 'US',
   'Maple Logistics — Markham DC', '88 Steelcase Rd', 'Markham', 'ON', 'CA',
   '2026-05-04', '2026-05-09',
   'in_transit', 'ftl', 'Mixed dry goods', 18900, 18, null,
   'USD', 1.36, 5780.00, 644.00, 0, 6424.00,
   true, 'Livingston', 'PARS-77441120', 'ACI-0099221', 'SB-7760', null, null, 'Crossed Peace Bridge 06:14.'),

  -- 7. AT DELIVERY
  ('10ad0001-0000-4000-8000-000000000007', '',
   'c0000001-0000-4000-8000-000000000004', '70000001-0000-4000-8000-000000000009', '7a000001-0000-4000-8000-000000000003',
   'Pacific Lumber Co.', '15 Mill Road', 'Nanaimo', 'BC', 'CA',
   'Coastal Plastics Group', '50 Tilbury Rd', 'Delta', 'BC', 'CA',
   '2026-05-06', '2026-05-07',
   'at_delivery', 'ftl', 'Cedar lumber', 26500, 1, 'tarps',
   'CAD', 1.0, 1620.00, 180.00, 0, 1800.00,
   false, null, null, null,
   'PL-2241', null, null, null),

  -- 8. DELIVERED (awaiting invoice)
  ('10ad0001-0000-4000-8000-000000000008', '',
   'c0000001-0000-4000-8000-000000000006', '70000001-0000-4000-8000-000000000005', '7a000001-0000-4000-8000-000000000001',
   'Cascade Auto Parts', '2200 NE Sandy Blvd', 'Portland', 'OR', 'US',
   'Maple Logistics — Markham DC', '88 Steelcase Rd', 'Markham', 'ON', 'CA',
   '2026-04-30', '2026-05-04',
   'delivered', 'ftl', 'Auto parts (palletized)', 17400, 32, null,
   'USD', 1.36, 5100.00, 588.00, 60.00, 5748.00,
   true, 'A.N. Deringer', 'PARS-77001188', 'ACI-0088112', 'CAP-119922', 'ML-99113', null, null),

  -- 9. INVOICED
  ('10ad0001-0000-4000-8000-000000000009', '',
   'c0000001-0000-4000-8000-000000000002', '70000001-0000-4000-8000-000000000003', '7a000001-0000-4000-8000-000000000002',
   'Maple Logistics — Markham DC', '88 Steelcase Rd', 'Markham', 'ON', 'CA',
   'Polaris Cold Chain — Montreal', '1010 Côte-Vertu', 'Montréal', 'QC', 'CA',
   '2026-04-22', '2026-04-23',
   'invoiced', 'ftl', 'Frozen pizza', 20300, 28, 'refrigeration',
   'CAD', 1.0, 2150.00, 240.00, 0, 2390.00,
   false, null, null, null,
   'ML-1989', null, null, 'Invoice INV-L-2026-0009 emailed 2026-04-25.'),

  -- 10. PAID
  ('10ad0001-0000-4000-8000-00000000000a', '',
   'c0000001-0000-4000-8000-000000000005', '70000001-0000-4000-8000-000000000006', '7a000001-0000-4000-8000-000000000004',
   'Northstar Beverage', '900 Glenmore Tr SE', 'Calgary', 'AB', 'CA',
   'Sunbelt Distributors', '4500 Port Way', 'Tacoma', 'WA', 'US',
   '2026-04-15', '2026-04-18',
   'paid', 'ftl', 'Sports drink — 26 pallets', 23200, 26, 'refrigeration',
   'USD', 1.36, 5980.00, 700.00, 100.00, 6780.00,
   true, 'Livingston', 'PARS-76001102', 'ACE-0077200', 'NS-7705', 'SB-7401', null, 'Paid 2026-05-02 (Net 30).'),

  -- 11. CANCELLED
  ('10ad0001-0000-4000-8000-00000000000b', '',
   'c0000001-0000-4000-8000-000000000009', null, null,
   'Coastal Plastics Group', '50 Tilbury Rd', 'Delta', 'BC', 'CA',
   'Pacific Lumber Co.', '15 Mill Road', 'Nanaimo', 'BC', 'CA',
   '2026-05-02', '2026-05-03',
   'cancelled', 'ftl', 'Plastic bins', 8400, 14, null,
   'CAD', 1.0, 980.00, 100.00, 0, 1080.00,
   false, null, null, null,
   'CPG-3318', null, null, 'Cancelled — customer rebooked with another carrier.'),

  -- 12. BACK-DATED — early April PAID. Gives the ops chart something further
  -- back to plot.
  ('10ad0001-0000-4000-8000-00000000000c', '',
   'c0000001-0000-4000-8000-000000000007', '70000001-0000-4000-8000-000000000005', '7a000001-0000-4000-8000-000000000003',
   'Great Lakes Steel — London', '40 Wharncliffe Rd', 'London', 'ON', 'CA',
   'Pacific Lumber Co.', '15 Mill Road', 'Nanaimo', 'BC', 'CA',
   '2026-04-02', '2026-04-07',
   'paid', 'ftl', 'Steel rebar', 24800, 12, 'tarps',
   'CAD', 1.0, 5400.00, 640.00, 0, 6040.00,
   false, null, null, null,
   'GLS-99001', null, null, 'Paid 2026-04-21.'),

  -- 13. BACK-DATED — mid April PAID, cross-border.
  ('10ad0001-0000-4000-8000-00000000000d', '',
   'c0000001-0000-4000-8000-000000000003', '70000001-0000-4000-8000-000000000007', '7a000001-0000-4000-8000-000000000001',
   'Sunbelt Distributors', '4500 Port Way', 'Tacoma', 'WA', 'US',
   'Westbridge Foods', '120 Industrial Way', 'Burnaby', 'BC', 'CA',
   '2026-04-08', '2026-04-10',
   'paid', 'ftl', 'Mixed dry goods', 18200, 22, null,
   'USD', 1.36, 4250.00, 480.00, 75.00, 4805.00,
   true, 'Livingston', 'PARS-75502211', 'ACI-0066301', 'SB-7099', null, null, 'Paid 2026-04-26.'),

  -- 14. BACK-DATED — mid April INVOICED (still open A/R).
  ('10ad0001-0000-4000-8000-00000000000e', '',
   'c0000001-0000-4000-8000-000000000008', '70000001-0000-4000-8000-000000000003', '7a000001-0000-4000-8000-000000000004',
   'Polaris Cold Chain — Montreal', '1010 Côte-Vertu', 'Montréal', 'QC', 'CA',
   'Northstar Beverage', '900 Glenmore Tr SE', 'Calgary', 'AB', 'CA',
   '2026-04-12', '2026-04-15',
   'invoiced', 'ftl', 'Frozen meals', 19500, 24, 'refrigeration',
   'CAD', 1.0, 5800.00, 660.00, 120.00, 6580.00,
   false, null, null, null,
   'PCC-3215', null, 'Continuous run.', 'Invoice INV-L-2026-0014 emailed 2026-04-19.'),

  -- 15. BACK-DATED — late April DELIVERED (awaiting invoice).
  ('10ad0001-0000-4000-8000-00000000000f', '',
   'c0000001-0000-4000-8000-000000000005', '70000001-0000-4000-8000-000000000009', '7a000001-0000-4000-8000-000000000002',
   'Northstar Beverage', '900 Glenmore Tr SE', 'Calgary', 'AB', 'CA',
   'Coastal Plastics Group', '50 Tilbury Rd', 'Delta', 'BC', 'CA',
   '2026-04-19', '2026-04-21',
   'delivered', 'ftl', 'Bottled water', 22600, 22, 'refrigeration',
   'CAD', 1.0, 2280.00, 260.00, 0, 2540.00,
   false, null, null, null,
   'NS-7892', null, null, null)
on conflict (id) do nothing;

-- Stamp created_at on the back-dated loads so the dashboard's time-bucketed
-- queries (revenue trend, "delivered today") slot them in April rather than
-- "now". The status_events insert below uses these timestamps as well.
update public.loads
   set created_at = '2026-04-02 09:15:00-07'::timestamptz,
       updated_at = '2026-04-21 14:00:00-07'::timestamptz
 where id = '10ad0001-0000-4000-8000-00000000000c';
update public.loads
   set created_at = '2026-04-07 11:30:00-07'::timestamptz,
       updated_at = '2026-04-26 10:00:00-07'::timestamptz
 where id = '10ad0001-0000-4000-8000-00000000000d';
update public.loads
   set created_at = '2026-04-11 08:45:00-04'::timestamptz,
       updated_at = '2026-04-19 16:30:00-04'::timestamptz
 where id = '10ad0001-0000-4000-8000-00000000000e';
update public.loads
   set created_at = '2026-04-18 07:20:00-06'::timestamptz,
       updated_at = '2026-04-21 18:45:00-07'::timestamptz
 where id = '10ad0001-0000-4000-8000-00000000000f';

-- Mirror the load creation as an initial status event so the timeline isn't
-- empty (the app inserts these via server action; for seeded data we backfill
-- one row per load).
insert into public.load_status_events (load_id, status, location_note, created_at)
select id, status, null, created_at
from public.loads
where id::text like '10ad0001-%'
on conflict do nothing;
