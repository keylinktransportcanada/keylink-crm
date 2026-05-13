import {
  ArrowLeftRight,
  CloudFog,
  CloudRain,
  CloudSnow,
  Cloudy,
  MapPin,
  Sun,
  UserCheck,
  Zap,
  type LucideIcon,
} from "lucide-react"

import {
  getAmbassadorBridgeWait,
  getDriverAvailability,
  getTorontoWeather,
} from "@/lib/widgets"
import { getUsdToCadRate } from "@/lib/fx"
import { cn } from "@/lib/utils"

function weatherIcon(code: number): LucideIcon {
  if (code === 0 || code <= 2) return Sun
  if (code === 3) return Cloudy
  if (code <= 48) return CloudFog
  if (code <= 67 || (code >= 80 && code <= 82)) return CloudRain
  if (code <= 77 || (code >= 85 && code <= 86)) return CloudSnow
  return Zap
}

type WidgetProps = {
  icon: LucideIcon
  iconTone: string
  label: string
  value: string
  sub?: string | null
  trend?: { value: string; positive: boolean } | null
}

function Widget({ icon: Icon, iconTone, label, value, sub, trend }: WidgetProps) {
  return (
    <div className="flex min-w-[148px] items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          iconTone,
        )}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <span className="font-sans text-base font-semibold text-brand-navy tabular-nums">
          {value}
        </span>
        {sub ? (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {sub}
            {trend ? (
              <span
                className={cn(
                  "ml-1 font-medium tabular-nums",
                  trend.positive ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {trend.positive ? "▲" : "▼"} {trend.value}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export async function HeaderWidgets() {
  const [weather, border, usdCad, availability] = await Promise.all([
    getTorontoWeather(),
    getAmbassadorBridgeWait(),
    getUsdToCadRate().catch(() => null),
    getDriverAvailability(),
  ])

  const WeatherIcon = weather ? weatherIcon(weather.code) : Sun

  // BoC publishes USD→CAD. The widget label below is "CAD → USD" so we invert.
  const cadToUsd =
    typeof usdCad === "number" && usdCad > 0 ? 1 / usdCad : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Widget
        icon={WeatherIcon}
        iconTone="bg-amber-100 text-amber-700"
        label="Weather"
        value={weather ? `${weather.tempC}°C` : "—"}
        sub={weather ? `${weather.label} · ${weather.city}` : "Unavailable"}
      />

      <Widget
        icon={MapPin}
        iconTone="bg-blue-100 text-blue-700"
        label="Border wait"
        value={
          border && border.waitMinutes !== null
            ? `${border.waitMinutes} min`
            : border
              ? "No delay"
              : "—"
        }
        sub={border ? border.port : "Unavailable"}
      />

      <Widget
        icon={ArrowLeftRight}
        iconTone="bg-violet-100 text-violet-700"
        label="CAD → USD"
        value={cadToUsd ? `$${cadToUsd.toFixed(4)}` : "—"}
        sub={usdCad ? `1 USD = $${usdCad.toFixed(4)} CAD` : "Unavailable"}
      />

      <Widget
        icon={UserCheck}
        iconTone="bg-emerald-100 text-emerald-700"
        label="Driver availability"
        value={availability.pct === null ? "—" : `${availability.pct}%`}
        sub={
          availability.totalActive > 0
            ? `${availability.free} of ${availability.totalActive} free`
            : "No drivers on file"
        }
      />
    </div>
  )
}
