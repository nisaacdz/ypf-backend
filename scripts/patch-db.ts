import dbClient from "@/configs/db";
import { sql } from "drizzle-orm";

/**
 * Applies manual constraints and other SQL patches within a database transaction.
 * This function is designed to be called by dbClient.db.transaction().
 */
async function applyManualConstraints(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
) {
  console.log("Starting application of manual constraints...");

  await applyExclusionConstraints(tx);

  console.log("Applying additional logical constraints...");

  // 1. Events Scope: Ensure at most one of projectId, chapterId is set
  console.log(
    "Applying constraint 'events_scope_check' to 'activities.events'...",
  );
  await tx.execute(sql`
    ALTER TABLE activities.events
    DROP CONSTRAINT IF EXISTS events_scope_check;

    ALTER TABLE activities.events
    ADD CONSTRAINT events_scope_check
    CHECK (num_nonnulls(project_id, chapter_id) <= 1);
  `);
  console.log("✅ Applied 'events_scope_check'.");

  // 3. Featured Media Limit: Trigger to ensure max 10 featured items
  console.log("Creating function 'check_featured_media_limit'...");
  await tx.execute(sql`
    CREATE OR REPLACE FUNCTION check_featured_media_limit()
    RETURNS TRIGGER AS $$
    DECLARE
      featured_count INTEGER;
      table_name TEXT;
      parent_col TEXT;
      parent_id UUID;
    BEGIN
      -- Only check if is_featured is being set to true
      IF NEW.is_featured = true THEN
        table_name := TG_TABLE_NAME;
        
        -- Determine the parent column based on the table name
        IF table_name = 'project_media' THEN
          parent_col := 'project_id';
          parent_id := NEW.project_id;
        ELSIF table_name = 'event_media' THEN
          parent_col := 'event_id';
          parent_id := NEW.event_id;

        ELSIF table_name = 'chapter_media' THEN
          parent_col := 'chapter_id';
          parent_id := NEW.chapter_id;
        ELSIF table_name = 'committee_media' THEN
          parent_col := 'committee_id';
          parent_id := NEW.committee_id;
        ELSE
          RAISE EXCEPTION 'Unknown table for featured media limit: %', table_name;
        END IF;

        -- Execute dynamic query to count existing featured items for this parent
        EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1 AND is_featured = true', TG_TABLE_SCHEMA, table_name, parent_col)
        INTO featured_count
        USING parent_id;

        IF featured_count >= 10 THEN
           RAISE EXCEPTION 'Cannot have more than 10 featured media items for this collection.';
        END IF;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  const mediaTables = [
    { schema: "activities", table: "project_media" },
    { schema: "activities", table: "event_media" },

    { schema: "core", table: "chapter_media" },
    { schema: "core", table: "committee_media" },
  ];

  for (const t of mediaTables) {
    console.log(
      `Applying trigger 'check_featured_limit' to '${t.schema}.${t.table}'...`,
    );
    await tx.execute(
      sql.raw(`
      DROP TRIGGER IF EXISTS check_featured_limit ON ${t.schema}.${t.table};
      
      CREATE TRIGGER check_featured_limit
      BEFORE INSERT OR UPDATE ON ${t.schema}.${t.table}
      FOR EACH ROW
      EXECUTE FUNCTION check_featured_media_limit();
    `),
    );
    console.log(`✅ Applied trigger to '${t.schema}.${t.table}'.`);
  }

  console.log("🎉 Successfully applied all manual constraints!");
}

async function applyExclusionConstraints(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
) {
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
}

dbClient
  .initialize()
  .then(() => {
    console.log("Database connection initialized.");
    console.log("Running manual constraint script in transaction...");
    return dbClient.db.transaction(applyManualConstraints);
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
