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
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-brand-midnight px-3 py-2 lg:hidden"
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
                  ? "bg-brand-gold text-brand-navy"
                  : "text-brand-cloud/60 hover:bg-white/5 hover:text-brand-cloud",
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
          the inner nav is absolutely positioned within it and grows wider on
          hover, overlaying content rather than pushing it. */}
      <div className="relative hidden w-16 shrink-0 lg:block">
        <nav
          aria-label="Primary"
          className={cn(
            "group absolute inset-y-0 left-0 z-30 flex w-16 flex-col overflow-hidden py-4",
            "border-r border-white/10 bg-brand-midnight",
            "transition-[width] duration-200 ease-out hover:w-56",
            "hover:shadow-[8px_0_24px_-12px_rgba(0,0,0,0.55)]",
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
                title={item.label}
                className={cn(
                  "mx-2 my-0.5 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-brand-gold text-brand-navy hover:bg-brand-gold-light"
                    : "text-brand-cloud/60 hover:bg-white/5 hover:text-brand-cloud",
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
        </nav>
      </div>
    </>
  )
}
