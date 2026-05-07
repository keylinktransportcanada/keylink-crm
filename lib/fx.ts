import "server-only"

// Bank of Canada Valet API: USD→CAD daily noon rate. Free, public, no key.
// We only need USD→CAD since the CRM treats CAD as the base currency.
const BOC_USD_CAD_URL =
  "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1"

let cached: { rate: number; fetchedAt: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function getUsdToCadRate(): Promise<number> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate
  }

  try {
    const res = await fetch(BOC_USD_CAD_URL, {
      // Next 16 fetch caching: revalidate hourly even across deploys.
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(`BoC API responded ${res.status}`)
    const json = (await res.json()) as {
      observations?: Array<{ FXUSDCAD?: { v?: string } }>
    }
    const v = json.observations?.[0]?.FXUSDCAD?.v
    const rate = v ? Number(v) : NaN
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("BoC API returned an invalid rate")
    }
    cached = { rate, fetchedAt: Date.now() }
    return rate
  } catch {
    // If we have a stale cached rate, use it rather than fail the whole save.
    if (cached) return cached.rate
    // Last-resort fallback: a sane default close to recent history. Loads
    // saved with this rate will still be correct in CAD up to the FX delta;
    // dispatchers can re-edit once BoC is reachable.
    return 1.37
  }
}
