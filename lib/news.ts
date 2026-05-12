import "server-only"

// Lightweight RSS 2.0 fetcher and parser for the dashboard news widget.
// Skips a dependency by extracting <item> blocks with regex — fine for
// the standard WordPress / news-CMS feeds we target. If a source switches
// to Atom or breaks, we silently drop it from the merged list rather than
// fail the whole widget.

export type NewsItem = {
  title: string
  link: string
  source: string
  publishedAt: string | null // ISO if we could parse it
}

type Source = {
  name: string
  url: string
}

// Curated Canadian trucking + cross-border freight news feeds. Starting with
// three reliable ones; we can add more if the user wants broader coverage.
const SOURCES: Source[] = [
  { name: "Today's Trucking", url: "https://www.todaystrucking.com/feed/" },
  { name: "Truck News", url: "https://www.trucknews.com/feed/" },
  { name: "FreightWaves", url: "https://www.freightwaves.com/news/feed" },
]

const ITEMS_PER_SOURCE = 6
const TOTAL_LIMIT = 10
const CACHE_TTL_SECONDS = 3600 // 1 hour

function stripCdata(value: string): string {
  // Some feeds wrap title/description in CDATA, some don't. Unwrap if present
  // and trim whitespace either way.
  const cdata = value.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return (cdata ? cdata[1] : value).trim()
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function extractTag(itemXml: string, tag: string): string | null {
  // Tolerates attributes on the tag (`<title type="text">…</title>`) and
  // optional CDATA wrappers.
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
    "i",
  )
  const match = itemXml.match(re)
  if (!match) return null
  return decodeEntities(stripCdata(match[1]))
}

function parseRssItems(xml: string, source: string): NewsItem[] {
  const out: NewsItem[] = []
  const itemRegex = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    if (out.length >= ITEMS_PER_SOURCE) break
    const body = match[1]
    const title = extractTag(body, "title")
    const link = extractTag(body, "link")
    const pubDate = extractTag(body, "pubDate")
    if (!title || !link) continue
    let publishedAt: string | null = null
    if (pubDate) {
      const parsed = new Date(pubDate)
      if (!Number.isNaN(parsed.getTime())) {
        publishedAt = parsed.toISOString()
      }
    }
    out.push({ title, link, source, publishedAt })
  }
  return out
}

async function fetchSource(source: Source): Promise<NewsItem[]> {
  try {
    const res = await fetch(source.url, {
      // Hourly cache shared across all users of the deployed instance.
      next: { revalidate: CACHE_TTL_SECONDS },
      headers: {
        // Some feed servers 403 if user-agent looks empty or scriptish.
        "User-Agent":
          "KeylinkCRM/1.0 (industry news widget; +https://keylinktransport.ca)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRssItems(xml, source.name)
  } catch {
    // Network error / parse error — return empty so the widget keeps
    // showing the other feeds rather than breaking the dashboard.
    return []
  }
}

export async function getIndustryNews(): Promise<NewsItem[]> {
  const results = await Promise.all(SOURCES.map(fetchSource))
  const merged = results.flat()

  // Sort newest first. Items without a parseable date sort to the end.
  merged.sort((a, b) => {
    if (a.publishedAt && b.publishedAt) {
      return b.publishedAt.localeCompare(a.publishedAt)
    }
    if (a.publishedAt) return -1
    if (b.publishedAt) return 1
    return 0
  })

  return merged.slice(0, TOTAL_LIMIT)
}
