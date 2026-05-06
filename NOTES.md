# NOTES

Scratchpad for ideas worth picking up in later phases. Things land here when they'd
be useful but are out of the current phase's scope (per CLAUDE.md).

## Phase 2+ candidates

(none yet)

## Things confirmed during Phase 1 build

- create-next-app installed **Next.js 16.2.5** (current major as of May 2026).
  CLAUDE.md "Next.js 15" is shorthand; the spec text will be updated at the end of
  Phase 1 to reflect the actual version.
- shadcn v3 was used with the `base-nova` style and `neutral` base color (close to
  the spec's "slate"). Components use `@base-ui/react` primitives, not `@radix-ui/react-*`.
- The `form` component is no longer in the shadcn registry (v3 dropped the
  FormField helper). A minimal hand-rolled `components/ui/form.tsx` was added
  to keep the `<Form><FormField><FormItem><FormLabel>...` ergonomics.
- Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts` (export
  `proxy` instead of `middleware`). The functionality is identical. The
  Supabase helper at `lib/supabase/middleware.ts` keeps its name; the rename
  only affects the root file.
