import { AppShell } from "@/components/shared/app-shell"
import { requireRole } from "@/lib/auth"

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
  return <AppShell profile={profile}>{children}</AppShell>
}
