import type { LoadStatus } from "@/lib/supabase/types"

// Distinct colour per load status. The operational pipeline cycles through
// hues so adjacent stages always look different at a glance:
//   draft → assigned → dispatched → at_pickup → loaded → in_transit →
//   at_delivery → delivered → invoiced → paid (+ cancelled)
//
// Delivered stays green — that's the "complete" colour Keylink wanted to
// preserve. Paid is a deeper green so it reads as "delivered and money in".

// Light-context tones — for chips on white cards (load list, detail page,
// dashboard board, recent activity).
export const LOAD_STATUS_TONE: Record<LoadStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  assigned: "bg-violet-100 text-violet-800",
  dispatched: "bg-indigo-100 text-indigo-800",
  at_pickup: "bg-purple-100 text-purple-800",
  loaded: "bg-orange-100 text-orange-800",
  in_transit: "bg-sky-100 text-sky-800",
  at_delivery: "bg-amber-100 text-amber-800",
  delivered: "bg-emerald-100 text-emerald-700",
  invoiced: "bg-teal-100 text-teal-800",
  paid: "bg-emerald-200 text-emerald-900",
  cancelled: "bg-rose-100 text-rose-800",
}

// Dark-glass tones — for chips inside the brand-midnight preview cards and
// the operations map. Higher background opacity + lighter text so the chip
// still reads against the navy backdrop.
export const LOAD_STATUS_TONE_GLASS: Record<LoadStatus, string> = {
  draft: "bg-slate-500/25 text-slate-100",
  assigned: "bg-violet-500/25 text-violet-100",
  dispatched: "bg-indigo-500/25 text-indigo-100",
  at_pickup: "bg-purple-500/25 text-purple-100",
  loaded: "bg-orange-500/25 text-orange-100",
  in_transit: "bg-sky-500/25 text-sky-100",
  at_delivery: "bg-amber-500/25 text-amber-100",
  delivered: "bg-emerald-500/25 text-emerald-100",
  invoiced: "bg-teal-500/25 text-teal-100",
  paid: "bg-emerald-500/40 text-white",
  cancelled: "bg-rose-500/30 text-rose-100",
}
