import { faker } from "@faker-js/faker";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import bcrypt from "bcryptjs";
import { ProjectTypeEnum } from "@/db/schema/activities";

async function seed(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0]
) {
  console.log("🌱 Starting Real-World Seeding...");

  // ----------------------------------------------------------------------
  // 1. CONSTITUENTS
  // ----------------------------------------------------------------------
  console.log("👤 Seeding Constituents...");
  const constituentsData = Array.from({ length: 60 }, () => ({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    whatsapp: faker.phone.number(),
    gender: faker.helpers.arrayElement(schema.GenderEnum.enumValues),
    dateOfBirth: faker.date.birthdate({ min: 18, max: 60, mode: "age" }),
    country: faker.location.country(),
    city: faker.location.city(),
    occupation: faker.person.jobTitle(),
  }));

  // Ensure some have org emails for admins
  constituentsData[0].email = "president@ypf.org";
  constituentsData[1].email = "vp@ypf.org";

  const constituents = await tx
    .insert(schema.Constituents)
    .values(constituentsData)
    .returning();

  // ----------------------------------------------------------------------
  // 2. AUTH (USERS)
  // ----------------------------------------------------------------------
  console.log("🔐 Seeding Users...");
  const hashedPassword = await bcrypt.hash("password123", 10);
  await tx
    .insert(schema.Users)
    .values(
      constituents.map((c) => ({
        constituentId: c.id,
        email: c.email!, // All generated have emails
        password: hashedPassword,
      }))
    )
    .returning();

  // ----------------------------------------------------------------------
  // 3. ORGANIZATION STRUCTURE (Chapters, Committees)
  // ----------------------------------------------------------------------
  console.log("🏢 Seeding Chapters & Committees...");
  const chaptersData = [
    {
      name: "Lagos Chapter",
      country: "Nigeria",
      foundingDate: new Date("2018-01-01"),
    },
    {
      name: "Accra Chapter",
      country: "Ghana",
      foundingDate: new Date("2019-05-15"),
    },
    {
      name: "Nairobi Chapter",
      country: "Kenya",
      foundingDate: new Date("2020-02-20"),
    },
    {
      name: "New York Chapter",
      country: "USA",
      foundingDate: new Date("2021-08-10"),
    },
  ];
  const chapters = await tx
    .insert(schema.Chapters)
    .values(chaptersData)
    .returning();

  const committeesData = [
    // Lagos
    { name: "Lagos Finance", chapterId: chapters[0].id },
    { name: "Lagos Tech", chapterId: chapters[0].id },
    // Accra
    { name: "Accra Outreach", chapterId: chapters[1].id },
    // Nairobi
    { name: "Nairobi Events", chapterId: chapters[2].id },
    // Global/No Chapter specific? Or just more chapters
    { name: "Global Strategy", description: "Oversight committee" },
  ];
  const committees = await tx
    .insert(schema.Committees)
    .values(committeesData)
    .returning();

  // ----------------------------------------------------------------------
  // 4. ROLES & TITLES
  // ----------------------------------------------------------------------
  console.log("👑 Seeding Titles...");
  // Global
  const globalTitles = await tx
    .insert(schema.MemberTitles)
    .values([
      { title: "Global President", alias: "global_president", _level: 100 },
      { title: "Global VP", alias: "global_vp", _level: 90 },
      { title: "General Secretary", alias: "gen_sec", _level: 80 },
    ])
    .returning();

  // Chapter Leads
  const chapterTitles = await tx
    .insert(schema.MemberTitles)
    .values(
      chapters.map((c) => ({
        title: `${c.name} Lead`,
        alias: `lead_${c.name.toLowerCase().replace(/\s/g, "_")}`,
        _level: 60,
        chapterId: c.id,
      }))
    )
    .returning();

  await tx
    .insert(schema.MemberTitles)
    .values(
      committees.map((com) => ({
        title: `${com.name} Chair`,
        alias: `chair_${com.name.toLowerCase().replace(/\s/g, "_")}`,
        _level: 50,
        committeeId: com.id,
      }))
    )
    .returning();

  // ----------------------------------------------------------------------
  // 5. MEMBERSHIPS & ROLES ASSIGNMENTS
  // ----------------------------------------------------------------------
  console.log("👥 Seeding Memberships...");
  // Make the first 40 constituents Members
  const memberConstituents = constituents.slice(0, 40);
  const members = await tx
    .insert(schema.Members)
    .values(
      memberConstituents.map((c) => ({
        constituentId: c.id,
        startedAt: faker.date.past({ years: 3 }),
      }))
    )
    .returning();

  // Make the next 10 Volunteers
  const volunteerConstituents = constituents.slice(40, 50);
  await tx.insert(schema.Volunteers).values(
    volunteerConstituents.map((c) => ({
      constituentId: c.id,
      startedAt: faker.date.past({ years: 1 }),
    }))
  );

  // Make some Admins (Top 5 members)
  const adminMembers = members.slice(0, 5);
  const admins = await tx
    .insert(schema.Admins)
    .values(
      adminMembers.map((m) => ({
        constituentId: m.constituentId,
        startedAt: faker.date.past({ years: 2 }),
      }))
    )
    .returning();

  // Assign Admin Roles
  await tx.insert(schema.AdminRolesAssignments).values([
    { adminId: admins[0].id, role: "SUPER_ADMIN", startedAt: new Date() }, // President
    { adminId: admins[1].id, role: "SUPER_ADMIN", startedAt: new Date() }, // VP
    { adminId: admins[2].id, role: "REGULAR_ADMIN", startedAt: new Date() },
    { adminId: admins[3].id, role: "REGULAR_ADMIN", startedAt: new Date() },
    { adminId: admins[4].id, role: "REGULAR_ADMIN", startedAt: new Date() },
  ]);

  // Assign Titles
  // President
  await tx.insert(schema.MemberTitlesAssignments).values({
    memberId: members[0].id,
    titleId: globalTitles.find((t) => t.alias === "global_president")!.id,
    startedAt: new Date(),
  });
  // VP
  await tx.insert(schema.MemberTitlesAssignments).values({
    memberId: members[1].id,
    titleId: globalTitles.find((t) => t.alias === "global_vp")!.id,
    startedAt: new Date(),
  });

  // Assign Chapter Leads (Members 5,6,7,8)
  for (let i = 0; i < chapters.length; i++) {
    await tx.insert(schema.MemberTitlesAssignments).values({
      memberId: members[5 + i].id,
      titleId: chapterTitles[i].id,
      startedAt: new Date(),
    });
  }

  // Assign Chapter Memberships (Random distribution)
  const chapterMembershipsData = members.map((m) => ({
    memberId: m.id,
    chapterId: faker.helpers.arrayElement(chapters).id,
    startedAt: faker.date.past({ years: 2 }),
  }));
  await tx.insert(schema.ChapterMemberships).values(chapterMembershipsData);

  // Assign Committee Memberships (Random subset)
  const committeeMembershipsData = members
    .filter(() => Math.random() > 0.3) // 70% are in a committee
    .map((m) => ({
      memberId: m.id,
      committeeId: faker.helpers.arrayElement(committees).id,
      startedAt: faker.date.past({ years: 1 }),
    }));
  await tx.insert(schema.CommitteeMemberships).values(committeeMembershipsData);

  // ----------------------------------------------------------------------
  // 6. EXTERNAL ORGANIZATIONS
  // ----------------------------------------------------------------------
  console.log("🤝 Seeding Organizations...");
  const organizations = await tx
    .insert(schema.Organizations)
    .values([
      { name: "TechCorp Foundation", website: "techcorp.org", isActive: true },
      { name: "Green Earth NGO", website: "greenearth.org", isActive: true },
      {
        name: "City General Hospital",
        website: "cityhospital.gov",
        isActive: true,
      },
      {
        name: "Bright Future Schools",
        website: "brightfuture.edu",
        isActive: true,
      },
      { name: "Grand Venue Halls", isActive: true },
    ])
    .returning();

  // Org Contacts (Use random constituents not in members/volunteers list effectively, or reuse)
  // Let's use the last 10 constituents who are not members/volunteers (50-59)
  const pocs = constituents.slice(50, 55);
  await tx.insert(schema.OrganizationContacts).values(
    organizations.map((org, idx) => ({
      organizationId: org.id,
      constituentId: pocs[idx] ? pocs[idx].id : pocs[0].id,
      title: "Partnership Lead",
      isPrimary: true,
    }))
  );

  // ----------------------------------------------------------------------
  // 7. ACTIVITIES (Projects, Events, Welfare)
  // ----------------------------------------------------------------------
  console.log("🚀 Seeding Activities...");

  // Projects
  const projects = await tx
    .insert(schema.Projects)
    .values([
      {
        type: faker.helpers.arrayElement(ProjectTypeEnum.enumValues),
        title: "Code for Kids",
        description: "Teaching coding to underprivileged children.",
        status: "ONGOING",
        chapterId: chapters[0].id,
        scheduledStart: faker.date.past(),
        scheduledEnd: faker.date.future(),
      },
      {
        type: faker.helpers.arrayElement(ProjectTypeEnum.enumValues),
        title: "Clean Water 2024",
        description: "Borehole installation in rural areas.",
        status: "UPCOMING",
        chapterId: chapters[1].id,
        scheduledStart: faker.date.future(),
        scheduledEnd: faker.date.future(),
      },
      {
        type: faker.helpers.arrayElement(ProjectTypeEnum.enumValues),
        title: "Annual Leadership Summit",
        description: "Global gathering of all chapters.",
        status: "UPCOMING",
        scheduledStart: faker.date.future(),
        scheduledEnd: faker.date.future(),
      },
    ])
    .returning();

  // Events
  const events = await tx
    .insert(schema.Events)
    .values([
      // Project related
      {
        name: "Python Workshop 101",
        type: "WORKSHOP",
        projectId: projects[0].id,
        scheduledStart: faker.date.recent(),
        scheduledEnd: faker.date.recent(),
        status: "COMPLETED",
        location: "TechHub Lagos",
      },
      // Fundraising
      {
        name: "Charity Gala Night",
        type: "NETWORKING",
        projectId: projects[2].id,
        scheduledStart: faker.date.future(),
        scheduledEnd: faker.date.future(),
        status: "UPCOMING",
        location: "Grand Venue Halls",
      },
      // General
      {
        name: "Community Cleanup",
        type: "STREETCARE",
        chapterId: chapters[2].id, // Nairobi
        scheduledStart: faker.date.past(),
        scheduledEnd: faker.date.past(),
        status: "COMPLETED",
        location: "Nairobi Central Park",
      },
    ])
    .returning();

  // ----------------------------------------------------------------------
  // 8. FINANCE
  // ----------------------------------------------------------------------
  console.log("💰 Seeding Finance...");

  // Dues
  const dues = await tx
    .insert(schema.Dues)
    .values(
      chapters.map((c) => ({
        chapterId: c.id,
        amount: "50.00",
        currency: "USD",
        periodStart: new Date("2024-01-01"),
        periodEnd: new Date("2024-12-31"),
      }))
    )
    .returning();

  // Financial Transactions (Dues Payments)
  // Let's say half of the members paid dues
  const payingMembers = members.slice(0, 20);
  const duesTransactions = await tx
    .insert(schema.FinancialTransactions)
    .values(
      payingMembers.map(() => ({
        amount: "50.00",
        currency: "USD",
        paymentMethod: "BANK_TRANSFER" as const,
        status: "COMPLETED" as const,
        externalProvider: "PAYSTACK" as const,
        externalRef: faker.string.uuid(),
      }))
    )
    .returning();

  await tx.insert(schema.DuesPayments).values(
    duesTransactions.map((t, i) => ({
      transactionId: t.id,
      duesId:
        dues.find(
          () =>
            // find due matching member's chapter roughly, or just pick random due
            true
        )!.id ?? dues[0].id,
      // For simplicity, just assigned to dues[0] or random if logic complex
      memberId: payingMembers[i].id,
    }))
  );

  // Donations
  const donationTransactions = await tx
    .insert(schema.FinancialTransactions)
    .values(
      Array.from({ length: 10 }, () => ({
        amount: faker.finance.amount({ min: 100, max: 1000, dec: 2 }),
        currency: "USD",
        paymentMethod: "CREDIT_CARD" as const,
        status: "COMPLETED" as const,
        externalProvider: "PAYSTACK" as const,
        externalRef: faker.string.uuid(),
      }))
    )
    .returning();

  await tx.insert(schema.Donations).values(
    donationTransactions.map((t, i) => ({
      transactionId: t.id,
      constituentId: i < 5 ? constituents[i].id : null,
      projectId: i % 2 === 0 ? projects[0].id : null,
      eventId: i % 2 !== 0 ? events[1].id : null,
    }))
  );

  // Partnerships
  await tx.insert(schema.Partnerships).values([
    {
      organizationId: organizations[0].id, // TechCorp
      partnershipType: "TECHNICAL",
      projectId: projects[0].id, // Code for Kids
      startedAt: new Date(),
      metadata: "Providing laptops and curriculum.",
    },
    {
      organizationId: organizations[4].id, // Grand Venue
      partnershipType: "VENUE",
      eventId: events[1].id, // Gala
      startedAt: new Date(),
      value: "2000.00",
    },
  ]);

  // Expenditures
  await tx.insert(schema.Expenditures).values([
    {
      timestamp: new Date(),
      amount: "1500.00",
      currency: "USD",
      description: "Venue Deposit",
      vendorId: organizations[4].id,
      eventId: events[1].id,
    },
    {
      timestamp: new Date(),
      amount: "500.00",
      currency: "USD",
      description: "Hospital Bill Payment",
      vendorId: organizations[2].id,
      projectId: projects[0].id,
    },
  ]);

  // ----------------------------------------------------------------------
  // 9. SHOP
  // ----------------------------------------------------------------------
  console.log("🛍️ Seeding Shop...");
  const products = await tx
    .insert(schema.Products)
    .values([
      {
        name: "YPF T-Shirt",
        sku: "TSHIRT-001",
        price: "20.00",
        stockQuantity: 100,
      },
      {
        name: "YPF Notebook",
        sku: "NOTE-001",
        price: "5.00",
        stockQuantity: 200,
      },
      {
        name: "YPF Hoodie",
        sku: "HOODIE-001",
        price: "40.00",
        stockQuantity: 50,
      },
    ])
    .returning();

  const orders = await tx
    .insert(schema.Orders)
    .values([
      {
        constituentId: members[0].constituentId,
        totalAmount: "60.00",
        status: "COMPLETED",
      },
      {
        constituentId: members[1].constituentId,
        totalAmount: "25.00",
        status: "PENDING",
      },
    ])
    .returning();

  await tx.insert(schema.OrderItems).values([
    {
      orderId: orders[0].id,
      productId: products[0].id,
      quantity: 1,
      priceAtPurchase: "20.00",
    },
    {
      orderId: orders[0].id,
      productId: products[2].id,
      quantity: 1,
      priceAtPurchase: "40.00",
    },
    {
      orderId: orders[1].id,
      productId: products[0].id,
      quantity: 1,
      priceAtPurchase: "20.00",
    },
    {
      orderId: orders[1].id,
      productId: products[1].id,
      quantity: 1,
      priceAtPurchase: "5.00",
    },
  ]);

  // ----------------------------------------------------------------------
  // 10. ANNOUNCEMENTS
  // ----------------------------------------------------------------------
  console.log("📢 Seeding Announcements...");
  await tx.insert(schema.Announcements).values([
    {
      title: "Welcome to our new platform!",
      content: "We are excited to launch...",
      targetCriteria: {
        status: "ALL",
      },
      authorId: members[0].constituentId, // President
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    {
      title: "Lagos Chapter Meeting",
      content: "Monthly sync up...",
      targetCriteria: {
        chapterIds: [chapters[0].id],
        status: "ACTIVE",
      },
      authorId: members[5].constituentId, // Lagos Lead
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    {
      title: "Urgent: Finance Committee",
      content: "Please review the budget.",
      targetCriteria: {
        committeeIds: [committees[0].id],
        status: "ACTIVE",
      },
      authorId: members[0].constituentId,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  ]);

  console.log("✅ Database Seeded Successfully!");
}

dbClient
  .initialize()
  .then(() => dbClient.db.transaction(seed))
  .then(() => {
    console.log("Execution complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
