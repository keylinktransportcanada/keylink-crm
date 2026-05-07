// Curated list of 3D avatars, sourced from Microsoft's Fluent UI Emoji
// repository (MIT licensed, free to use). Served via jsDelivr CDN.
// https://github.com/microsoft/fluentui-emoji
//
// Each entry below has been HEAD-checked against the live URL. If you add
// new entries, verify the URL returns 200 before shipping.

const BASE = "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets"

type Spec = {
  id: string
  name: string
  folder: string
  fileBase: string
  variant: "default" | "plain"
}

const SPECS: Spec[] = [
  { id: "boy", name: "Boy", folder: "Boy", fileBase: "boy", variant: "default" },
  { id: "girl", name: "Girl", folder: "Girl", fileBase: "girl", variant: "default" },
  { id: "older-person", name: "Older person", folder: "Older person", fileBase: "older_person", variant: "default" },
  { id: "person-bald", name: "Bald", folder: "Person bald", fileBase: "person_bald", variant: "default" },
  { id: "person-beard", name: "Beard", folder: "Person beard", fileBase: "person_beard", variant: "default" },
  { id: "person-blonde", name: "Blonde", folder: "Person blonde hair", fileBase: "person_blonde_hair", variant: "default" },
  { id: "person-curly", name: "Curly hair", folder: "Person curly hair", fileBase: "person_curly_hair", variant: "default" },

  { id: "astronaut", name: "Astronaut", folder: "Astronaut", fileBase: "astronaut", variant: "default" },
  { id: "construction-worker", name: "Construction worker", folder: "Construction worker", fileBase: "construction_worker", variant: "default" },
  { id: "cook", name: "Cook", folder: "Cook", fileBase: "cook", variant: "default" },
  { id: "detective", name: "Detective", folder: "Detective", fileBase: "detective", variant: "default" },
  { id: "farmer", name: "Farmer", folder: "Farmer", fileBase: "farmer", variant: "default" },
  { id: "firefighter", name: "Firefighter", folder: "Firefighter", fileBase: "firefighter", variant: "default" },
  { id: "health-worker", name: "Health worker", folder: "Health worker", fileBase: "health_worker", variant: "default" },
  { id: "judge", name: "Judge", folder: "Judge", fileBase: "judge", variant: "default" },
  { id: "mechanic", name: "Mechanic", folder: "Mechanic", fileBase: "mechanic", variant: "default" },
  { id: "office-worker", name: "Office worker", folder: "Office worker", fileBase: "office_worker", variant: "default" },
  { id: "pilot", name: "Pilot", folder: "Pilot", fileBase: "pilot", variant: "default" },
  { id: "police-officer", name: "Police officer", folder: "Police officer", fileBase: "police_officer", variant: "default" },
  { id: "scientist", name: "Scientist", folder: "Scientist", fileBase: "scientist", variant: "default" },
  { id: "singer", name: "Singer", folder: "Singer", fileBase: "singer", variant: "default" },
  { id: "teacher", name: "Teacher", folder: "Teacher", fileBase: "teacher", variant: "default" },
  { id: "technologist", name: "Technologist", folder: "Technologist", fileBase: "technologist", variant: "default" },
  { id: "artist", name: "Artist", folder: "Artist", fileBase: "artist", variant: "default" },
  { id: "student", name: "Student", folder: "Student", fileBase: "student", variant: "default" },

  { id: "ninja", name: "Ninja", folder: "Ninja", fileBase: "ninja", variant: "default" },
  { id: "princess", name: "Princess", folder: "Princess", fileBase: "princess", variant: "default" },
  { id: "prince", name: "Prince", folder: "Prince", fileBase: "prince", variant: "default" },
  { id: "person-fairy", name: "Fairy", folder: "Person fairy", fileBase: "person_fairy", variant: "default" },
  { id: "person-mage", name: "Mage", folder: "Person mage", fileBase: "person_mage", variant: "default" },
  { id: "person-vampire", name: "Vampire", folder: "Person vampire", fileBase: "person_vampire", variant: "default" },
  { id: "person-elf", name: "Elf", folder: "Person elf", fileBase: "person_elf", variant: "default" },
  { id: "person-genie", name: "Genie", folder: "Person genie", fileBase: "person_genie", variant: "plain" },

  { id: "man-dancing", name: "Dancing", folder: "Man dancing", fileBase: "man_dancing", variant: "default" },
  { id: "woman-dancing", name: "Dancing", folder: "Woman dancing", fileBase: "woman_dancing", variant: "default" },
  { id: "person-bouncing-ball", name: "Player", folder: "Person bouncing ball", fileBase: "person_bouncing_ball", variant: "default" },
]

function urlFor(spec: Spec): string {
  const folder = encodeURIComponent(spec.folder)
  if (spec.variant === "default") {
    return `${BASE}/${folder}/Default/3D/${spec.fileBase}_3d_default.png`
  }
  return `${BASE}/${folder}/3D/${spec.fileBase}_3d.png`
}

export type Avatar = { id: string; name: string; url: string }

export const AVATARS: Avatar[] = SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  url: urlFor(s),
}))

// FNV-1a 32-bit hash. Used to deterministically pick a default avatar from
// a user id so the same user always sees the same default before they
// explicitly choose one.
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

export function getDefaultAvatar(seed: string): Avatar {
  if (AVATARS.length === 0) throw new Error("No avatars configured.")
  const idx = fnv1a(seed) % AVATARS.length
  return AVATARS[idx]
}

export function getDefaultAvatarUrl(seed: string): string {
  return getDefaultAvatar(seed).url
}
