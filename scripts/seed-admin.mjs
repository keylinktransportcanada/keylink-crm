// One-shot script to recreate the first admin after a DB reset.
// Usage: node scripts/seed-admin.mjs <email> <temp-password>
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Missing SUPABASE env vars in .env.local")
  process.exit(1)
}

const [, , email, password, fullName = "Shahazeen Khan"] = process.argv
if (!email || !password) {
  console.error("Usage: node scripts/seed-admin.mjs <email> <temp-password> [fullName]")
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})
if (error) {
  console.error("createUser failed:", error.message)
  process.exit(1)
}

const userId = data.user.id
console.log("Created auth user:", userId)

const { error: pErr } = await admin
  .from("profiles")
  .update({
    role: "admin",
    full_name: fullName,
    active: true,
  })
  .eq("id", userId)
if (pErr) {
  console.error("profile update failed:", pErr.message)
  process.exit(1)
}

console.log(`Admin ready. Sign in as ${email} with the temp password.`)
