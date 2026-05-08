import { CITY_COORDS } from "./cities"

export type LngLat = [number, number]

export function geocodeCity(
  city: string | null | undefined,
  province: string | null | undefined,
): LngLat | null {
  if (!city || !province) return null
  const key = `${city.trim().toLowerCase()},${province.trim().toLowerCase()}`
  return CITY_COORDS[key] ?? null
}
