import { Client } from "pg";

async function reset_db() {
  if (!process.argv.includes("--confirm")) {
    console.error(
      "❌ You must explicitly pass --confirm to reset the database.",
    );
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.PROD_DATABASE_URL,
  });

  await client.connect();

  await client.query(`
DO $$
DECLARE s text;
BEGIN
  FOR s IN
    SELECT nspname
    FROM pg_namespace
    WHERE
      nspname NOT LIKE 'pg_%'
      AND nspname <> 'information_schema'
      AND pg_get_userbyid(nspowner) = current_user
  LOOP
    EXECUTE format('DROP SCHEMA %I CASCADE', s);
  END LOOP;

  EXECUTE 'CREATE SCHEMA IF NOT EXISTS public';
END $$;
`);

  await client.end();
}

reset_db();
