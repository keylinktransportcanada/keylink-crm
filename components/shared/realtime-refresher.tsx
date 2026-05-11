"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

// Subscribes to Postgres CDC on the tables that drive in-app notifications
// (inspection messages, inspection severity / corrected_at changes) and
// triggers a Next.js router refresh when a change lands. The server
// components on the current page then re-render with fresh notification +
// message data — no full page reload, no manual polling, RLS-aware.
//
// We debounce so a burst of events (e.g. an inspection being inserted with
// its first message right after) coalesces into one refresh.
export function RealtimeRefresher() {
  const router = useRouter()
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = setTimeout(() => {
        router.refresh()
      }, 300)
    }

    // Realtime channels evaluate RLS against the JWT attached to the channel,
    // not whatever cookies are in the browser. Without explicit `setAuth` the
    // server treats us as anon and silently drops events for tables with RLS.
    async function attachAuthAndSubscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return

      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      } else {
        console.warn("[realtime] no session — events will be filtered as anon")
      }

      channel = supabase
        .channel("keylink-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "inspection_messages" },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "inspections" },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "chat_messages" },
          scheduleRefresh,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "chat_thread_members" },
          scheduleRefresh,
        )
        .subscribe((status, err) => {
          // Keep the status log on subscribe — it's a once-per-page heartbeat
          // that's useful if something breaks later. Per-event logs were
          // removed because they fired on every message arrival.
          console.info("[realtime] status:", status)
          if (err) console.error("[realtime] error:", err)
        })
    }

    attachAuthAndSubscribe()

    // Keep the realtime token in sync if the session refreshes mid-page.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token)
        }
      },
    )

    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      if (channel) supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
