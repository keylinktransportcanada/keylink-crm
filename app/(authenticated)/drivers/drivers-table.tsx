"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  daysBetween,
  nextExpiry,
  relativeExpiryLabel,
  SEVERITY_TONE,
  todayInToronto,
} from "@/lib/expiry"
import { cn } from "@/lib/utils"

export type DriverRow = {
  id: string
  full_name: string | null
  employee_id: string | null
  active: boolean
  phone: string | null
  licence_class: string | null
  licence_province: string | null
  licence_expiry: string | null
  medical_cert_expiry: string | null
  fast_card_expiry: string | null
  hire_date: string | null
}

export function DriversTable({ drivers }: { drivers: DriverRow[] }) {
  const router = useRouter()
  const today = todayInToronto()
  const navigateTo = (id: string) => router.push(`/drivers/${id}`)

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Driver</TableHead>
            <TableHead>Employee #</TableHead>
            <TableHead>Licence</TableHead>
            <TableHead>Hire date</TableHead>
            <TableHead>Next compliance expiry</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No drivers yet. Onboard one from <strong>Employees</strong>{" "}
                with role <em>driver</em>.
              </TableCell>
            </TableRow>
          ) : (
            drivers.map((d) => {
              const expiry = nextExpiry(today, [
                { label: "Licence", date: d.licence_expiry },
                { label: "Medical", date: d.medical_cert_expiry },
                { label: "FAST card", date: d.fast_card_expiry },
              ])
              return (
                <TableRow
                  key={d.id}
                  tabIndex={0}
                  onClick={() => navigateTo(d.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      navigateTo(d.id)
                    }
                  }}
                  className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/drivers/${d.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {d.full_name || "Unnamed"}
                    </Link>
                    {d.phone ? (
                      <div className="text-xs text-muted-foreground">
                        {d.phone}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {d.employee_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.licence_class || d.licence_province ? (
                      <span>
                        {[d.licence_class, d.licence_province]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.hire_date
                      ? format(parseISO(d.hire_date), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {expiry ? (
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={cn(
                            "inline-flex w-fit items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                            SEVERITY_TONE[expiry.severity],
                          )}
                        >
                          {expiry.label}
                          <span className="opacity-70">
                            {expiry.severity === "expired"
                              ? `expired ${relativeExpiryLabel(daysBetween(today, expiry.date))}`
                              : relativeExpiryLabel(daysBetween(today, expiry.date))}
                          </span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(parseISO(expiry.date), "MMM d, yyyy")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        no dates set
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        d.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {d.active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
