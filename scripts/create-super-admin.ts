/**
 * One-off bootstrap: create (or promote) a SUPER_ADMIN in production.
 *
 * Reads the new admin's identity from env vars so credentials never live in
 * shell history:
 *
 *   SUPERADMIN_EMAIL       required, must be a valid email
 *   SUPERADMIN_PASSWORD    required, minimum 8 characters
 *   SUPERADMIN_FIRST_NAME  required
 *   SUPERADMIN_LAST_NAME   required
 *
 * The DB connection is read from DATABASE_URL like every other script.
 *
 * Idempotent — safe to re-run. If the user already exists, the script:
 *   1. Refreshes the constituent name to the values you passed.
 *   2. Resets the password to the value you passed.
 *   3. Promotes the user to SUPER_ADMIN if they aren't already.
 *
 * Usage from your laptop, against PRODUCTION:
 *
 *   DATABASE_URL='postgres://…?sslmode=require' \
 *   SUPERADMIN_EMAIL='you@ypfafrica.org' \
 *   SUPERADMIN_PASSWORD='ChangeMe-StrongPass-123!' \
 *   SUPERADMIN_FIRST_NAME='Gabriel' \
 *   SUPERADMIN_LAST_NAME='Quainoo' \
 *   npx tsx scripts/create-super-admin.ts
 *
 * After it prints "Done.", rotate or unset SUPERADMIN_PASSWORD from your
 * shell history (`history -d <N>` on bash/zsh).
 */

import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";

import dbClient from "@/configs/db";
import schema from "@/db/schema";

function readEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
  return value.trim();
}

const email = readEnv("SUPERADMIN_EMAIL").toLowerCase();
const password = readEnv("SUPERADMIN_PASSWORD");
const firstName = readEnv("SUPERADMIN_FIRST_NAME");
const lastName = readEnv("SUPERADMIN_LAST_NAME");

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("❌ SUPERADMIN_EMAIL is not a valid email address.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("❌ SUPERADMIN_PASSWORD must be at least 8 characters long.");
  process.exit(1);
}

async function run() {
  console.log(`👤 Provisioning SUPER_ADMIN for ${email}…`);
  const now = new Date();
  const hashedPassword = await bcrypt.hash(password, 10);

  await dbClient.db.transaction(async (tx) => {
    // ---------- 1. Constituent ----------
    let constituentId: string;
    const existingUser = await tx.query.Users.findFirst({
      where: eq(schema.Users.email, email),
    });

    if (existingUser) {
      constituentId = existingUser.constituentId;
      await tx
        .update(schema.Constituents)
        .set({ firstName, lastName, email, updatedAt: now })
        .where(eq(schema.Constituents.id, constituentId));
      console.log("  ↳ Refreshed existing constituent record.");
    } else {
      const existingByEmail = await tx.query.Constituents.findFirst({
        where: eq(schema.Constituents.email, email),
      });
      if (existingByEmail) {
        constituentId = existingByEmail.id;
        await tx
          .update(schema.Constituents)
          .set({ firstName, lastName, updatedAt: now })
          .where(eq(schema.Constituents.id, constituentId));
        console.log("  ↳ Reused existing constituent with that email.");
      } else {
        const [created] = await tx
          .insert(schema.Constituents)
          .values({ firstName, lastName, email })
          .returning({ id: schema.Constituents.id });
        constituentId = created.id;
        console.log("  ↳ Created new constituent record.");
      }
    }

    // ---------- 2. Users (auth) ----------
    if (existingUser) {
      await tx
        .update(schema.Users)
        .set({
          username: email,
          password: hashedPassword,
          updatedAt: now,
        })
        .where(eq(schema.Users.id, existingUser.id));
      console.log("  ↳ Reset password on existing user.");
    } else {
      await tx.insert(schema.Users).values({
        email,
        username: email,
        password: hashedPassword,
        constituentId,
      });
      console.log("  ↳ Created new user.");
    }

    // ---------- 3. Admin (ledger of admin periods) ----------
    const existingAdmin = await tx.query.Admins.findFirst({
      where: and(
        eq(schema.Admins.constituentId, constituentId),
        isNull(schema.Admins.endedAt),
      ),
    });
    const admin =
      existingAdmin ??
      (
        await tx
          .insert(schema.Admins)
          .values({ constituentId, startedAt: now })
          .returning()
      )[0];
    if (!existingAdmin) console.log("  ↳ Opened a new admin period.");

    // ---------- 4. SUPER_ADMIN role assignment ----------
    const existingRole = await tx.query.AdminRolesAssignments.findFirst({
      where: and(
        eq(schema.AdminRolesAssignments.adminId, admin.id),
        eq(schema.AdminRolesAssignments.role, "SUPER_ADMIN"),
        isNull(schema.AdminRolesAssignments.endedAt),
      ),
    });
    if (existingRole) {
      console.log("  ↳ SUPER_ADMIN role already assigned. Nothing to do.");
    } else {
      await tx.insert(schema.AdminRolesAssignments).values({
        adminId: admin.id,
        role: "SUPER_ADMIN",
        startedAt: now,
      });
      console.log("  ↳ Granted SUPER_ADMIN role.");
    }
  });

  console.log("\n✅ Done.");
  console.log(`   Email:    ${email}`);
  console.log(`   Password: <hidden — the one you set in SUPERADMIN_PASSWORD>`);
  console.log("");
  console.log(
    "   Sign in at the UMS login page with the email + password above.",
  );
  console.log(
    "   This account has SUPER_ADMIN role on every committee / chapter.",
  );
}

dbClient
  .initialize()
  .then(run)
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Failed:", err);
    process.exit(1);
  });
