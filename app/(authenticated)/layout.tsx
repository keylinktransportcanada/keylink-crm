import { AppShell } from "@/components/shared/app-shell"
import { InspectionMessageToast } from "@/components/shared/inspection-message-toast"
import { RealtimeRefresher } from "@/components/shared/realtime-refresher"
import { requireRole } from "@/lib/auth"
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
  const [notifications, latestInspectionMessage] = await Promise.all([
    getNotificationsFor(profile.id, profile.role),
    getLatestInspectionMessageFor(profile.id, profile.role),
  ])
  return (
    <AppShell profile={profile} notifications={notifications}>
      <RealtimeRefresher />
      <InspectionMessageToast notice={latestInspectionMessage} />
      {children}
    </AppShell>
  )
}
