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

The CRM deploys to **`app.keylinktransport.ca`** as a separate Netlify site
(the public marketing site at keylinktransport.ca stays on its own Netlify
project — do not touch it).

### 1. Connect this repo to a new Netlify site

1. Sign in to https://app.netlify.com.
2. **Add new site → Import an existing project → GitHub**.
3. Authorize Netlify to access the `keylinktransportcanada/keylink-crm`
   repository.
4. Netlify auto-detects Next.js. Confirm:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Functions directory:** (leave blank — auto-handled)
5. Click **Deploy site**. The first build will fail because env vars aren't
   set yet — that's expected.

### 2. Set environment variables in Netlify

**Site configuration → Environment variables → Add a variable**, repeat for
each:

| Key | Value | Sensitive? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **Yes — mark as Secret** |
| `NEXT_PUBLIC_SITE_URL` | `https://app.keylinktransport.ca` | No |

After saving, **Deploys → Trigger deploy → Deploy site** to rebuild with the
env vars in place.

### 3. Point the subdomain at Netlify

1. In Netlify: **Site configuration → Domain management → Add a domain →
   `app.keylinktransport.ca`**. Netlify will show the CNAME target it
   expects (something like `<site-name>.netlify.app`).
2. In your DNS provider (whoever hosts the keylinktransport.ca zone), add a
   CNAME record:
   - **Name/Host:** `app`
   - **Type:** `CNAME`
   - **Value:** the `.netlify.app` target Netlify gave you
   - **TTL:** default (300s is fine)
3. DNS propagation usually takes 5–15 minutes. Netlify auto-provisions a
   Let's Encrypt cert once it sees the CNAME.

### 4. Update Supabase redirect URLs

Auth redirects (used by the magic-link flow) need to know about the
production URL.

1. Supabase Studio → **Authentication → URL Configuration**
2. **Site URL:** `https://app.keylinktransport.ca`
3. **Redirect URLs (additional):** add
   `https://app.keylinktransport.ca/auth/callback` (and keep
   `http://localhost:3000/auth/callback` for local dev)

### 5. Customize the magic-link email template (before going live)

Default Supabase emails are functional but not branded.

1. Supabase Studio → **Authentication → Email Templates → Magic Link**
2. Update the subject and body. Recommended subject: `Sign in to Keylink CRM`.
3. Make sure the body's `{{ .ConfirmationURL }}` placeholder is preserved.

### 6. Add a Staff Login link to the marketing site

The CRM has no public discovery — staff need a way to find it. The
marketing site stays out of this repo, so paste this snippet into its
footer (or header) yourself:

```html
<a href="https://app.keylinktransport.ca/login">Staff Login</a>
```

## Phase status

**Phase 1 — Foundation (complete):**

- [x] Repo bootstrap and spec docs
- [x] Project scaffold (Next.js 16 + Tailwind v4 + shadcn v3 + deps)
- [x] Supabase schema, RLS, audit_log, employee-id helper, types
- [x] Auth flow (password login + magic-link reset + proxy with active gate)
- [x] Role-aware shell + role-specific dashboard placeholders
- [x] Admin employee onboarding (create + edit + deactivate/reactivate)
- [x] Netlify deploy config + handoff docs

**Up next: Phase 2 — Loads & dispatch board.** See
[`CLAUDE.md` § Build phases](./CLAUDE.md#build-phases) for the full roadmap.
