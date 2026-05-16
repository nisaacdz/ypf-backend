/**
 * seed-demo-data.ts
 *
 * Layers realistic demo data on top of the canonical org-structure seed
 * (`seed-org-structure.ts`) and the test-user seed (`seed-test-users.ts`).
 * Adds:
 *   - 7 Ghana chapters
 *   - ~25 additional constituents (faker-generated)
 *   - Members + chapter memberships + committee memberships
 *   - 5 organizations + 3 partnerships
 *   - 6 projects + 8 events
 *   - 12 donations (with financial_transactions)
 *   - 1 dues period + a few payments
 *   - 4 announcements routed to all members via constituent_announcements
 *
 * Idempotency: bails if `core.chapters` already has rows. Re-run after
 * `npm run script reset-db && drizzle-kit migrate && seed-org-structure
 * && seed-test-users` for a clean start.
 */

import { faker } from "@faker-js/faker"
import bcrypt from "bcryptjs"
import { sql } from "drizzle-orm"
import dbClient from "@/configs/db"
import schema from "@/db/schema"

faker.seed(8675309) // deterministic demo

const CHAPTER_SEEDS = [
  { name: "KNUST Chapter", country: "Ghana" },
  { name: "University of Ghana Chapter", country: "Ghana" },
  { name: "University of Cape Coast Chapter", country: "Ghana" },
  { name: "University of Education Winneba Chapter", country: "Ghana" },
  { name: "Ashesi University Chapter", country: "Ghana" },
  { name: "University of Energy and Natural Resources Chapter", country: "Ghana" },
  { name: "University of Mines and Technology Chapter", country: "Ghana" },
] as const

const PROJECT_SEEDS = [
  {
    title: "Computers for Rural Schools",
    type: "WELFARE" as const,
    category: "Education",
    description:
      "Distribute refurbished laptops to under-resourced primary schools.",
  },
  {
    title: "Mental Health First Aid Workshops",
    type: "WELFARE" as const,
    category: "Health",
    description: "Three-day MHFA training for youth leaders across chapters.",
  },
  {
    title: "Tech Hubs for Refugee Communities",
    type: "COMMUNITY" as const,
    category: "Technology",
    description:
      "Set up coworking nodes with internet and training in three refugee settlements.",
  },
  {
    title: "Voter Registration Drives",
    type: "ADVOCACY" as const,
    category: "Civic",
    description: "Door-to-door registration campaigns in 6 districts.",
  },
  {
    title: "Period Dignity Initiative",
    type: "WELFARE" as const,
    category: "Health",
    description:
      "Quarterly distribution of sanitary products to junior high girls.",
  },
  {
    title: "Youth Climate Leaders Program",
    type: "COMMUNITY" as const,
    category: "Environment",
    description: "Six-month leadership track focused on climate action.",
  },
]

const EVENT_TYPES = ["MENTORSHIP", "WORKSHOP", "NETWORKING", "STREETCARE", "CHILDCARE"] as const
const PROJECT_STATUSES = ["UPCOMING", "ONGOING", "COMPLETED"] as const

const ORG_SEEDS = [
  { name: "MTN Foundation Ghana", website: "https://mtn.com.gh" },
  { name: "Ecobank Africa", website: "https://ecobank.com" },
  { name: "African Development Bank", website: "https://afdb.org" },
  { name: "Vodafone Ghana", website: "https://vodafone.com.gh" },
  { name: "Stanbic Bank Ghana", website: "https://stanbicbank.com.gh" },
]

const ANNOUNCEMENT_SEEDS = [
  {
    title: "Welcome to the 2026 Membership Year",
    content:
      "We're thrilled to kick off another year of impact. Dues for the new period are now open. Reach out to your chapter lead with any questions.",
  },
  {
    title: "Q1 All-Chapters Town Hall",
    content:
      "Save the date — our quarterly town hall lands on the last Friday of February. Agenda items: budget transparency, programs roadmap, and chapter spotlights.",
  },
  {
    title: "Open Call for Welfare Project Proposals",
    content:
      "The Welfare Committee is accepting community impact proposals through end of March. Submit via the portal or email welfare@ypfafrica.org.",
  },
  {
    title: "New Member Onboarding Cohort #4",
    content:
      "Our next onboarding cohort begins April 1st. HR will reach out to all newly approved members with credentials and the orientation schedule.",
  },
]

async function seed(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
) {
  // Idempotency gate
  const existingChapters = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.Chapters)
  if (existingChapters[0].count > 0) {
    console.log(
      "⚠  Chapters already exist — bailing to avoid duplicating data.\n" +
        "    Run `npm run script reset-db && npx drizzle-kit migrate && \\\n" +
        "         npm run script seed-org-structure && \\\n" +
        "         npm run script seed-test-users && \\\n" +
        "         npm run script seed-demo-data` for a clean restart.",
    )
    return
  }

  const now = new Date()
  const yearAgo = new Date(now.getFullYear() - 1, 0, 1)

  // ────────────────────────────────────────────────────────────────────
  // 1. Chapters
  // ────────────────────────────────────────────────────────────────────
  console.log("🏛  Chapters...")
  const chapters = await tx
    .insert(schema.Chapters)
    .values(
      CHAPTER_SEEDS.map((c) => ({
        name: c.name,
        country: c.country,
        foundingDate: yearAgo,
        description: `Active chapter at ${c.name.replace(" Chapter", "")}.`,
      })),
    )
    .returning()
  console.log(`   + ${chapters.length} chapters`)

  // ────────────────────────────────────────────────────────────────────
  // 2. Additional constituents + users + members
  // ────────────────────────────────────────────────────────────────────
  console.log("👥 Constituents + users + members...")
  const NEW_PEOPLE = 25
  const newConstituentsData = Array.from({ length: NEW_PEOPLE }, () => {
    const first = faker.person.firstName()
    const last = faker.person.lastName()
    return {
      firstName: first,
      lastName: last,
      email: faker.internet.email({ firstName: first, lastName: last }).toLowerCase(),
      phone: faker.phone.number(),
      gender: faker.helpers.arrayElement(schema.GenderEnum.enumValues),
      dateOfBirth: faker.date.birthdate({ min: 19, max: 38, mode: "age" }),
      country: "Ghana",
      city: faker.location.city(),
      occupation: faker.person.jobTitle(),
    }
  })
  const newConstituents = await tx
    .insert(schema.Constituents)
    .values(newConstituentsData)
    .returning()

  // Plain auth users with a known password
  const password = await bcrypt.hash("Demo123!", 10)
  await tx.insert(schema.Users).values(
    newConstituents.map((c) => ({
      email: c.email!,
      username: c.email!,
      password,
      constituentId: c.id,
    })),
  )

  // Active membership period for everyone
  const newMembers = await tx
    .insert(schema.Members)
    .values(
      newConstituents.map((c) => ({
        constituentId: c.id,
        startedAt: faker.date.between({
          from: new Date(now.getFullYear() - 2, 0, 1),
          to: now,
        }),
      })),
    )
    .returning()
  console.log(`   + ${newConstituents.length} people / users / members`)

  // ────────────────────────────────────────────────────────────────────
  // 3. Chapter memberships
  // ────────────────────────────────────────────────────────────────────
  console.log("🎓 Chapter memberships...")
  const chapterMemberships = newMembers.map((m) => ({
    memberId: m.id,
    chapterId: faker.helpers.arrayElement(chapters).id,
    startedAt: m.startedAt,
  }))
  await tx.insert(schema.ChapterMemberships).values(chapterMemberships)
  console.log(`   + ${chapterMemberships.length} chapter memberships`)

  // ────────────────────────────────────────────────────────────────────
  // 4. Committee memberships (assign members as committee members)
  // ────────────────────────────────────────────────────────────────────
  console.log("📋 Committee memberships...")
  const allCommittees = await tx.query.Committees.findMany()
  const memberTitles = await tx.query.MemberTitles.findMany()
  const memberTitleByCommitteeId = new Map(
    memberTitles
      .filter((t) => t.alias === "committeemember" && t.committeeId)
      .map((t) => [t.committeeId!, t.id]),
  )

  let titleAssignmentCount = 0
  let committeeMembershipCount = 0
  // Each new member: 0-2 committees
  for (const member of newMembers) {
    const k = faker.number.int({ min: 0, max: 2 })
    const picks = faker.helpers.arrayElements(allCommittees, k)
    for (const c of picks) {
      await tx.insert(schema.CommitteeMemberships).values({
        memberId: member.id,
        committeeId: c.id,
        startedAt: member.startedAt,
      })
      committeeMembershipCount++

      const titleId = memberTitleByCommitteeId.get(c.id)
      if (titleId) {
        await tx.insert(schema.MemberTitlesAssignments).values({
          memberId: member.id,
          titleId,
          startedAt: member.startedAt,
        })
        titleAssignmentCount++
      }
    }
  }
  console.log(
    `   + ${committeeMembershipCount} committee memberships, ${titleAssignmentCount} title assignments`,
  )

  // ────────────────────────────────────────────────────────────────────
  // 5. Organizations + Partnerships
  // ────────────────────────────────────────────────────────────────────
  console.log("🤝 Organizations + partnerships...")
  const orgs = await tx
    .insert(schema.Organizations)
    .values(
      ORG_SEEDS.map((o) => ({
        name: o.name,
        website: o.website,
        description: `${o.name} — Long-time supporter of YPF Africa's programs.`,
        isActive: true,
      })),
    )
    .returning()

  // ────────────────────────────────────────────────────────────────────
  // 6. Projects
  // ────────────────────────────────────────────────────────────────────
  console.log("📚 Projects...")
  const projects = await tx
    .insert(schema.Projects)
    .values(
      PROJECT_SEEDS.map((p) => {
        const start = faker.date.between({
          from: new Date(now.getFullYear() - 1, 0, 1),
          to: new Date(now.getFullYear(), 11, 31),
        })
        const end = new Date(start)
        end.setMonth(end.getMonth() + faker.number.int({ min: 1, max: 6 }))
        return {
          title: p.title,
          abstract: p.description,
          description: p.description,
          type: p.type,
          category: p.category,
          scheduledStart: start,
          scheduledEnd: end,
          status: faker.helpers.arrayElement(PROJECT_STATUSES),
          chapterId: faker.helpers.maybe(
            () => faker.helpers.arrayElement(chapters).id,
            { probability: 0.6 },
          ),
        }
      }),
    )
    .returning()
  console.log(`   + ${projects.length} projects`)

  // Partnerships linking orgs to projects
  await tx.insert(schema.Partnerships).values([
    {
      organizationId: orgs[0].id,
      partnershipType: "SPONSOR",
      projectId: projects[0].id,
      startedAt: yearAgo,
      value: "25000.00",
    },
    {
      organizationId: orgs[1].id,
      partnershipType: "IN_KIND",
      projectId: projects[1].id,
      startedAt: yearAgo,
      value: "8000.00",
    },
    {
      organizationId: orgs[2].id,
      partnershipType: "TECHNICAL",
      projectId: projects[2].id,
      startedAt: yearAgo,
      value: "12000.00",
    },
  ])

  // ────────────────────────────────────────────────────────────────────
  // 7. Events
  // ────────────────────────────────────────────────────────────────────
  console.log("📅 Events...")
  const EVENT_NAMES = [
    "Q1 Town Hall",
    "Code & Coffee — Accra",
    "Mentor Match Day",
    "Annual Welfare Drive",
    "Chapter Leads Retreat",
    "Youth Climate Summit",
    "Onboarding Cohort #4 Kickoff",
    "Networking Mixer — Tema",
  ]
  const eventRows = EVENT_NAMES.map((name, i) => {
    const start = faker.date.between({
      from: new Date(now.getFullYear(), 0, 1),
      to: new Date(now.getFullYear() + 1, 5, 30),
    })
    const end = new Date(start.getTime() + 1000 * 60 * 60 * 3) // +3h
    // events_scope_check: at most one of (projectId, chapterId) may be set.
    // Decide scope per event — bias toward chapter-scoped events.
    const scope: { projectId?: string; chapterId?: string } = (() => {
      const roll = Math.random()
      if (roll < 0.5)
        return { chapterId: faker.helpers.arrayElement(chapters).id }
      if (roll < 0.85)
        return { projectId: faker.helpers.arrayElement(projects).id }
      return {}
    })()
    return {
      name,
      type: EVENT_TYPES[i % EVENT_TYPES.length],
      scheduledStart: start,
      scheduledEnd: end,
      location: faker.location.city() + ", Ghana",
      objective: faker.lorem.sentence({ min: 8, max: 14 }),
      status: faker.helpers.arrayElement(PROJECT_STATUSES),
      ...scope,
    }
  })
  await tx.insert(schema.Events).values(eventRows)
  console.log(`   + ${eventRows.length} events`)

  // ────────────────────────────────────────────────────────────────────
  // 8. Financial transactions + donations
  // ────────────────────────────────────────────────────────────────────
  console.log("💵 Donations...")
  const DONATION_COUNT = 12
  let donationCount = 0
  for (let i = 0; i < DONATION_COUNT; i++) {
    const amount = faker.number.int({ min: 25, max: 750 }).toFixed(2)
    const [tnx] = await tx
      .insert(schema.FinancialTransactions)
      .values({
        amount,
        currency: "GHS",
        paymentMethod: faker.helpers.arrayElement([
          "CREDIT_CARD",
          "BANK_TRANSFER",
          "MOBILE_MONEY",
        ]),
        status: "COMPLETED",
        externalProvider: "PAYSTACK",
        externalRef: `demo_paystack_${faker.string.alphanumeric(10)}`,
      })
      .returning()
    const fromMember = faker.datatype.boolean({ probability: 0.5 })
    await tx.insert(schema.Donations).values({
      transactionId: tnx.id,
      constituentId: fromMember
        ? faker.helpers.arrayElement(newConstituents).id
        : null,
      projectId: faker.helpers.maybe(
        () => faker.helpers.arrayElement(projects).id,
        { probability: 0.7 },
      ),
      guestName: fromMember ? null : faker.person.fullName(),
      guestEmail: fromMember ? null : faker.internet.email(),
    })
    donationCount++
  }
  console.log(`   + ${donationCount} donations`)

  // ────────────────────────────────────────────────────────────────────
  // 9. Dues + payments
  // ────────────────────────────────────────────────────────────────────
  console.log("💳 Dues + payments...")
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearEnd = new Date(now.getFullYear(), 11, 31)
  const [dues] = await tx
    .insert(schema.Dues)
    .values({
      amount: "120.00",
      currency: "GHS",
      periodStart: yearStart,
      periodEnd: yearEnd,
    })
    .returning()

  let duesPaymentCount = 0
  // Existing test member (mary) + half of new members pay
  const allMembers = await tx.query.Members.findMany()
  const paying = faker.helpers.arrayElements(allMembers, Math.ceil(allMembers.length / 2))
  for (const m of paying) {
    const [tnx] = await tx
      .insert(schema.FinancialTransactions)
      .values({
        amount: "120.00",
        currency: "GHS",
        paymentMethod: "MOBILE_MONEY",
        status: "COMPLETED",
        externalProvider: "PAYSTACK",
        externalRef: `demo_dues_${faker.string.alphanumeric(10)}`,
      })
      .returning()
    await tx.insert(schema.DuesPayments).values({
      transactionId: tnx.id,
      duesId: dues.id,
      memberId: m.id,
    })
    duesPaymentCount++
  }
  console.log(`   + 1 dues period, ${duesPaymentCount} payments`)

  // ────────────────────────────────────────────────────────────────────
  // 10. Announcements + recipients
  // ────────────────────────────────────────────────────────────────────
  console.log("📢 Announcements + recipients...")
  const authorConstituentId = newConstituents[0].id
  const announcementRows = await tx
    .insert(schema.Announcements)
    .values(
      ANNOUNCEMENT_SEEDS.map((a, i) => ({
        title: a.title,
        content: a.content,
        targetCriteria: { profileTypes: ["MEMBER"] },
        authorId: authorConstituentId,
        status: "PUBLISHED",
        publishedAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      })),
    )
    .returning()

  // Fan out to all constituents (test users + new ones)
  const allConstituents = await tx.query.Constituents.findMany()
  const fanout = announcementRows.flatMap((a) =>
    allConstituents.map((c) => ({
      announcementId: a.id,
      constituentId: c.id,
      isRead: faker.datatype.boolean({ probability: 0.3 }),
      readAt: null as Date | null,
      emailSent: true,
    })),
  )
  await tx.insert(schema.ConstituentAnnouncements).values(fanout)
  console.log(
    `   + ${announcementRows.length} announcements × ${allConstituents.length} recipients = ${fanout.length} entries`,
  )

  console.log("\n✅ Demo seed complete.")
}

dbClient
  .initialize()
  .then(() => dbClient.db.transaction(seed))
  .then(() => {
    console.log("Done.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("❌ Seed failed:", err)
    process.exit(1)
  })
