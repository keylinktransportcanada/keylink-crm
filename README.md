# Keylink Transport CRM

Internal CRM for Keylink Transport (keylinktransport.ca) — dispatch, drivers,
documents, compliance, and accounting in one place.

This is a **separate** application from the public marketing site. It deploys to
its own subdomain (`app.keylinktransport.ca`) from this GitHub repo. The marketing
site stays untouched.

The full product spec lives in [`CLAUDE.md`](./CLAUDE.md). Read that file before
making non-trivial changes.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** + **shadcn/ui** (base-nova style)
- **Supabase** for auth, Postgres, Storage, RLS
- **react-hook-form** + **zod** for forms and validation
- **lucide-react** for icons, **date-fns** for dates, **sonner** for toasts
- Hosted on **Netlify**

## Prerequisites

- **Node.js ≥ 20.9** (Node 22 LTS or 24 LTS recommended). Check with `node -v`.
- A **Supabase account** and project — instructions below (Chunk 2 onward).

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in real values
cp .env.example .env.local
# Edit .env.local with your Supabase URL and keys (instructions in
# the "Supabase setup" section below).

# 3. Start the dev server
npm run dev
```

Dev server runs at http://localhost:3000.

## Available scripts

- `npm run dev` — Start the Next.js dev server (Turbopack).
- `npm run build` — Production build.
- `npm run start` — Run the production build locally.
- `npm run lint` — Run ESLint.

## Supabase setup

> **Coming in Chunk 2.** Migrations, RLS policies, and first-admin promotion
> instructions will land here.

## Deployment to Netlify

> **Coming in Chunk 6.** Netlify connection steps, env vars, and CNAME setup
> for `app.keylinktransport.ca` will land here.

## Phase status

Phase 1 — Foundation (in progress):

- [x] Repo bootstrap and spec docs
- [x] Project scaffold (Next.js + Tailwind + shadcn + deps)
- [ ] Supabase schema, RLS, employee-id helper
- [ ] Auth flow (login + magic link + middleware)
- [ ] Role-aware shell + dashboard placeholders
- [ ] Admin employee onboarding
- [ ] Netlify deploy config

See [`CLAUDE.md` § Build phases](./CLAUDE.md#build-phases) for the full roadmap.
