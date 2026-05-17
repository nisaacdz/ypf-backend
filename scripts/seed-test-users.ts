import dbClient from "@/configs/db";
import schema from "@/db/schema";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";

type CommitteeAccountSeed = {
  alias: string;
  label: string;
  chairEmail: string;
  chairPassword: string;
  chairName: [string, string];
  memberEmail: string;
  memberPassword: string;
  memberName: [string, string];
};

type TestUserSeed = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  superAdmin?: boolean;
  committeeChairAlias?: string;
  committeeMemberAlias?: string;
  plainMember?: boolean;
};

const COMMITTEE_ACCOUNTS: CommitteeAccountSeed[] = [
  {
    alias: "executives",
    label: "Executives",
    chairEmail: "executives@ypfafrica.org",
    chairPassword: "Executives123!",
    chairName: ["Esi", "Executive"],
    memberEmail: "executives.member@ypfafrica.org",
    memberPassword: "ExecutivesMember123!",
    memberName: ["Elorm", "Executive"],
  },
  {
    alias: "management_board",
    label: "Management Board",
    chairEmail: "management@ypfafrica.org",
    chairPassword: "Management123!",
    chairName: ["Mavis", "Board"],
    memberEmail: "management.member@ypfafrica.org",
    memberPassword: "ManagementMember123!",
    memberName: ["Michael", "Board"],
  },
  {
    alias: "advisory_board",
    label: "Advisory Board",
    chairEmail: "advisory@ypfafrica.org",
    chairPassword: "Advisory123!",
    chairName: ["Ama", "Advisor"],
    memberEmail: "advisory.member@ypfafrica.org",
    memberPassword: "AdvisoryMember123!",
    memberName: ["Albert", "Advisor"],
  },
  {
    alias: "hr",
    label: "HR",
    chairEmail: "hr@ypfafrica.org",
    chairPassword: "Hr123!",
    chairName: ["Henry", "Human"],
    memberEmail: "hr.member@ypfafrica.org",
    memberPassword: "HrMember123!",
    memberName: ["Hannah", "People"],
  },
  {
    alias: "legal",
    label: "Legal",
    chairEmail: "legal@ypfafrica.org",
    chairPassword: "Legal123!",
    chairName: ["Linda", "Legal"],
    memberEmail: "legal.member@ypfafrica.org",
    memberPassword: "LegalMember123!",
    memberName: ["Leon", "Policy"],
  },
  {
    alias: "finance",
    label: "Finance",
    chairEmail: "finance@ypfafrica.org",
    chairPassword: "Finance123!",
    chairName: ["Felicia", "Finance"],
    memberEmail: "finance.member@ypfafrica.org",
    memberPassword: "FinanceMember123!",
    memberName: ["Frank", "Ledger"],
  },
  {
    alias: "welfare",
    label: "Welfare",
    chairEmail: "welfare@ypfafrica.org",
    chairPassword: "Welfare123!",
    chairName: ["Wendy", "Welfare"],
    memberEmail: "welfare.member@ypfafrica.org",
    memberPassword: "WelfareMember123!",
    memberName: ["William", "Care"],
  },
  {
    alias: "media",
    label: "Media",
    chairEmail: "media@ypfafrica.org",
    chairPassword: "Media123!",
    chairName: ["Mina", "Media"],
    memberEmail: "media.member@ypfafrica.org",
    memberPassword: "MediaMember123!",
    memberName: ["Miles", "Content"],
  },
  {
    alias: "graphics",
    label: "Graphics",
    chairEmail: "graphics@ypfafrica.org",
    chairPassword: "Graphics123!",
    chairName: ["Grace", "Graphics"],
    memberEmail: "graphics.member@ypfafrica.org",
    memberPassword: "GraphicsMember123!",
    memberName: ["Gideon", "Design"],
  },
  {
    alias: "records_mgmt",
    label: "Records Management",
    chairEmail: "records@ypfafrica.org",
    chairPassword: "Records123!",
    chairName: ["Rebecca", "Records"],
    memberEmail: "records.member@ypfafrica.org",
    memberPassword: "RecordsMember123!",
    memberName: ["Richmond", "Archive"],
  },
  {
    alias: "programs_records",
    label: "Programs & Records",
    chairEmail: "programs@ypfafrica.org",
    chairPassword: "Programs123!",
    chairName: ["Priscilla", "Programs"],
    memberEmail: "programs.member@ypfafrica.org",
    memberPassword: "ProgramsMember123!",
    memberName: ["Peter", "Records"],
  },
  {
    alias: "sponsorship",
    label: "Sponsorship",
    chairEmail: "sponsorship@ypfafrica.org",
    chairPassword: "Sponsorship123!",
    chairName: ["Sarah", "Sponsor"],
    memberEmail: "sponsorship.member@ypfafrica.org",
    memberPassword: "SponsorshipMember123!",
    memberName: ["Samuel", "Partner"],
  },
  {
    alias: "technical",
    label: "Technical",
    chairEmail: "technical@ypfafrica.org",
    chairPassword: "Technical123!",
    chairName: ["Theo", "Technical"],
    memberEmail: "technical.member@ypfafrica.org",
    memberPassword: "TechnicalMember123!",
    memberName: ["Tina", "Systems"],
  },
  {
    alias: "institutional",
    label: "Institutional",
    chairEmail: "institutional@ypfafrica.org",
    chairPassword: "Institutional123!",
    chairName: ["Irene", "Institutional"],
    memberEmail: "institutional.member@ypfafrica.org",
    memberPassword: "InstitutionalMember123!",
    memberName: ["Isaac", "Chapter"],
  },
];

const TEST_USERS: TestUserSeed[] = [
  {
    email: "admin@ypfafrica.org",
    password: "Admin123!",
    firstName: "YPF",
    lastName: "Admin",
    superAdmin: true,
  },
  ...COMMITTEE_ACCOUNTS.flatMap<TestUserSeed>((committee) => [
    {
      email: committee.chairEmail,
      password: committee.chairPassword,
      firstName: committee.chairName[0],
      lastName: committee.chairName[1],
      committeeChairAlias: committee.alias,
    },
    {
      email: committee.memberEmail,
      password: committee.memberPassword,
      firstName: committee.memberName[0],
      lastName: committee.memberName[1],
      committeeMemberAlias: committee.alias,
    },
  ]),
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
  console.log("👤 Seeding committee test users...\n");
  const now = new Date();

  for (const u of TEST_USERS) {
    const constituent = await ensureConstituent(tx, u, now);
    await ensureUser(tx, u, constituent.id);

    let role = "member";

    if (u.superAdmin) {
      await ensureSuperAdmin(tx, constituent.id, now);
      role = "SUPER_ADMIN";
    } else if (u.committeeChairAlias || u.committeeMemberAlias) {
      const committeeAlias = u.committeeChairAlias ?? u.committeeMemberAlias!;
      const titleAlias = u.committeeChairAlias
        ? "committeechair"
        : "committeemember";
      const committee = await tx.query.Committees.findFirst({
        where: eq(schema.Committees.alias, committeeAlias),
      });
      if (!committee) {
        throw new Error(
          `Committee with alias '${committeeAlias}' not found. Run seed-org-structure first.`,
        );
      }
      const title = await tx.query.MemberTitles.findFirst({
        where: and(
          eq(schema.MemberTitles.alias, titleAlias),
          eq(schema.MemberTitles.committeeId, committee.id),
        ),
      });
      if (!title) {
        throw new Error(`${titleAlias} title for '${committeeAlias}' not found.`);
      }
      const member = await ensureMember(tx, constituent.id, now);
      await ensureCommitteeMembership(tx, member.id, committee.id, now);
      await ensureTitleAssignment(tx, member.id, title.id, now);
      role = `${u.committeeChairAlias ? "chair" : "member"} of ${committee.name}`;
    } else if (u.plainMember) {
      await ensureMember(tx, constituent.id, now);
      role = "plain member";
    }

    console.log(`  ✓ ${u.email}  →  ${role}`);
  }

  console.log("");
  console.log("Test credentials:");
  for (const u of TEST_USERS) {
    console.log(`  ${u.email}  /  ${u.password}`);
  }
}

async function ensureConstituent(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
  user: TestUserSeed,
  now: Date,
) {
  const existingUser = await tx.query.Users.findFirst({
    where: eq(schema.Users.email, user.email),
  });
  if (existingUser) {
    await tx
      .update(schema.Constituents)
      .set({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      })
      .where(eq(schema.Constituents.id, existingUser.constituentId));
    return { id: existingUser.constituentId };
  }

  const existingConstituent = await tx.query.Constituents.findFirst({
    where: eq(schema.Constituents.email, user.email),
  });
  if (existingConstituent) {
    await tx
      .update(schema.Constituents)
      .set({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        updatedAt: now,
      })
      .where(eq(schema.Constituents.id, existingConstituent.id));
    return existingConstituent;
  }

  const [constituent] = await tx
    .insert(schema.Constituents)
    .values({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    })
    .returning();
  return constituent;
}

async function ensureUser(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
  user: TestUserSeed,
  constituentId: string,
) {
  const hashedPassword = await bcrypt.hash(user.password, 10);
  const existing = await tx.query.Users.findFirst({
    where: eq(schema.Users.email, user.email),
  });

  if (existing) {
    await tx
      .update(schema.Users)
      .set({
        username: user.email,
        password: hashedPassword,
        constituentId,
        updatedAt: new Date(),
      })
      .where(eq(schema.Users.id, existing.id));
    return existing.id;
  }

  const [created] = await tx
    .insert(schema.Users)
    .values({
      email: user.email,
      username: user.email,
      password: hashedPassword,
      constituentId,
    })
    .returning({ id: schema.Users.id });
  return created.id;
}

async function ensureMember(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
  constituentId: string,
  now: Date,
) {
  const existing = await tx.query.Members.findFirst({
    where: and(
      eq(schema.Members.constituentId, constituentId),
      isNull(schema.Members.endedAt),
    ),
  });
  if (existing) return existing;

  const [member] = await tx
    .insert(schema.Members)
    .values({ constituentId, startedAt: now })
    .returning();
  return member;
}

async function ensureSuperAdmin(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
  constituentId: string,
  now: Date,
) {
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

  const existingAssignment = await tx.query.AdminRolesAssignments.findFirst({
    where: and(
      eq(schema.AdminRolesAssignments.adminId, admin.id),
      eq(schema.AdminRolesAssignments.role, "SUPER_ADMIN"),
      isNull(schema.AdminRolesAssignments.endedAt),
    ),
  });
  if (!existingAssignment) {
    await tx.insert(schema.AdminRolesAssignments).values({
      adminId: admin.id,
      role: "SUPER_ADMIN",
      startedAt: now,
    });
  }
}

async function ensureCommitteeMembership(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
  memberId: string,
  committeeId: string,
  now: Date,
) {
  const existing = await tx.query.CommitteeMemberships.findFirst({
    where: and(
      eq(schema.CommitteeMemberships.memberId, memberId),
      eq(schema.CommitteeMemberships.committeeId, committeeId),
      isNull(schema.CommitteeMemberships.endedAt),
    ),
  });
  if (existing) return;

  await tx.insert(schema.CommitteeMemberships).values({
    memberId,
    committeeId,
    startedAt: now,
  });
}

async function ensureTitleAssignment(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
  memberId: string,
  titleId: string,
  now: Date,
) {
  const existing = await tx.query.MemberTitlesAssignments.findFirst({
    where: and(
      eq(schema.MemberTitlesAssignments.memberId, memberId),
      eq(schema.MemberTitlesAssignments.titleId, titleId),
      isNull(schema.MemberTitlesAssignments.endedAt),
    ),
  });
  if (existing) return;

  await tx.insert(schema.MemberTitlesAssignments).values({
    memberId,
    titleId,
    startedAt: now,
  });
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
