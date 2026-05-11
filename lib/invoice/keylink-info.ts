// Carrier-side details printed on every invoice. Sourced from
// keylinktransport.ca; HST/GST # and bank instructions still pending an
// accounting confirmation.
export const KEYLINK_INFO = {
  legalName: "Keylink Transport Ltd.",
  addressLines: ["2790 Allwood Street", "Abbotsford, BC V2T 3R7", "Canada"],
  phone: "778-666-3626",
  email: "dispatch@keylinktransport.com",
  website: "keylinktransport.ca",

  // Regulatory identifiers. USDOT/MC are pulled from the site; HST/GST and the
  // Canadian-side safety registration still need accounting input.
  gstHstNumber: "TBD GST/HST #",
  usdotNumber: "USDOT 2832041",
  mcNumber: "MC# 946449",

  // Payment instructions appear in the footer. Bank/EFT details TBD with
  // accounting before live invoices go out.
  paymentInstructions:
    "Remit by EFT, wire, or cheque. Bank instructions will be added once accounting confirms.",
} as const
