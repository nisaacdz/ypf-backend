-- The original version of this migration added `alias` as `NOT NULL` in a
-- single ALTER. Postgres refuses that on any non-empty `committees` table
-- because it has nothing to put in `alias` for the existing rows (no
-- default, no backfill). The CI database — and any seeded dev DB — fail
-- the entire migration with:
--   23502: column "alias" of relation "committees" contains null values
--
-- Safe three-step pattern, fully idempotent so DBs that already applied
-- the old version of this migration re-apply this rewrite as a no-op:
--   1. Add the column nullable.
--   2. Backfill from `name` (already UNIQUE NOT NULL, so derived aliases
--      are guaranteed distinct as long as names are).
--   3. Promote to NOT NULL and add the UNIQUE constraint.

ALTER TABLE "core"."committees" ADD COLUMN IF NOT EXISTS "alias" text;--> statement-breakpoint

-- Derive `alias` from `name`: lowercase, collapse any run of non-alphanumeric
-- characters into a single underscore, strip leading/trailing underscores.
-- "Institutional Committee" → "institutional_committee".
UPDATE "core"."committees"
SET "alias" = trim(both '_' from lower(regexp_replace("name", '[^a-zA-Z0-9]+', '_', 'g')))
WHERE "alias" IS NULL;--> statement-breakpoint

ALTER TABLE "core"."committees" ALTER COLUMN "alias" SET NOT NULL;--> statement-breakpoint

-- Guarded UNIQUE constraint — Postgres has no `ADD CONSTRAINT IF NOT EXISTS`
-- for table-level constraints, so wrap in a DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'committees_alias_unique'
      AND conrelid = '"core"."committees"'::regclass
  ) THEN
    ALTER TABLE "core"."committees" ADD CONSTRAINT "committees_alias_unique" UNIQUE("alias");
  END IF;
END$$;
