import { faker } from "@faker-js/faker";
import dbClient from "@/configs/db";
import schema from "@/db/schema";

async function addTestApplication() {
    console.log("🚀 Adding a test application...");

    // 1. Create a Constituent
    const [constituent] = await dbClient.db
        .insert(schema.Constituents)
        .values({
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            email: `test-${faker.string.alphanumeric(8)}@example.com`,
            phone: faker.phone.number(),
            whatsapp: faker.phone.number(),
            gender: faker.helpers.arrayElement(schema.GenderEnum.enumValues),
            dateOfBirth: faker.date.birthdate({ min: 18, max: 40, mode: "age" }),
            country: "Ghana",
            city: "Accra",
            occupation: "Software Engineer",
            nationalIdType: "ECOWASIDCARD",
        })
        .returning();

    console.log(`👤 Created constituent: ${constituent.firstName} ${constituent.lastName} (${constituent.email})`);

    // 2. Create an Application
    const [application] = await dbClient.db
        .insert(schema.Applications)
        .values({
            constituentId: constituent.id,
            status: "pending",
            commitmentStatement: "I want to help change Africa!",
            referralSource: "Social Media",
        })
        .returning();

    console.log(`📝 Created application with ID: ${application.id}`);
    console.log("✅ Done!");
}

dbClient
    .initialize()
    .then(() => addTestApplication())
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("❌ Failed to add test application:", err);
        process.exit(1);
    });
