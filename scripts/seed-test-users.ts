import dbClient from "@/configs/db";
import schema from "@/db/schema";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";

type TestUserSeed = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  // exactly one of these may be set
  superAdmin?: boolean;
  committeeChairAlias?: string;
  plainMember?: boolean;
};

const TEST_USERS: TestUserSeed[] = [
  {
    email: "admin@ypfafrica.org",
    password: "Admin123!",
    firstName: "YPF",
    lastName: "Admin",
    superAdmin: true,
  },
  {
    email: "finance@ypfafrica.org",
    password: "Finance123!",
    firstName: "Felicia",
    lastName: "Finance",
    committeeChairAlias: "finance",
  },
  {
    email: "hr@ypfafrica.org",
    password: "Hr123!",
    firstName: "Henry",
    lastName: "Human",
    committeeChairAlias: "hr",
  },
  {
    email: "member@ypfafrica.org",
    password: "Member123!",
    firstName: "Mary",
    lastName: "Member",
    plainMember: true,
  },
];

async function seed(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
) {
  console.log("👤 Seeding test users...\n");
  const now = new Date();

  for (const u of TEST_USERS) {
    // Check if user already exists by email
    const existingUser = await tx.query.Users.findFirst({
      where: eq(schema.Users.email, u.email),
    });

    if (existingUser) {
      console.log(`  ↻ ${u.email} (already exists, skipping)`);
      continue;
    }

    // 1. Constituent
    const [constituent] = await tx
      .insert(schema.Constituents)
      .values({
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
      })
      .returning();

    // 2. User (auth record)
    const hashedPassword = await bcrypt.hash(u.password, 10);
    await tx.insert(schema.Users).values({
      email: u.email,
      username: u.email,
      password: hashedPassword,
      constituentId: constituent.id,
    });

    let role = "member";

    // 3. Role-specific setup
    if (u.superAdmin) {
      const [admin] = await tx
        .insert(schema.Admins)
        .values({ constituentId: constituent.id, startedAt: now })
        .returning();
      await tx.insert(schema.AdminRolesAssignments).values({
        adminId: admin.id,
        role: "SUPER_ADMIN",
        startedAt: now,
      });
      role = "SUPER_ADMIN";
    } else if (u.committeeChairAlias) {
      const committee = await tx.query.Committees.findFirst({
        where: eq(schema.Committees.alias, u.committeeChairAlias),
      });
      if (!committee) {
        throw new Error(
          `Committee with alias '${u.committeeChairAlias}' not found. Run seed-org-structure first.`,
        );
      }
      const title = await tx.query.MemberTitles.findFirst({
        where: and(
          eq(schema.MemberTitles.alias, "committeechair"),
          eq(schema.MemberTitles.committeeId, committee.id),
        ),
      });
      if (!title) {
        throw new Error(
          `committeechair title for '${u.committeeChairAlias}' not found.`,
        );
      }
      const [member] = await tx
        .insert(schema.Members)
        .values({ constituentId: constituent.id, startedAt: now })
        .returning();
      await tx.insert(schema.MemberTitlesAssignments).values({
        memberId: member.id,
        titleId: title.id,
        startedAt: now,
      });
      role = `chair of ${committee.name}`;
    } else if (u.plainMember) {
      await tx
        .insert(schema.Members)
        .values({ constituentId: constituent.id, startedAt: now });
      role = "plain member";
    }

    console.log(`  + ${u.email}  →  ${role}`);
  }

  console.log("");
  console.log("Test credentials:");
  for (const u of TEST_USERS) {
    console.log(`  ${u.email}  /  ${u.password}`);
  }
}

dbClient
  .initialize()
  .then(() => dbClient.db.transaction(seed))
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
