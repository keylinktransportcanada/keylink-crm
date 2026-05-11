"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import {
  Building2,
  Container,
  CornerDownLeft,
  LayoutDashboard,
  Loader2,
  Package,
  PackagePlus,
  Search,
  Truck as TruckIcon,
  UserCog,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  searchEntitiesAction,
  type SearchResults,
} from "@/app/(authenticated)/search/actions"

const EMPTY_RESULTS: SearchResults = {
  loads: [],
  customers: [],
  people: [],
  trucks: [],
  trailers: [],
}

type QuickAction = {
  id: string
  label: string
  hint?: string
  href: string
  icon: typeof LayoutDashboard
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "qa-dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "qa-loads", label: "Loads", href: "/loads", icon: Package },
  { id: "qa-new-load", label: "New load", hint: "Create", href: "/loads/new", icon: PackagePlus },
  { id: "qa-customers", label: "Customers", href: "/customers", icon: Building2 },
  { id: "qa-trucks", label: "Trucks", href: "/trucks", icon: TruckIcon },
  { id: "qa-trailers", label: "Trailers", href: "/trailers", icon: Container },
  { id: "qa-employees", label: "Employees", hint: "Admin", href: "/admin/employees", icon: UserCog },
]

type Item = {
  key: string
  label: string
  sublabel?: string
  href: string
  icon: typeof LayoutDashboard
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const reqIdRef = useRef(0)

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        // Reset on close so the next open starts fresh. Doing this here
        // (instead of in an effect) keeps cascading renders out of the lint
        // bin and out of React's reconciliation hot path.
        setQuery("")
        setResults(EMPTY_RESULTS)
        setActiveIndex(0)
        setLoading(false)
      }
      onOpenChange(next)
    },
    [onOpenChange],
  )

  // Focus the input on open. Side effect only — no setState in here.
  useEffect(() => {
    if (open) {
      // Next frame so base-ui's portal has mounted.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Debounced server search. Loading flips inside the timeout callback so
  // the lint rule against synchronous setState in effects is satisfied; the
  // tradeoff is that the spinner only shows during the actual network fetch,
  // not during the 180ms debounce window — fine in practice.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return
    const myReq = ++reqIdRef.current
    const handle = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchEntitiesAction(trimmed)
        if (myReq !== reqIdRef.current) return
        setResults(data)
      } finally {
        if (myReq === reqIdRef.current) setLoading(false)
      }
    }, 180)
    return () => clearTimeout(handle)
  }, [query])

  const isQueryActive = query.trim().length >= 2
  const displayResults = isQueryActive ? results : EMPTY_RESULTS
  const isLoading = isQueryActive && loading

  // Flat list of items in render order, used for keyboard navigation. The
  // groups below render the same items but read activeIndex per-item.
  const items: Item[] = useMemo(() => {
    const arr: Item[] = []
    if (!isQueryActive) {
      for (const a of QUICK_ACTIONS) {
        arr.push({ key: a.id, label: a.label, sublabel: a.hint, href: a.href, icon: a.icon })
      }
      return arr
    }
    for (const l of displayResults.loads) {
      const route = [
        l.origin_city,
        l.origin_province,
      ]
        .filter(Boolean)
        .join(", ")
      const dest = [l.destination_city, l.destination_province]
        .filter(Boolean)
        .join(", ")
      arr.push({
        key: `load-${l.id}`,
        label: l.load_number,
        sublabel: [
          l.customer_name,
          route && dest ? `${route} → ${dest}` : route || dest || null,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/loads/${l.id}`,
        icon: Package,
      })
    }
    for (const c of displayResults.customers) {
      arr.push({
        key: `cust-${c.id}`,
        label: c.name,
        sublabel: c.contact_name ?? undefined,
        href: `/customers`,
        icon: Building2,
      })
    }
    for (const p of displayResults.people) {
      arr.push({
        key: `prof-${p.id}`,
        label: p.full_name ?? "(no name)",
        sublabel: [p.role, p.employee_id].filter(Boolean).join(" · "),
        href: `/admin/employees`,
        icon: p.role === "driver" ? Users : UserCog,
      })
    }
    for (const t of displayResults.trucks) {
      arr.push({
        key: `truck-${t.id}`,
        label: t.truck_number,
        sublabel: [t.make, t.model].filter(Boolean).join(" ") || t.status,
        href: `/trucks`,
        icon: TruckIcon,
      })
    }
    for (const t of displayResults.trailers) {
      arr.push({
        key: `trl-${t.id}`,
        label: t.trailer_number,
        sublabel: t.type ?? t.status,
        href: `/trailers`,
        icon: Container,
      })
    }
    return arr
  }, [isQueryActive, displayResults])

  // Clamp on read so we never select past the end of the list when results
  // shrink. Cheaper and lint-friendlier than mirroring with another effect.
  const safeActiveIndex = Math.min(
    activeIndex,
    Math.max(0, items.length - 1),
  )

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false)
      router.push(href)
    },
    [onOpenChange, router],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      const target = items[safeActiveIndex]
      if (target) {
        e.preventDefault()
        navigate(target.href)
      }
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-[60] bg-black/40 supports-backdrop-filter:backdrop-blur-sm",
            "duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-[18%] z-[60] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2",
            "flex flex-col overflow-hidden rounded-2xl text-brand-cloud outline-none",
            "border border-white/10 bg-brand-midnight/85 backdrop-blur-2xl backdrop-saturate-150",
            "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.12),0_32px_64px_-16px_rgba(10,14,26,0.65),0_8px_24px_-8px_rgba(10,14,26,0.45)]",
            "duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,160,146,0.18)_0%,transparent_70%)]"
          />

          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
            {isLoading ? (
              <Loader2
                aria-hidden="true"
                className="size-4 shrink-0 animate-spin text-brand-cloud/60"
              />
            ) : (
              <Search
                aria-hidden="true"
                className="size-4 shrink-0 text-brand-cloud/55"
              />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="Search loads, customers, drivers, trucks…"
              className={cn(
                "h-7 flex-1 border-none bg-transparent text-sm text-brand-cloud outline-none",
                "placeholder:text-brand-cloud/45",
              )}
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-brand-cloud/55 sm:inline-block">
              Esc
            </kbd>
          </div>

          <div className="max-h-[50vh] overflow-y-auto py-1.5">
            {!isQueryActive ? (
              <Section
                label="Quick actions"
                items={items}
                activeIndex={safeActiveIndex}
                offset={0}
                onPick={navigate}
                onHover={(i) => setActiveIndex(i)}
              />
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-brand-cloud/55">
                {isLoading ? "Searching…" : "No matches."}
              </p>
            ) : (
              <Groups
                results={displayResults}
                items={items}
                activeIndex={safeActiveIndex}
                onPick={navigate}
                onHover={(i) => setActiveIndex(i)}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-4 py-2 text-[10px] uppercase tracking-wider text-brand-cloud/45">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>
                <CornerDownLeft className="size-2.5" />
              </Kbd>
              open
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              close
            </span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Groups({
  results,
  items,
  activeIndex,
  onPick,
  onHover,
}: {
  results: SearchResults
  items: Item[]
  activeIndex: number
  onPick: (href: string) => void
  onHover: (i: number) => void
}) {
  const groups = [
    { label: "Loads", count: results.loads.length },
    { label: "Customers", count: results.customers.length },
    { label: "People", count: results.people.length },
    { label: "Trucks", count: results.trucks.length },
    { label: "Trailers", count: results.trailers.length },
  ] as const

  // Pre-compute group start offsets so each Section knows where its block of
  // items begins inside the flat list. No render-time mutation.
  const offsets = groups.reduce<number[]>(
    (acc, g, i) => [...acc, i === 0 ? 0 : acc[i - 1] + groups[i - 1].count],
    [],
  )

  return (
    <>
      {groups.map((g, i) => {
        if (g.count === 0) return null
        const slice = items.slice(offsets[i], offsets[i] + g.count)
        return (
          <Section
            key={g.label}
            label={g.label}
            items={slice}
            activeIndex={activeIndex}
            offset={offsets[i]}
            onPick={onPick}
            onHover={onHover}
          />
        )
      })}
    </>
  )
}

function Section({
  label,
  items,
  activeIndex,
  offset,
  onPick,
  onHover,
}: {
  label: string
  items: Item[]
  activeIndex: number
  offset: number
  onPick: (href: string) => void
  onHover: (i: number) => void
}) {
  return (
    <div className="flex flex-col">
      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-cloud/45">
        {label}
      </div>
      <ul className="flex flex-col">
        {items.map((it, i) => {
          const idx = offset + i
          const Icon = it.icon
          const active = activeIndex === idx
          return (
            <li key={it.key}>
              <button
                type="button"
                onMouseEnter={() => onHover(idx)}
                onClick={() => onPick(it.href)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                  active
                    ? "bg-white/10 text-brand-cloud"
                    : "text-brand-cloud/85 hover:bg-white/5",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-brand-gold" : "text-brand-cloud/55",
                  )}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {it.label}
                  </span>
                  {it.sublabel ? (
                    <span className="truncate text-xs text-brand-cloud/55">
                      {it.sublabel}
                    </span>
                  ) : null}
                </div>
                {active ? (
                  <CornerDownLeft
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-brand-cloud/55"
                  />
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-white/15 bg-white/[0.06] px-1 text-[10px] font-medium text-brand-cloud/65">
      {children}
    </kbd>
  )
}
