import { AppShell } from "@/components/shared/app-shell"
import { requireRole } from "@/lib/auth"
import { getNotificationsFor } from "@/lib/notifications"

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
  const notifications = await getNotificationsFor(profile.id, profile.role)
  return (
    <AppShell profile={profile} notifications={notifications}>
      {children}
    </AppShell>
  )
}
