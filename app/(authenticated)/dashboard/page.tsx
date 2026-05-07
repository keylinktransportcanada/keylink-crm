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
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Eyebrow>{eyebrowForRole(profile.role)}</Eyebrow>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-4xl uppercase tracking-wide text-brand-navy lg:text-5xl">
            Welcome back
            {profile.full_name
              ? `, ${profile.full_name.split(" ")[0]}`
              : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {greetingForRole(profile.role)}
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {profile.role === "admin" ? (
          <AdminPanel />
        ) : (
          <RolePlaceholder profile={profile} />
        )}
      </div>
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="size-1.5 rounded-full bg-brand-gold" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-gold">
        {children}
      </span>
    </div>
  )
}

function eyebrowForRole(role: CurrentProfile["role"]) {
  switch (role) {
    case "admin":
      return "Company overview"
    case "dispatcher":
      return "Today's board"
    case "driver":
      return "Your day"
    case "accounting":
      return "Books"
  }
}

function greetingForRole(role: CurrentProfile["role"]) {
  switch (role) {
    case "admin":
      return "Onboarding, fleet, and a snapshot of the operation."
    case "dispatcher":
      return "Loads, drivers, and trucks at a glance."
    case "driver":
      return "Your assigned loads, inspections, and documents."
    case "accounting":
      return "Invoices, A/R aging, and IFTA prep."
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
        <a className="font-medium text-brand-teal underline-offset-4 hover:underline" href="/admin/employees">
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
      <p className="text-base font-medium text-brand-navy">{text}</p>
      <CardHelp>
        This area will fill in as later phases of the CRM ship. See CLAUDE.md
        for the full roadmap.
      </CardHelp>
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-6 shadow-[0_1px_2px_rgba(18,41,74,0.04),0_8px_24px_-12px_rgba(18,41,74,0.12)]">
      {children}
    </div>
  )
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-1.5 rounded-full bg-brand-gold" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-slate">
        {children}
      </span>
    </div>
  )
}

function CardValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-5xl tracking-wide text-brand-navy">
      {children}
    </span>
  )
}

function CardHelp({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
