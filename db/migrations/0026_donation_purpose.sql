-- What a donation is for when it isn't tied to a project: a cause code such
-- as 'EDUCATION' (see shared/utils/donationPurposes.ts). Project gifts keep
-- using donations.project_id. NULL on both = "where it's needed most".
-- Nullable so every existing donation stays a general gift.
-- IF NOT EXISTS for consistency with 0023/0024 and databases built via push.
ALTER TABLE "finance"."donations" ADD COLUMN IF NOT EXISTS "purpose" text;
