import { createClient } from "@/lib/supabase/server"

// Counts direct-chat messages newer than my last_read_at, across every thread
// I'm a member of, that I didn't author myself. Used to badge the topbar
// chat icon. Returns 0 on any error — a missing chat badge is fine, a thrown
// error in a global layout is not.
export async function getChatUnreadCountFor(profileId: string): Promise<number> {
  try {
    const supabase = await createClient()

    const { data: memberships } = await supabase
      .from("chat_thread_members")
      .select("thread_id, last_read_at")
      .eq("profile_id", profileId)

    if (!memberships || memberships.length === 0) return 0

    const threadIds = memberships.map((m) => m.thread_id)
    const { data: msgs } = await supabase
      .from("chat_messages")
      .select("thread_id, author_id, created_at")
      .in("thread_id", threadIds)
      .neq("author_id", profileId)

    if (!msgs) return 0

    const readByThread = new Map(
      memberships.map((m) => [m.thread_id, m.last_read_at] as const),
    )
    let count = 0
    for (const m of msgs) {
      const lastRead = readByThread.get(m.thread_id) ?? "1970-01-01T00:00:00Z"
      if (m.created_at > lastRead) count += 1
    }
    return count
  } catch {
    return 0
  }
}
