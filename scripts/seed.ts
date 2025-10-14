import { faker } from "@faker-js/faker";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { exit } from "process";
import bcrypt from "bcryptjs";

pgPool.initialize();

async function seed() {
  console.log("🌱 Seeding database...");

  // 1. Clear existing data in reverse order of creation
  console.log("🗑️ Clearing existing data...");
  await pgPool.db.delete(schema.RoleAssignments);
  await pgPool.db.delete(schema.ChapterMemberships);
  await pgPool.db.delete(schema.CommitteeMemberships);
  await pgPool.db.delete(schema.Memberships);
  await pgPool.db.delete(schema.OrderItems);
  await pgPool.db.delete(schema.Orders);
  await pgPool.db.delete(schema.Products);
  await pgPool.db.delete(schema.Events);
  await pgPool.db.delete(schema.Projects);
  await pgPool.db.delete(schema.Committees);
  await pgPool.db.delete(schema.Chapters);
  await pgPool.db.delete(schema.Users);
  await pgPool.db.delete(schema.Constituents);
  await pgPool.db.delete(schema.Roles);
  console.log("✅ Data cleared.");

  // --- Core & App ---
  console.log("⚙️ Seeding core and app tables...");

  // 2. Roles
  const roles = await pgPool.db
    .insert(schema.Roles)
    .values([
      { id: "SUPER_ADMIN", name: "Super Admin", _level: 100 },
      { id: "ADMIN", name: "Admin", _level: 90 },
      { id: "CHAPTER_LEAD", name: "Chapter Lead", _level: 50 },
      { id: "MEMBER", name: "Member", _level: 10 },
    ])
    .returning();

  // 3. Constituents and Users
  const constituents = await pgPool.db
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
  await pgPool.db.insert(schema.Users).values(
    constituents.map((c) => ({
      constituentId: c.id,
      email: faker.internet.email({
        firstName: c.firstName ?? undefined,
        lastName: c.lastName ?? undefined,
      }),
      password: hashedPassword,
    })),
  );

  // 4. Chapters
  const chapters = await pgPool.db
    .insert(schema.Chapters)
    .values([
      {
        name: "UG",
        country: "NG",
        foundingDate: faker.date.past().toISOString(),
      },
      {
        name: "KNUST",
        country: "GH",
        foundingDate: faker.date.past().toISOString(),
      },
    ])
    .returning();

  // 5. Chapter Memberships
  await pgPool.db.insert(schema.ChapterMemberships).values(
    constituents.map((c) => ({
      constituentId: c.id,
      chapterId: faker.helpers.arrayElement(chapters).id,
      startedAt: faker.date.past(),
    })),
  );

  // 6. Committees
  await pgPool.db.insert(schema.Committees).values([
    { name: "Finance Committee", chapterId: chapters[0].id },
    { name: "Tech Committee", chapterId: chapters[1].id },
  ]);

  // 7. Role Assignments
  await pgPool.db.insert(schema.RoleAssignments).values([
    {
      constituentId: constituents[0].id,
      roleId: roles.find((r) => r.id === "SUPER_ADMIN")!.id,
      startedAt: new Date(),
    },
    {
      constituentId: constituents[1].id,
      roleId: roles.find((r) => r.id === "CHAPTER_LEAD")!.id,
      chapterId: chapters[1].id,
      startedAt: new Date(),
    },
  ]);

  console.log("✅ Core and app tables seeded.");

  // --- Activities ---
  console.log("🎉 Seeding activities...");
  const projects = await pgPool.db
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

  await pgPool.db.insert(schema.Events).values(
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

  // --- Shop ---
  console.log("🛍️ Seeding shop...");
  const products = await pgPool.db
    .insert(schema.Products)
    .values([
      {
        name: "YPF Branded T-Shirt",
        sku: "YPF-TSH-001",
        description: "High-quality cotton t-shirt with the YPF logo.",
        price: "25.00",
        stockQuantity: 100,
      },
      {
        name: "YPF Hoodie",
        sku: "YPF-HD-001",
        description: "Stay warm with this cozy YPF-branded hoodie.",
        price: "50.00",
        stockQuantity: 50,
      },
      {
        name: "YPF Coffee Mug",
        sku: "YPF-MUG-001",
        description: "Start your day right with a YPF-branded coffee mug.",
        price: "15.00",
        stockQuantity: 75,
      },
    ])
    .returning();

  // Create a couple of orders
  const orders = await pgPool.db
    .insert(schema.Orders)
    .values([
      {
        customerId: constituents[5].id,
        totalAmount: "75.00", // 1x T-Shirt + 1x Hoodie
        status: "COMPLETED",
      },
      {
        customerId: constituents[8].id,
        totalAmount: "15.00", // 1x Mug
        status: "PENDING",
      },
    ])
    .returning();

  await pgPool.db.insert(schema.OrderItems).values([
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

seed()
  .then(() => {
    console.log("Database seeded successfully! 🎉");
    exit(0);
  })
  .catch((err) => {
    console.error("❌ Error seeding database:", err);
    exit(1);
  });
