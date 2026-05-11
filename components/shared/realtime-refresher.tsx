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

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = setTimeout(() => {
        router.refresh()
      }, 300)
    }

    const channel = supabase
      .channel("keylink-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inspection_messages" },
        (payload) => {
          console.info("[realtime] inspection_messages event:", payload.eventType)
          scheduleRefresh()
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inspections" },
        (payload) => {
          console.info("[realtime] inspections event:", payload.eventType)
          scheduleRefresh()
        },
      )
      .subscribe((status, err) => {
        console.info("[realtime] subscription status:", status)
        if (err) console.error("[realtime] subscription error:", err)
      })

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
