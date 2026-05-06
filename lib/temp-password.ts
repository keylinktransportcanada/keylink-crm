import "server-only"

import { randomInt } from "node:crypto"

// Excludes ambiguous chars (0/O, 1/l/I) and characters that some terminals/
// password managers escape badly. Mix of upper, lower, digits, and a small
// punctuation set keeps strength high while staying easy to read aloud.
const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ" +
  "abcdefghijkmnpqrstuvwxyz" +
  "23456789" +
  "!@#$%^&*"

export function generateTempPassword(length = 16): string {
  if (length < 8) throw new Error("Temp password must be at least 8 characters.")
  const chars: string[] = []
  for (let i = 0; i < length; i++) {
    chars.push(ALPHABET[randomInt(ALPHABET.length)])
  }
  return chars.join("")
}
