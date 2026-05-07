import { AppSidebar } from "./app-sidebar"
import { AppTopbar } from "./app-topbar"
import type { CurrentProfile } from "@/lib/auth"
import type { Notification } from "@/lib/notifications"

export function AppShell({
  profile,
  notifications,
  children,
}: {
  profile: CurrentProfile
  notifications: Notification[]
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-brand-midnight">
      <AppTopbar profile={profile} notifications={notifications} />
      <div className="flex flex-1 flex-col lg:flex-row">
        <AppSidebar role={profile.role} />
        <main className="flex flex-1 flex-col bg-[#f4f6fa] p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
