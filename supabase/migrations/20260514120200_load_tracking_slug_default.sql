-- Give loads.tracking_slug a column-level default so the generated
-- Insert types treat it as optional. The trigger added in the prior
-- migration stays in place as a safety net for callers that explicitly
-- pass NULL or an empty string.

alter table public.loads
  alter column tracking_slug set default (
    replace(gen_random_uuid()::text, '-', '')
 || replace(gen_random_uuid()::text, '-', '')
  );
