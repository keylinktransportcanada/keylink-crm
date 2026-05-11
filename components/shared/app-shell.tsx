import { AppSidebar } from "./app-sidebar"
import { AppTopbar } from "./app-topbar"
import type { CurrentProfile } from "@/lib/auth"
import type { Notification } from "@/lib/notifications"

export function AppShell({
  profile,
  notifications,
  chatUnreadCount = 0,
  children,
}: {
  profile: CurrentProfile
  notifications: Notification[]
  chatUnreadCount?: number
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-brand-midnight">
      <AppTopbar
        profile={profile}
        notifications={notifications}
        chatUnreadCount={chatUnreadCount}
      />
      <div className="flex flex-1 flex-col lg:flex-row">
        <AppSidebar
          role={profile.role}
          inspectionAlertCount={
            // Only count *unresolved* OOS inspection items — exclude thread
            // messages (`inspection-message:`) and corrected sign-offs
            // (`inspection-corrected:`) which both share the same kind.
            notifications.filter(
              (n) =>
                n.kind === "inspection" &&
                !n.id.startsWith("inspection-message:") &&
                !n.id.startsWith("inspection-corrected:"),
            ).length
          }
        />
        <main className="flex flex-1 flex-col bg-[#f4f6fa] p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
