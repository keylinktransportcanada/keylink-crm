"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { navItemsForRole } from "@/lib/nav"
import type { Role } from "@/lib/auth"

export function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname()
  const items = navItemsForRole(role)
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      {/* Mobile: horizontal pills above the content. The hover-expand pattern
          doesn't translate to touch, so we keep the existing scrollable bar. */}
      <nav
        aria-label="Primary"
        className={cn(
          "relative flex shrink-0 gap-1 overflow-x-auto px-3 py-2 lg:hidden",
          "border-b border-white/10 bg-brand-midnight/70 backdrop-blur-2xl backdrop-saturate-150",
          "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),0_4px_16px_-8px_rgba(10,14,26,0.45)]",
        )}
      >
        {items.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-brand-gold text-brand-navy [box-shadow:inset_0_1px_0_rgba(255,255,255,0.4),0_1px_2px_rgba(10,14,26,0.4)]"
                  : "text-brand-cloud/60 hover:bg-white/10 hover:text-brand-cloud",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Desktop: an icon rail by default that expands into a full nav on
          hover. The outer wrapper reserves a fixed 64px column in the layout;
          a sticky inner wrapper pins the rail to the viewport so the version
          footer stays visible on tall pages; the inner nav is absolutely
          positioned within it and grows wider on hover, overlaying content
          rather than pushing it. */}
      <div className="relative z-40 hidden w-16 shrink-0 lg:block">
        {/* Height = viewport minus topbar (~3.5rem) so the nav stops at the
            viewport edge and the version footer never gets clipped offscreen
            at scroll-top. dvh adapts to mobile browser chrome too. */}
        <div className="sticky top-0 relative w-16 h-[calc(100dvh-3.5rem)]">
        <nav
          aria-label="Primary"
          className={cn(
            "group absolute inset-y-0 left-0 z-40 isolate flex w-16 flex-col overflow-hidden py-4",
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
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={cn(
                  "mx-2 my-0.5 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-brand-gold text-brand-navy hover:bg-brand-gold-light [box-shadow:inset_0_1px_0_rgba(255,255,255,0.45),0_1px_2px_rgba(10,14,26,0.45)]"
                    : "text-brand-cloud/60 hover:bg-white/10 hover:text-brand-cloud",
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span
                  className={cn(
                    "opacity-0 transition-opacity duration-150",
                    "group-hover:opacity-100 group-hover:delay-100",
                  )}
                >
                  {item.label}
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
      </div>
    </>
  )
}

const APP_VERSION = "0.1.0"
