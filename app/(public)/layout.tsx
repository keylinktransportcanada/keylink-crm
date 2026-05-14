import Image from "next/image"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen flex-1 grid-cols-1 lg:grid-cols-[1.15fr_1fr] bg-brand-midnight text-brand-cloud">
      <BrandPanel />
      <main className="relative flex items-center justify-center bg-brand-dark-card px-6 py-12 sm:px-10 lg:px-14">
        {/* Soft teal glow tucked behind the form for warmth. */}
        <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(34,160,146,0.10)_0%,transparent_55%)]" />
        <div className="relative z-10 w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
      {/* Full-bleed hero photo. */}
      <Image
        src="/login-hero.png"
        alt="A Keylink Transport operator reviewing a shipment on a mobile device"
        fill
        priority
        sizes="(min-width: 1024px) 60vw, 100vw"
        className="object-cover object-center"
      />

      {/* Layered scrims:
          1. Subtle navy tint over the whole image for cohesion with the brand.
          2. Bottom-up gradient that anchors the headline.
          3. Right-edge fade so the photo melts cleanly into the dark form panel. */}
      <div className="pointer-events-none absolute inset-0 bg-brand-midnight/25" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-midnight via-brand-midnight/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-r from-transparent to-brand-dark-card" />
      {/* Thin gold accent rule along the bottom edge. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent" />

      {/* Foreground content. */}
      <div className="relative z-10 flex items-center gap-3 p-10 xl:p-14">
        <Image
          src="/logo-keylink.png"
          alt="Keylink Transport"
          width={180}
          height={48}
          priority
          className="h-10 w-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]"
        />
      </div>

      <div className="relative z-10 flex flex-col gap-6 p-10 xl:p-14">
        <div className="flex items-center gap-3">
          <span className="size-2 rounded-full bg-brand-gold shadow-[0_0_12px_rgba(240,168,32,0.7)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-gold">
            Keylink ERP Systems
          </span>
        </div>
        <h2 className="font-display text-5xl uppercase leading-[1.05] text-brand-cloud xl:text-6xl">
          The link
          <br />
          between
          <br />
          <span className="text-brand-teal-light">businesses.</span>
        </h2>
        <p className="max-w-md text-base leading-relaxed text-brand-cloud/80">
          One platform for our crew and our customers. Dispatch, drivers, and
          accounting run the floor. Shippers and consignees follow every
          shipment from pickup to proof of delivery.
        </p>
        <p className="text-xs uppercase tracking-[0.22em] text-brand-cloud/50">
          Keylink Transport · Canada to US Cross-Border Logistics
        </p>
      </div>
    </aside>
  )
}
