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

This is a one-time setup per environment (dev, staging, prod). For Phase 1 you
only need a dev project.

### 1. Create a Supabase project

1. Sign in at https://supabase.com.
2. **New project** → name `keylink-crm-dev`, region **Canada Central** (closest
   to Ontario), set a strong DB password and **save it** in your password manager.
3. Wait ~2 minutes for the project to provision.

### 2. Copy credentials into `.env.local`

From **Project Settings → Data API**, copy three values into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...           # "anon public" key
SUPABASE_SERVICE_ROLE_KEY=eyJ...               # "service_role secret" key
NEXT_PUBLIC_SITE_URL=http://localhost:3000     # production: https://app.keylinktransport.ca
```

The service-role key is **server-side only**. It bypasses RLS and must never be
exposed to the browser. The repo guards against accidental import via
`server-only` in [`lib/supabase/admin.ts`](lib/supabase/admin.ts).

### 3. Apply migrations

The Phase 1 schema is in [`supabase/migrations/`](supabase/migrations/). Two ways
to apply:

**Option A — Supabase SQL Editor (no CLI needed):**

1. Open your project in Supabase Studio.
2. Go to **SQL Editor → New query**.
3. Paste the contents of `supabase/migrations/20260506120000_init_phase1.sql`.
4. Click **Run**.

**Option B — Supabase CLI (preferred for repeatable setups):**

```bash
# One-time: install the CLI as a npm devDep, or via brew install supabase/tap/supabase
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 4. Promote the first admin

The CRM has no public signup. The first admin is created by:

1. **Create the auth user.** Supabase Studio → **Authentication → Users → Add user**
   → "Create new user". Email: `Shahazeen@keylinktransport.ca`. Set a temporary
   password; we'll never use it. Confirm the email automatically (toggle on).

2. **Promote to admin.** SQL Editor → New query → paste and run:

   ```sql
   update public.profiles
      set role        = 'admin',
          full_name   = 'Shahazeen Khan',
          employee_id = coalesce(employee_id, public.next_employee_id())
    where id = (
      select id from auth.users
       where lower(email) = lower('Shahazeen@keylinktransport.ca')
    );
   ```

   This sets the role, fills in a name, and assigns an employee ID
   (`KL-0001`) if one isn't set yet. Subsequent admins are created through the
   in-app admin onboarding flow once Chunk 5 lands.

3. **Sign in.** Once Chunk 3 lands, visit `/login`. Use the password reset / magic
   link to set a real password (Supabase emails it from
   `auth@yourproject.supabase.co` by default — customize the email template under
   **Authentication → Email Templates** before going live).

### 5. Regenerate TypeScript types (optional, after schema changes)

The committed [`lib/supabase/types.ts`](lib/supabase/types.ts) is hand-rolled to
match the Phase 1 schema exactly. To regenerate from the live schema:

```bash
SUPABASE_PROJECT_ID=<your-project-ref> npm run gen-types
```

Commit the result.

## Deployment to Netlify

> **Coming in Chunk 6.** Netlify connection steps, env vars, and CNAME setup
> for `app.keylinktransport.ca` will land here.

## Phase status

Phase 1 — Foundation (in progress):

- [x] Repo bootstrap and spec docs
- [x] Project scaffold (Next.js + Tailwind + shadcn + deps)
- [x] Supabase schema, RLS, employee-id helper
- [ ] Auth flow (login + magic link + middleware)
- [ ] Role-aware shell + dashboard placeholders
- [ ] Admin employee onboarding
- [ ] Netlify deploy config

See [`CLAUDE.md` § Build phases](./CLAUDE.md#build-phases) for the full roadmap.
