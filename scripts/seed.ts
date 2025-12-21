import { faker } from "@faker-js/faker";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import bcrypt from "bcryptjs";

async function seed(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
) {
  console.log("⚙️ Seeding core and app tables...");

  // Seed Constituents
  const constituents = await tx
    .insert(schema.Constituents)
    .values(
      Array.from({ length: 30 }, () => ({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        dateOfBirth: faker.date.birthdate({ min: 18, max: 65, mode: "age" }),
        gender: faker.helpers.arrayElement(schema.GenderEnum.enumValues),
        email: faker.internet.email(),
        phone: faker.phone.number(),
        whatsapp: faker.phone.number(),
        orgEmail: faker.internet.email(),
      })),
    )
    .returning();

  // Seed Users
  const hashedPassword = await bcrypt.hash("password123", 10);
  const users = await tx
    .insert(schema.Users)
    .values(
      constituents.map((c) => ({
        constituentId: c.id,
        email: faker.internet.email({
          firstName: c.firstName,
          lastName: c.lastName,
        }),
        password: hashedPassword,
      })),
    )
    .returning();

  // Seed Chapters
  const chapters = await tx
    .insert(schema.Chapters)
    .values([
      {
        name: "Lagos Chapter",
        country: "NG",
        foundingDate: faker.date.past({ years: 5 }),
      },
      {
        name: "Accra Chapter",
        country: "GH",
        foundingDate: faker.date.past({ years: 3 }),
      },
      {
        name: "Nairobi Chapter",
        country: "KE",
        foundingDate: faker.date.past({ years: 2 }),
      },
    ])
    .returning();

  // Seed Committees
  const committees = await tx
    .insert(schema.Committees)
    .values([
      { name: "Finance Committee", chapterId: chapters[0].id },
      { name: "Tech Committee", chapterId: chapters[1].id },
      { name: "Outreach Committee", chapterId: chapters[0].id },
      { name: "Events Committee", chapterId: chapters[2].id },
    ])
    .returning();

  // Seed Organizations
  const organizations = await tx
    .insert(schema.Organizations)
    .values([
      {
        name: "TechCorp Foundation",
        website: "https://techcorp.example.com",
        description: "Technology-focused nonprofit partner",
        isActive: true,
      },
      {
        name: "Green Earth Initiative",
        website: "https://greenearth.example.com",
        description: "Environmental conservation partner",
        isActive: true,
      },
      {
        name: "Local Venue Co",
        description: "Event venue provider",
        isActive: true,
      },
    ])
    .returning();

  // Seed Organization Contacts
  await tx.insert(schema.OrganizationContacts).values([
    {
      organizationId: organizations[0].id,
      constituentId: constituents[10].id,
      title: "Partnership Manager",
      isPrimary: true,
    },
    {
      organizationId: organizations[1].id,
      constituentId: constituents[11].id,
      title: "Director of Partnerships",
      isPrimary: true,
    },
    {
      organizationId: organizations[2].id,
      constituentId: constituents[12].id,
      title: "Sales Manager",
      isPrimary: false,
    },
  ]);

  // Seed Member Titles
  const globalPresidentTitle = await tx
    .insert(schema.MemberTitles)
    .values({
      alias: "president",
      title: "President",
      description: "Global President of the organization",
      _level: 100,
    })
    .returning();

  const chapterLeadTitles = await tx
    .insert(schema.MemberTitles)
    .values(
      chapters.map((c) => ({
        alias: "chapterlead",
        title: "Chapter Lead",
        description: `Lead of the ${c.name}`,
        _level: 50,
        chapterId: c.id,
      })),
    )
    .returning();

  const committeeTitles = await tx
    .insert(schema.MemberTitles)
    .values([
      {
        alias: `committeechair`,
        title: "Committee Chair",
        description: `Chair of ${committees[0].name}`,
        _level: 40,
        committeeId: committees[0].id,
      },
      {
        alias: `committeechair`,
        title: "Committee Chair",
        description: `Chair of ${committees[1].name}`,
        _level: 40,
        committeeId: committees[1].id,
      },
    ])
    .returning();

  // Seed Admins
  const admins = await tx
    .insert(schema.Admins)
    .values([
      { constituentId: constituents[0].id, startedAt: new Date() },
      { constituentId: constituents[1].id, startedAt: new Date() },
    ])
    .returning();

  // Seed Admin Role Assignments
  await tx.insert(schema.AdminRolesAssignments).values([
    {
      adminId: admins[0].id,
      role: "SUPER_ADMIN",
      startedAt: new Date(),
    },
    {
      adminId: admins[1].id,
      role: "REGULAR_ADMIN",
      startedAt: new Date(),
    },
  ]);

  // Seed Members
  const members = await tx
    .insert(schema.Members)
    .values(
      constituents.slice(0, 25).map((c) => ({
        constituentId: c.id,
        startedAt: faker.date.past({ years: 2 }),
      })),
    )
    .returning();

  // Seed Volunteers
  await tx.insert(schema.Volunteers).values(
    constituents.slice(15, 22).map((c) => ({
      constituentId: c.id,
      startedAt: faker.date.past({ years: 1 }),
    })),
  );

  // Seed Auditors
  await tx.insert(schema.Auditors).values([
    {
      constituentId: constituents[25].id,
      startedAt: faker.date.past({ years: 1 }),
    },
    {
      constituentId: constituents[26].id,
      startedAt: faker.date.past(),
    },
  ]);

  // Seed Member Titles Assignments
  await tx.insert(schema.MemberTitlesAssignments).values([
    {
      memberId: members[1].id,
      titleId: globalPresidentTitle[0].id,
      startedAt: new Date(),
    },
    {
      memberId: members[2].id,
      titleId: chapterLeadTitles[0].id,
      startedAt: new Date(),
    },
    {
      memberId: members[3].id,
      titleId: chapterLeadTitles[1].id,
      startedAt: faker.date.past(),
    },
    {
      memberId: members[5].id,
      titleId: committeeTitles[0].id,
      startedAt: faker.date.past(),
    },
    {
      memberId: members[6].id,
      titleId: committeeTitles[1].id,
      startedAt: faker.date.past(),
    },
  ]);

  // Seed Chapter Memberships
  await tx.insert(schema.ChapterMemberships).values(
    members.map((m) => ({
      memberId: m.id,
      chapterId: faker.helpers.arrayElement(chapters).id,
      startedAt: faker.date.past(),
    })),
  );

  // Seed Committee Memberships
  await tx.insert(schema.CommitteeMemberships).values(
    members.slice(0, 15).map((m) => ({
      memberId: m.id,
      committeeId: faker.helpers.arrayElement(committees).id,
      startedAt: faker.date.past(),
    })),
  );

  console.log("✅ Core and app tables seeded.");

  console.log("🎉 Seeding activities...");
  // Seed Projects
  const projects = await tx
    .insert(schema.Projects)
    .values(
      Array.from({ length: 5 }, () => ({
        title: faker.company.catchPhrase(),
        abstract: faker.lorem.sentence(),
        description: faker.lorem.paragraphs(3),
        scheduledStart: faker.date.future(),
        scheduledEnd: faker.date.future(),
        status: faker.helpers.arrayElement(schema.ProjectStatusEnum.enumValues),
        chapterId: faker.helpers.arrayElement(chapters).id,
      })),
    )
    .returning();

  // Seed Events
  const events = await tx
    .insert(schema.Events)
    .values(
      Array.from({ length: 10 }, () => ({
        name: faker.company.buzzPhrase(),
        location: faker.location.city(),
        objective: faker.lorem.sentence(),
        scheduledStart: faker.date.future(),
        scheduledEnd: faker.date.future(),
        status: faker.helpers.arrayElement(schema.EventStatusEnum.enumValues),
        projectId: faker.helpers.arrayElement(projects).id,
        type: faker.helpers.arrayElement(schema.EventTypeEnum.enumValues),
      })),
    )
    .returning();

  console.log("✅ Activities seeded.");

  console.log("💰 Seeding finance...");
  // Seed Financial Transactions for Donations
  const donationTransactions = await tx
    .insert(schema.FinancialTransactions)
    .values(
      Array.from({ length: 8 }, () => ({
        amount: faker.finance.amount({ min: 10, max: 500, dec: 2 }),
        currency: "USD",
        createdAt: faker.date.recent(),
        paymentMethod: faker.helpers.arrayElement(
          schema.PaymentMethodEnum.enumValues,
        ),
        externalProvider: "PAYSTACK" as const,
        status: faker.helpers.arrayElement(
          schema.TransactionStatusEnum.enumValues,
        ),
      })),
    )
    .returning();

  // Seed Donations
  await tx.insert(schema.Donations).values(
    donationTransactions.map((txn, i) => ({
      transactionId: txn.id,
      constituentId: i < 10 ? constituents[20 + i].id : null, // First 8 with constituents, rest anonymous
      projectId: i < 4 ? projects[i % projects.length].id : null,
      eventId: i >= 4 ? events[i % events.length].id : null,
    })),
  );

  // Seed Dues
  const dues = await tx
    .insert(schema.Dues)
    .values(
      chapters.map((ch) => ({
        chapterId: ch.id,
        amount: "100.00",
        currency: "USD",
        periodStart: faker.date.past(),
        periodEnd: faker.date.future(),
      })),
    )
    .returning();

  // Seed Financial Transactions for Dues Payments
  const duesTransactions = await tx
    .insert(schema.FinancialTransactions)
    .values(
      Array.from({ length: 10 }, () => ({
        amount: "100.00",
        currency: "USD",
        createdAt: faker.date.recent(),
        paymentMethod: faker.helpers.arrayElement(
          schema.PaymentMethodEnum.enumValues,
        ),
        externalProvider: "PAYSTACK" as const,
        status: "COMPLETED" as const,
      })),
    )
    .returning();

  // Seed Dues Payments
  await tx.insert(schema.DuesPayments).values(
    duesTransactions.map((txn, i) => ({
      transactionId: txn.id,
      duesId: dues[i % dues.length].id,
      memberId: members[i].id,
    })),
  );

  // Seed Expenditures
  await tx.insert(schema.Expenditures).values([
    {
      timestamp: faker.date.recent(),
      amount: "500.00",
      currency: "USD",
      description: "Event venue rental",
      category: "Venue",
      projectId: projects[0].id,
      eventId: events[0].id,
      vendorId: organizations[2].id,
    },
    {
      timestamp: faker.date.recent(),
      amount: "250.00",
      currency: "USD",
      description: "Catering services",
      category: "Food",
      eventId: events[1].id,
    },
    {
      timestamp: faker.date.recent(),
      amount: "1200.00",
      currency: "USD",
      description: "Technology infrastructure",
      category: "IT",
      projectId: projects[1].id,
    },
  ]);

  // Seed Partnerships
  await tx.insert(schema.Partnerships).values([
    {
      organizationId: organizations[0].id,
      partnershipType: "SPONSOR" as const,
      projectId: projects[0].id,
      startedAt: new Date("2024-01-01"),
      value: "5000.00",
      metadata: "Tech sponsorship for digital infrastructure",
    },
    {
      organizationId: organizations[1].id,
      partnershipType: "IN_KIND" as const,
      eventId: events[0].id,
      startedAt: faker.date.past(),
      metadata: "Provided environmental materials",
    },
    {
      organizationId: organizations[2].id,
      partnershipType: "VENUE" as const,
      eventId: events[1].id,
      startedAt: faker.date.past(),
      value: "800.00",
    },
  ]);

  console.log("✅ Finance seeded.");

  // Seed Notifications (linked to broadcasts)
  await tx.insert(schema.AppNotifications).values(
    members.slice(0, 10).flatMap((m, i) => [
      {
        userId: users[i].id,
        title: faker.lorem.sentence(),
        message: faker.lorem.paragraph(),
        isRead: faker.datatype.boolean(),
        createdAt: faker.date.past(),
      },
    ]),
  );

  console.log("✅ Communications seeded.");

  console.log("🛍️ Seeding shop...");
  // Seed Products
  const products = await tx
    .insert(schema.Products)
    .values([
      {
        name: "YPF Branded T-Shirt",
        sku: "YPF-TSH-001",
        description: "High-quality cotton t-shirt",
        price: "25.00",
        stockQuantity: 100,
      },
      {
        name: "YPF Hoodie",
        sku: "YPF-HD-001",
        description: "Cozy YPF-branded hoodie",
        price: "50.00",
        stockQuantity: 50,
      },
      {
        name: "YPF Coffee Mug",
        sku: "YPF-MUG-001",
        description: "YPF-branded coffee mug",
        price: "15.00",
        stockQuantity: 75,
      },
    ])
    .returning();

  // Seed Orders
  const orders = await tx
    .insert(schema.Orders)
    .values([
      {
        constituentId: constituents[5].id,
        totalAmount: "75.00",
        status: "COMPLETED",
      },
      {
        constituentId: constituents[8].id,
        totalAmount: "15.00",
        status: "PENDING",
      },
      {
        constituentId: constituents[10].id,
        totalAmount: "50.00",
        status: "COMPLETED",
      },
    ])
    .returning();

  // Seed Order Items
  await tx.insert(schema.OrderItems).values([
    {
      orderId: orders[0].id,
      productId: products[0].id,
      quantity: 1,
      priceAtPurchase: products[0].price,
    },
    {
      orderId: orders[0].id,
      productId: products[1].id,
      quantity: 1,
      priceAtPurchase: products[1].price,
    },
    {
      orderId: orders[1].id,
      productId: products[2].id,
      quantity: 1,
      priceAtPurchase: products[2].price,
    },
    {
      orderId: orders[2].id,
      productId: products[1].id,
      quantity: 1,
      priceAtPurchase: products[1].price,
    },
  ]);
  console.log("✅ Shop seeded.");
}

dbClient
  .initialize()
  .then(() => dbClient.db.transaction((tx) => seed(tx)))
  .then(() => {
    console.log("Database seeded successfully with the new schema! 🎉");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error seeding database:", err);
    process.exit(1);
  });
