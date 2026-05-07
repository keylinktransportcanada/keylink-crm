import Image from "next/image"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen flex-1 grid-cols-1 lg:grid-cols-[1.1fr_1fr] bg-brand-midnight text-brand-cloud">
      <BrandPanel />
      <main className="flex items-center justify-center bg-brand-dark-card px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}

function BrandPanel() {
  return (
    <aside
      aria-hidden="true"
      className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-16"
    >
      {/* Teal radial wash — borrowed from the marketing site hero. */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_50%,rgba(26,123,110,0.22)_0%,transparent_60%)]" />
      {/* Thin gold underline accent at the bottom edge. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent" />

      <div className="flex items-center gap-3">
        <Image
          src="/logo-keylink.png"
          alt="Keylink Transport"
          width={180}
          height={48}
          priority
          className="h-10 w-auto"
        />
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="size-2 rounded-full bg-brand-gold" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">
            Internal CRM
          </span>
        </div>
        <h2 className="font-display text-5xl uppercase leading-[1.05] xl:text-6xl">
          Dispatch.
          <br />
          Deliver.
          <br />
          <span className="text-brand-teal-light">Keylink.</span>
        </h2>
        <p className="max-w-md text-base leading-relaxed text-brand-cloud/70">
          The dispatch, driver, and operations cockpit for Keylink Transport —
          loads, compliance, documents, and accounting in one place.
        </p>
      </div>

      <p className="text-xs uppercase tracking-[0.2em] text-brand-cloud/40">
        Keylink Transport · Canada — US Cross-Border Logistics
      </p>
    </aside>
  )
}
