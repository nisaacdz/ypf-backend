import pgPool from "@/configs/db";
import { sql } from "drizzle-orm";

/**
 * Applies exclusion constraints within a database transaction.
 * This function is designed to be called by pgPool.db.transaction().
 */
async function applyExclusionConstraints(
  tx: Parameters<Parameters<typeof pgPool.db.transaction>[0]>[0],
) {
  console.log("Starting application of exclusion constraints...");

  console.log("Ensuring 'btree_gist' extension exists...");
  await tx.execute(sql`CREATE EXTENSION IF NOT EXISTS btree_gist;`);
  console.log("'btree_gist' extension ensured.");

  console.log("Applying exclusion constraints sequentially...");

  console.log("Applying constraint to 'core.members'...");
  await tx.execute(sql`
    ALTER TABLE core.members
    DROP CONSTRAINT IF EXISTS no_overlapping_membership_periods;
    
    ALTER TABLE core.members
    ADD CONSTRAINT no_overlapping_membership_periods
    EXCLUDE USING gist (
      constituent_id WITH =,
      tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
    );
  `);
  console.log("✅ Successfully applied constraint to 'core.members'.");

  console.log("Applying constraint to 'core.volunteers'...");
  await tx.execute(sql`
    ALTER TABLE core.volunteers
    DROP CONSTRAINT IF EXISTS no_overlapping_volunteer_periods;
    
    ALTER TABLE core.volunteers
    ADD CONSTRAINT no_overlapping_volunteer_periods
    EXCLUDE USING gist (
      constituent_id WITH =,
      tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
    );
  `);
  console.log("✅ Successfully applied constraint to 'core.volunteers'.");

  console.log("Applying constraint to 'core.auditors'...");
  await tx.execute(sql`
    ALTER TABLE core.auditors
    DROP CONSTRAINT IF EXISTS no_overlapping_auditor_periods;
    
    ALTER TABLE core.auditors
    ADD CONSTRAINT no_overlapping_auditor_periods
    EXCLUDE USING gist (
      constituent_id WITH =,
      tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
    );
  `);
  console.log("✅ Successfully applied constraint to 'core.auditors'.");

  console.log("Applying constraint to 'core.admins'...");
  await tx.execute(sql`
    ALTER TABLE core.admins
    DROP CONSTRAINT IF EXISTS no_overlapping_admin_periods;
    
    ALTER TABLE core.admins
    ADD CONSTRAINT no_overlapping_admin_periods
    EXCLUDE USING gist (
      constituent_id WITH =,
      tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
    );
  `);
  console.log("✅ Successfully applied constraint to 'core.admins'.");

  console.log("Applying constraint to 'core.directors'...");
  await tx.execute(sql`
    ALTER TABLE core.directors
    DROP CONSTRAINT IF EXISTS no_overlapping_director_periods;
    
    ALTER TABLE core.directors
    ADD CONSTRAINT no_overlapping_director_periods
    EXCLUDE USING gist (
      constituent_id WITH =,
      tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
    );
  `);
  console.log("✅ Successfully applied constraint to 'core.directors'.");

  console.log("Applying constraint to 'core.chapter_memberships'...");
  await tx.execute(sql`
    ALTER TABLE core.chapter_memberships
    DROP CONSTRAINT IF EXISTS no_overlapping_chapter_memberships;
    
    ALTER TABLE core.chapter_memberships
    ADD CONSTRAINT no_overlapping_chapter_memberships
    EXCLUDE USING gist (
      member_id WITH =,
      chapter_id WITH =,
      tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
    );
  `);
  console.log(
    "✅ Successfully applied constraint to 'core.chapter_memberships'.",
  );

  console.log("Applying constraint to 'core.committee_memberships'...");
  await tx.execute(sql`
    ALTER TABLE core.committee_memberships
    DROP CONSTRAINT IF EXISTS no_overlapping_committee_memberships;
    
    ALTER TABLE core.committee_memberships
    ADD CONSTRAINT no_overlapping_committee_memberships
    EXCLUDE USING gist (
      member_id WITH =,
      committee_id WITH =,
      tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
    );
  `);
  console.log(
    "✅ Successfully applied constraint to 'core.committee_memberships'.",
  );

  console.log("Applying constraint to 'core.member_titles_assignments'...");
  await tx.execute(sql`
    ALTER TABLE core.member_titles_assignments
    DROP CONSTRAINT IF EXISTS no_overlapping_title_assignments;
    
    ALTER TABLE core.member_titles_assignments
    ADD CONSTRAINT no_overlapping_title_assignments
    EXCLUDE USING gist (
      member_id WITH =,
      title_id WITH =,
      tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
    );
  `);
  console.log(
    "✅ Successfully applied constraint to 'core.member_titles_assignments'.",
  );

  console.log("Applying constraint to 'core.admin_roles_assignments'...");
  await tx.execute(sql`
    ALTER TABLE core.admin_roles_assignments
    DROP CONSTRAINT IF EXISTS no_overlapping_admin_role_assignments;
    
    ALTER TABLE core.admin_roles_assignments
    ADD CONSTRAINT no_overlapping_admin_role_assignments
    EXCLUDE USING gist (
      admin_id WITH =,
      role WITH =,
      tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
    );
  `);
  console.log(
    "✅ Successfully applied constraint to 'core.admin_roles_assignments'.",
  );

  console.log("🎉 Successfully applied all exclusion constraints!");
}

pgPool
  .initialize()
  .then(() => {
    console.log("Database connection initialized.");
    console.log("Running exclusion constraint script in transaction...");
    return pgPool.db.transaction(applyExclusionConstraints);
  })
  .then(() => {
    console.log("🎉 Transaction committed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error applying exclusion constraints:", error);
    if (error instanceof Error) {
      console.error("Error message: %s", error.message);
      console.error("Stack trace: %s", error.stack);
    }
    process.exit(1);
  });
