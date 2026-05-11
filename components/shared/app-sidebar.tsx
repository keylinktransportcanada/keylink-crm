"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"
import { navItemsForRole } from "@/lib/nav"
import type { Role } from "@/lib/auth"

// Map nav-href → number of attention-grabbing items the rail should surface
// next to that link as a tiny caution chip.
function buildBadgeMap(inspectionAlertCount: number): Map<string, number> {
  const map = new Map<string, number>()
  if (inspectionAlertCount > 0) {
    map.set("/trucks", inspectionAlertCount)
  }
  return map
}

export function AppSidebar({
  role,
  inspectionAlertCount = 0,
}: {
  role: Role
  inspectionAlertCount?: number
}) {
  const pathname = usePathname()
  const items = navItemsForRole(role)
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)
  const badges = buildBadgeMap(inspectionAlertCount)

  return (
    <>
      {/* Mobile: horizontal pills above the content. The hover-expand pattern
          doesn't translate to touch, so we keep the existing scrollable bar.
          Sticky under the topbar so the whole nav header stays pinned while
          the content scrolls beneath it. top-14 ≈ topbar height (56px). */}
      <nav
        aria-label="Primary"
        className={cn(
          "sticky top-14 z-30 flex shrink-0 gap-1 overflow-x-auto px-3 py-2 lg:hidden",
          "border-b border-white/10 bg-brand-midnight/70 backdrop-blur-2xl backdrop-saturate-150",
          "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),0_4px_16px_-8px_rgba(10,14,26,0.45)]",
        )}
      >
        {items.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          const badge = badges.get(item.href) ?? 0
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-brand-gold text-brand-navy [box-shadow:inset_0_1px_0_rgba(255,255,255,0.4),0_1px_2px_rgba(10,14,26,0.4)]"
                  : "text-brand-cloud/60 hover:bg-white/10 hover:text-brand-cloud",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.label}</span>
              {badge > 0 ? (
                <span
                  aria-label={`${badge} alert${badge === 1 ? "" : "s"}`}
                  className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white"
                >
                  <AlertTriangle className="size-2.5" />
                  {badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      {/* Desktop: an icon rail by default that expands into a full nav on
          hover. The wrapper reserves a 64px column in the flex row; the nav
          itself is fixed-positioned to the viewport so it always fills the
          visible height regardless of scroll or content length. The sticky
          topbar (z-40) sits above the rail (z-30) so its bottom edge stays
          drawn over the top of the sidebar at all scroll positions. */}
      <div className="hidden w-16 shrink-0 lg:block">
        <nav
          aria-label="Primary"
          className={cn(
            // pt-24 = topbar height (~56px) + breathing room so the first
            // nav item doesn't crowd the bottom edge of the sticky topbar.
            "group fixed inset-y-0 left-0 z-30 isolate flex w-16 flex-col overflow-hidden pt-24 pb-4",
            "border-r border-white/10 bg-brand-midnight/70 backdrop-blur-2xl backdrop-saturate-150",
            "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(255,255,255,0.04),0_8px_24px_-8px_rgba(10,14,26,0.45)]",
            "transition-[width] duration-200 ease-out hover:w-56",
            "hover:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),inset_-1px_0_0_rgba(255,255,255,0.04),8px_0_28px_-12px_rgba(10,14,26,0.6)]",
          )}
        >
          {/* Teal radial wash at the top — matches the KPI/chart liquid-glass family. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,160,146,0.18)_0%,transparent_70%)]"
          />

          {items.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            const badge = badges.get(item.href) ?? 0
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={
                  badge > 0
                    ? `${item.label} — ${badge} inspection alert${badge === 1 ? "" : "s"}`
                    : item.label
                }
                className={cn(
                  "relative mx-2 my-0.5 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-brand-gold text-brand-navy hover:bg-brand-gold-light [box-shadow:inset_0_1px_0_rgba(255,255,255,0.45),0_1px_2px_rgba(10,14,26,0.45)]"
                    : "text-brand-cloud/60 hover:bg-white/10 hover:text-brand-cloud",
                )}
              >
                <span className="relative">
                  <Icon className="size-5 shrink-0" />
                  {/* Pulsing red caution dot pinned to the icon — visible
                      whether the rail is collapsed (icon-only) or expanded. */}
                  {badge > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 inline-flex size-2 animate-pulse rounded-full bg-red-500 ring-2 ring-brand-midnight"
                    />
                  ) : null}
                </span>
                <span
                  className={cn(
                    "flex flex-1 items-center justify-between gap-2 opacity-0 transition-opacity duration-150",
                    "group-hover:opacity-100 group-hover:delay-100",
                  )}
                >
                  <span>{item.label}</span>
                  {badge > 0 ? (
                    <span
                      aria-label={`${badge} inspection alert${badge === 1 ? "" : "s"}`}
                      className="inline-flex items-center gap-0.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                    >
                      <AlertTriangle className="size-2.5" />
                      {badge}
                    </span>
                  ) : null}
                </span>
              </Link>
            )
          })}

          {/* Always-on footer: stacks vertically inside the 64px rail and
              expands the chip label to "Keylink Beta" once the rail opens. */}
          <div
            className="mt-auto flex flex-col items-center gap-1 pt-4 pb-1 whitespace-nowrap"
            title={`Keylink CRM v${APP_VERSION} · Beta`}
          >
            <span className="text-[10px] font-mono font-medium tracking-tight text-brand-cloud/65">
              v{APP_VERSION}
            </span>
            <span className="rounded-sm bg-brand-teal/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-brand-teal-light">
              <span className="hidden group-hover:inline">Keylink </span>Beta
            </span>
          </div>
        </nav>
      </div>
    </>
  )
}

const APP_VERSION = "0.1.0"
