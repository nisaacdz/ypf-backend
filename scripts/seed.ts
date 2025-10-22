import { faker } from "@faker-js/faker";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import bcrypt from "bcryptjs";

async function seed(
  tx: Parameters<Parameters<typeof pgPool.db.transaction>[0]>[0],
) {
  console.log("⚙️ Seeding core and app tables...");

  const constituents = await tx
    .insert(schema.Constituents)
    .values(
      Array.from({ length: 30 }, () => ({
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        dateOfBirth: faker.date
          .birthdate({ min: 18, max: 65, mode: "age" })
          .toISOString(),
        gender: faker.helpers.arrayElement(schema.Gender.enumValues),
      })),
    )
    .returning();

  const hashedPassword = await bcrypt.hash("password123", 10);
  await tx.insert(schema.Users).values(
    constituents.map((c) => ({
      constituentId: c.id,
      email: faker.internet.email({
        firstName: c.firstName,
        lastName: c.lastName,
      }),
      password: hashedPassword,
    })),
  );

  const chapters = await tx
    .insert(schema.Chapters)
    .values([
      {
        name: "Lagos Chapter",
        country: "NG",
        foundingDate: faker.date.past().toISOString(),
      },
      {
        name: "Accra Chapter",
        country: "GH",
        foundingDate: faker.date.past().toISOString(),
      },
    ])
    .returning();

  await tx.insert(schema.Committees).values([
    { name: "Finance Committee", chapterId: chapters[0].id },
    { name: "Tech Committee", chapterId: chapters[1].id },
  ]);

  const globalPresidentTitle = await tx
    .insert(schema.MemberTitles)
    .values({
      id: "president",
      title: "President",
      description: "Global President of the organization",
      _level: 100,
    })
    .returning();

  const chapterLeadTitles = await tx
    .insert(schema.MemberTitles)
    .values(
      chapters.map((c) => ({
        id: `chapter-lead-${c.id}`,
        title: "Chapter Lead",
        description: `Lead of the ${c.name}`,
        _level: 50,
        chapterId: c.id,
      })),
    )
    .returning();

  const admins = await tx
    .insert(schema.Admins)
    .values({ constituentId: constituents[0].id, startedAt: new Date() })
    .returning();

  const members = await tx
    .insert(schema.Members)
    .values(
      constituents.slice(0, 25).map((c) => ({
        constituentId: c.id,
        startedAt: faker.date.past({ years: 2 }),
      })),
    )
    .returning();

  await tx.insert(schema.Donors).values(
    constituents.slice(20, 30).map((c) => ({
      constituentId: c.id,
    })),
  );

  await tx.insert(schema.AdminRolesAssignments).values({
    adminId: admins[0].id,
    role: "SUPER_ADMIN",
    startedAt: new Date(),
  });

  await tx.insert(schema.MemberTitlesAssignments).values({
    memberId: members[1].id,
    titleId: globalPresidentTitle[0].id,
    startedAt: new Date(),
  });

  await tx.insert(schema.MemberTitlesAssignments).values({
    memberId: members[2].id,
    titleId: chapterLeadTitles[0].id,
    startedAt: new Date(),
  });

  await tx.insert(schema.ChapterMemberships).values(
    members.map((m) => ({
      memberId: m.id,
      chapterId: faker.helpers.arrayElement(chapters).id,
      startedAt: faker.date.past(),
    })),
  );

  console.log("✅ Core and app tables seeded.");

  console.log("🎉 Seeding activities...");
  const projects = await tx
    .insert(schema.Projects)
    .values(
      Array.from({ length: 5 }, () => ({
        title: faker.company.catchPhrase(),
        abstract: faker.lorem.sentence(),
        description: faker.lorem.paragraphs(3),
        scheduledStart: faker.date.future(),
        scheduledEnd: faker.date.future(),
        status: faker.helpers.arrayElement(schema.ProjectStatus.enumValues),
        chapterId: faker.helpers.arrayElement(chapters).id,
      })),
    )
    .returning();

  await tx.insert(schema.Events).values(
    Array.from({ length: 10 }, () => ({
      name: faker.company.buzzPhrase(),
      location: faker.location.city(),
      objective: faker.lorem.sentence(),
      scheduledStart: faker.date.future(),
      scheduledEnd: faker.date.future(),
      status: faker.helpers.arrayElement(schema.EventStatus.enumValues),
      projectId: faker.helpers.arrayElement(projects).id,
    })),
  );
  console.log("✅ Activities seeded.");

  console.log("🛍️ Seeding shop...");
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

  const orders = await tx
    .insert(schema.Orders)
    .values([
      {
        customerId: constituents[5].id,
        totalAmount: "75.00",
        status: "COMPLETED",
      },
      {
        customerId: constituents[8].id,
        totalAmount: "15.00",
        status: "PENDING",
      },
    ])
    .returning();

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
  ]);
  console.log("✅ Shop seeded.");
}

pgPool
  .initialize()
  .then(() => pgPool.db.transaction((tx) => seed(tx)))
  .then(() => {
    console.log("Database seeded successfully with the new schema! 🎉");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error seeding database:", err);
    process.exit(1);
  });
