"use client"

// Elegant count-up animation for KPI values. Accepts either a raw number
// (counts integer → toLocaleString) or a pre-formatted string like
// "CA$123,456" or "$1,234.50" (parses the numeric portion, animates it,
// re-applies the prefix/suffix on each frame so the currency symbol and
// any trailing units stay in place).
//
// SSR-safe: useState initializer renders the "0" frame so server HTML
// matches the first client paint; useEffect then animates up to the
// target. Honors prefers-reduced-motion by jumping straight to the final
// value.

import { useEffect, useState } from "react"

type Parsed = {
  target: number
  render: (current: number) => string
  raw: string
}

function parseValue(value: number | string): Parsed {
  if (typeof value === "number") {
    return {
      target: value,
      render: (n) => Math.round(n).toLocaleString(),
      raw: value.toLocaleString(),
    }
  }

  // Match: optional non-digit prefix (currency symbol, etc.) + signed
  // number with thousands separators and optional decimals + suffix.
  const match = value.match(/^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/)
  if (!match) {
    return { target: NaN, render: () => value, raw: value }
  }

  const prefix = match[1]
  const numStr = match[2].replace(/,/g, "")
  const suffix = match[3]
  const target = Number(numStr)
  if (!Number.isFinite(target)) {
    return { target: NaN, render: () => value, raw: value }
  }

  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0

  return {
    target,
    render: (n) => {
      const rounded = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString()
      const [intPart, decPart] = rounded.split(".")
      const formatted =
        Number(intPart).toLocaleString() + (decPart ? "." + decPart : "")
      return `${prefix}${formatted}${suffix}`
    },
    raw: value,
  }
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

export function CountUp({
  value,
  duration = 1200,
  className,
}: {
  value: number | string
  duration?: number
  className?: string
}) {
  const parsed = parseValue(value)
  const [display, setDisplay] = useState(() => parsed.render(0))

  useEffect(() => {
    if (!Number.isFinite(parsed.target)) {
      setDisplay(parsed.raw)
      return
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(parsed.render(parsed.target))
      return
    }

    let raf = 0
    let start: number | null = null

    const tick = (ts: number) => {
      if (start === null) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = easeOutQuart(progress)
      setDisplay(parsed.render(parsed.target * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
    // `value` is the stable input; parseValue is pure on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return <span className={className}>{display}</span>
}
