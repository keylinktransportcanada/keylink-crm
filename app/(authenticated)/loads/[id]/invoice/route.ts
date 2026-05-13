// Renders a draft invoice PDF for a load. Uses @react-pdf/renderer which
// requires the Node runtime (not Edge).
import { NextResponse } from "next/server"

import { requireRole } from "@/lib/auth"
import { renderInvoicePdfForLoad } from "@/lib/invoice/render"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Anyone who can already see the load detail page can pull its invoice.
  await requireRole(["admin", "dispatcher", "accounting"])

  const { id } = await params
  const rendered = await renderInvoicePdfForLoad(id)
  if (!rendered) {
    return new NextResponse("Load not found", { status: 404 })
  }

  return new NextResponse(new Uint8Array(rendered.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${rendered.filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
