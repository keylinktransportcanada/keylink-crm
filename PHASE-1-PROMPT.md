# Phase 1 Prompt — Foundation

Paste this as your first message in Claude Code, after placing `CLAUDE.md` in the repo root.

---

You're building Phase 1 of the Keylink Transport CRM. Read `CLAUDE.md` in the repo root first — it has the full spec, stack, data model, and conventions. Stay inside Phase 1 scope. Do not start Phase 2 work even if it feels close.

## Confirmed decisions (do not re-ask)

- Subdomain: **`app.keylinktransport.ca`**.
- First admin email: **`Shahazeen@keylinktransport.ca`**. Use this exact string anywhere a seed/promotion script needs it.
- Magic-link fallback for forgotten passwords: **yes**, behind a "Forgot password?" link on `/login` using `signInWithOtp`. Note in the README that the magic-link email template should be customized in the Supabase dashboard before going live.
- Currency: **CAD only** in v1.
- Units: **metric** (km, kg, litres) for ops, CAD for money.
- `active=false` enforcement: two-layer — middleware checks `profiles.active` and signs out + redirects with a message; on deactivate, also call admin `updateUserById({ ban_duration: '876000h' })`. On reactivate, call `updateUserById({ ban_duration: 'none' })`.
- Employee ID: `KL-0001`, zero-padded to 4 digits, max+1 auto-suggested with admin override. Compute next ID server-side with a row lock or sequence — never on the client.
- Temp password UX: 16-char mixed, generated server-side, shown once in a dialog with a copy button and an explicit "I've copied it" confirm before close. Never stored. Log the *event* (not the password) in `audit_log`. No forced password change on first login in v1; magic link covers reset.
- Phase-1 RLS for `profiles`: admin full r/w; self can read own row + update `phone` only. Widen in later phases as needed; do NOT pre-grant.
- Tables: plain shadcn `<Table>` for the employee list in v1. TanStack Table comes in Phase 2 with the load board.

## Step 0 — Stop and instruct me through GitHub setup BEFORE any code

This project must be on GitHub from commit zero. The Netlify CRM site will deploy from GitHub on push. The operator (me) has detached the public marketing site from GitHub and uses drag-and-drop deploys for that site, but **the CRM is different** — it needs a connected git pipeline.

Before you write a single file, output a numbered checklist for me to do, and then **wait for me to confirm each step is done**. Do not assume. The checklist:

1. Open https://github.com/new in a browser. Sign in if needed.
2. Create a new **private** repository named `keylink-crm`. Do NOT initialize it with a README, .gitignore, or licence — we'll create those locally.
3. Copy the SSH or HTTPS clone URL from the "Quick setup" page. Tell me which one you want me to paste back to you (recommend SSH if I have a key set up, HTTPS otherwise).
4. Confirm the working directory: this repo lives at `~/Desktop/keylink-crm/`. If the folder doesn't exist yet, I'll create it. If `CLAUDE.md` and `PHASE-1-PROMPT.md` are sitting somewhere else (e.g. `~/Desktop/Keylink CRM solution/`), I'll move them in.
5. Once I paste the clone URL back, you will:
   - Run `git init` in the working directory.
   - Create a starter `.gitignore` (Node + Next.js + macOS).
   - Stage `CLAUDE.md`, `PHASE-1-PROMPT.md`, and `.gitignore`.
   - Make an initial commit: `chore: bootstrap repo with spec docs`.
   - Add the remote and push to `main`.
6. Verify the push succeeded by asking me to refresh the GitHub repo page and confirm the three files are visible.

Only after Step 0 is complete and I confirm the repo is live on GitHub do you proceed to the deliverables below. Each deliverable's chunk gets committed and pushed before the next chunk starts.

## Phase 1 scope

Build the foundation: auth, role-based access, admin-only employee onboarding, and a role-aware empty shell that later phases will fill in.

### Deliverables

1. **Project setup**
   - Initialize Next.js 15 with App Router, TypeScript, Tailwind, ESLint inside the existing repo (don't create a sub-folder — Next.js goes in the repo root).
   - Install and configure shadcn/ui (slate base, dark mode disabled for v1).
   - Install: `@supabase/supabase-js`, `@supabase/ssr`, `react-hook-form`, `zod`, `@hookform/resolvers`, `lucide-react`, `date-fns`.
   - Set up `.env.example` with all required Supabase keys documented.
   - Add a `README.md` with local setup steps, including how to create the Supabase project, run migrations, and promote the first admin (`Shahazeen@keylinktransport.ca`).

2. **Supabase**
   - Create migration files under `supabase/migrations/` for: `profiles` table, the `role` enum, RLS policies for `profiles`, an `audit_log` table (admin read-only, trigger-written), and a trigger that creates a `profiles` row when a new `auth.users` row is inserted.
   - Add a server-side helper that returns the next employee ID using a row lock (or a Postgres sequence) — never compute on the client.
   - Generate the TypeScript types file and commit it.
   - Do NOT create the `loads`, `customers`, `trucks`, etc. tables yet — those are later phases.

3. **Auth**
   - Email + password login at `/login`, plus a "Forgot password?" link that triggers `signInWithOtp` (magic link).
   - Supabase SSR client setup per the official `@supabase/ssr` patterns.
   - Middleware that protects every route under `(authenticated)`, checks `profiles.active`, and redirects unauthenticated/inactive users to `/login` with a flash message.
   - Logout action in the top nav.
   - A `requireRole()` server helper in `lib/auth.ts` that throws / redirects if the current user's role isn't in the allowed list.

4. **Role-aware shell**
   - `app/(authenticated)/layout.tsx` with a sidebar nav. Nav items are filtered by role (e.g. drivers don't see "Employees" or "Customers").
   - `/dashboard` route that shows different placeholder content per role:
     - admin: "Welcome back. You have N active employees." (real count from DB)
     - dispatcher: placeholder "Dispatch board coming next"
     - driver: placeholder "Your loads coming next"
     - accounting: placeholder "Invoices coming next"
   - Top bar shows the user's name, employee ID, and role.

5. **Admin: Employee onboarding** (`/admin/employees`)
   - Admin-only route (use `requireRole(['admin'])`).
   - Table (plain shadcn `<Table>`) listing all profiles: employee ID, name, role, phone, active status, created date.
   - "Add Employee" button opens a dialog form: full name, email, phone, role (dropdown), employee ID (server-suggested next `KL-XXXX`, admin can override).
   - Submitting calls a server action that uses the service role key (NEVER exposed to the client) to create the auth user with a 16-char generated temp password, sets the profile, writes an `audit_log` event, and returns the temp password to the dialog.
   - Success dialog shows the temp password with a copy button and a required "I've copied it" confirm before closing.
   - "Deactivate" toggles `active` AND calls `updateUserById({ ban_duration: '876000h' })`. "Reactivate" toggles back AND calls `updateUserById({ ban_duration: 'none' })`.
   - Edit dialog for name, phone, role, active status. Email is read-only after creation in v1.

6. **Deployment**
   - `netlify.toml` configured for Next.js with the official Netlify Next.js runtime.
   - README section documenting: how to connect the GitHub repo to a new Netlify site, how to point `app.keylinktransport.ca` at it via a CNAME, and which env vars to set in Netlify (Supabase URL, anon key, service role key).
   - Do NOT touch the public marketing site repo. Provide a snippet in the README — `<a href="https://app.keylinktransport.ca/login">Staff Login</a>` — for the operator to paste into the marketing site footer themselves.

### Acceptance criteria

- `npm run dev` boots cleanly with no console errors.
- `npm run build` passes.
- A fresh Supabase project + the migrations + `Shahazeen@keylinktransport.ca` promoted to admin gets to a working employee onboarding flow.
- A driver account created via the admin flow can log in and lands on `/dashboard` with the driver placeholder. They cannot access `/admin/employees` (server-side block, not just hidden nav).
- Deactivating an employee actually invalidates their session within the next refresh cycle.
- All forms validate with zod and show inline errors.
- Mobile layout (375px) works for `/login` and `/dashboard`.
- Every chunk is committed and pushed to GitHub.

### Working style

- **Step 0 is mandatory.** Do not write code until I confirm GitHub is connected.
- Plan first. After Step 0, before writing code, list the files you'll create/edit and the order. Wait for me to say go.
- Commit AND push after each meaningful chunk: setup, migrations, auth, shell, employee onboarding, deployment docs. Use conventional commits.
- Run `npm run build` and `npm run lint` before declaring the phase done.
- If you hit an ambiguous decision, ask. Do not silently invent product behavior.
- Do not touch Phase 2+ work. If you notice something useful for later, write it in `NOTES.md`, don't build it.

When you're ready, start with Step 0.
