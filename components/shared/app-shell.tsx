import { AppSidebar } from "./app-sidebar"
import { AppTopbar } from "./app-topbar"
import type { CurrentProfile } from "@/lib/auth"

export function AppShell({
  profile,
  children,
}: {
  profile: CurrentProfile
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-brand-midnight">
      <AppTopbar profile={profile} />
      <div className="flex flex-1 flex-col lg:flex-row">
        <AppSidebar role={profile.role} />
        <main className="flex flex-1 flex-col bg-background p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
