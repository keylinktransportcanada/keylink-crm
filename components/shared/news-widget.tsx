import { ExternalLink, Newspaper } from "lucide-react"

import type { NewsItem } from "@/lib/news"

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    })
  } catch {
    return `${days}d ago`
  }
}

const SOURCE_TONE: Record<string, string> = {
  "Today's Trucking": "bg-amber-100 text-amber-800",
  "Truck News": "bg-blue-100 text-blue-800",
  FreightWaves: "bg-purple-100 text-purple-800",
}

export function NewsWidget({ items }: { items: NewsItem[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
      <div className="flex items-center gap-2">
        <Newspaper className="size-4 text-brand-gold" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Industry news
        </h2>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {items.length} latest
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          News feeds are temporarily unreachable. Try again later.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item, i) => {
            const tone =
              SOURCE_TONE[item.source] ?? "bg-muted text-muted-foreground"
            return (
              <li key={`${item.link}-${i}`}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                    <span className="line-clamp-2 text-sm font-medium text-foreground group-hover:underline">
                      {item.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wider ${tone}`}
                      >
                        {item.source}
                      </span>
                      {item.publishedAt ? (
                        <span className="text-muted-foreground tabular-nums">
                          {timeAgo(item.publishedAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ExternalLink
                    aria-hidden="true"
                    className="mt-1 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-brand-gold"
                  />
                </a>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground">
        Updated hourly. Headlines open the source in a new tab.
      </p>
    </section>
  )
}
