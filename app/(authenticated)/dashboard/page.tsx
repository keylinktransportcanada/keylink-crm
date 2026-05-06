import { requireRole, type CurrentProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const profile = await requireRole([
    "admin",
    "dispatcher",
    "driver",
    "accounting",
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-sm text-muted-foreground">
          {greetingForRole(profile.role)}
        </p>
      </header>

      <div className="grid gap-4">
        {profile.role === "admin" ? <AdminPanel /> : <RolePlaceholder profile={profile} />}
      </div>
    </div>
  )
}

function greetingForRole(role: CurrentProfile["role"]) {
  switch (role) {
    case "admin":
      return "Company overview and onboarding."
    case "dispatcher":
      return "Today's loads, drivers, and trucks."
    case "driver":
      return "Your assigned loads and inspections."
    case "accounting":
      return "Invoices, A/R, and IFTA."
  }
}

async function AdminPanel() {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("active", true)

  return (
    <Card>
      <CardLabel>Active employees</CardLabel>
      <CardValue>
        {error || count === null ? "—" : count.toLocaleString()}
      </CardValue>
      <CardHelp>
        Includes you. Manage employees from the{" "}
        <a className="underline" href="/admin/employees">
          Employees
        </a>{" "}
        page.
      </CardHelp>
    </Card>
  )
}

function RolePlaceholder({ profile }: { profile: CurrentProfile }) {
  const text = {
    dispatcher: "Dispatch board coming next.",
    driver: "Your loads coming next.",
    accounting: "Invoices coming next.",
    admin: "",
  }[profile.role]

  return (
    <Card>
      <CardLabel>Coming soon</CardLabel>
      <CardValue className="text-base font-medium text-muted-foreground">
        {text}
      </CardValue>
      <CardHelp>
        This area will fill in as later phases of the CRM ship. See
        CLAUDE.md for the full roadmap.
      </CardHelp>
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
      {children}
    </div>
  )
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  )
}

function CardValue({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={className ?? "text-3xl font-semibold tracking-tight"}>
      {children}
    </span>
  )
}

function CardHelp({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
