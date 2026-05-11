import { AppShell } from "@/components/shared/app-shell"
import { InspectionMessageToast } from "@/components/shared/inspection-message-toast"
import { RealtimeRefresher } from "@/components/shared/realtime-refresher"
import { requireRole } from "@/lib/auth"
import { getChatUnreadCountFor } from "@/lib/chat"
import { getNotificationsFor } from "@/lib/notifications"
import { getLatestInspectionMessageFor } from "@/lib/inspection-messages"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireRole([
    "admin",
    "dispatcher",
    "driver",
    "accounting",
  ])
  const [notifications, latestInspectionMessage, chatUnreadCount] =
    await Promise.all([
      getNotificationsFor(profile.id, profile.role),
      getLatestInspectionMessageFor(profile.id, profile.role),
      getChatUnreadCountFor(profile.id),
    ])
  return (
    <AppShell
      profile={profile}
      notifications={notifications}
      chatUnreadCount={chatUnreadCount}
    >
      <RealtimeRefresher />
      <InspectionMessageToast notice={latestInspectionMessage} />
      {children}
    </AppShell>
  )
}
