import { faker } from "@faker-js/faker";
import { randomUUID } from "crypto";

/**
 * Test data factories to generate unique test data for each test run.
 * This prevents race conditions when multiple tests run concurrently.
 */

export function generateTestUser() {
  const uniqueId = randomUUID().substring(0, 8);
  return {
    email: `test-${uniqueId}@example.com`,
    password: faker.internet.password({ length: 16 }),
    name: {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    },
    constituentId: "",
  };
}

export function generateTestChapter() {
  const uniqueId = randomUUID().substring(0, 8);
  return {
    id: "",
    name: `Test Chapter ${uniqueId}`,
    country: faker.location.country(),
    description: faker.lorem.sentence(),
    foundingDate: faker.date.past({ years: 5 }),
  };
}

export function generateTestCommittee() {
  const uniqueId = randomUUID().substring(0, 8);
  return {
    id: "",
    name: `Test Committee ${uniqueId}`,
    description: faker.lorem.sentence(),
  };
}

export function generateTestEvent() {
  const uniqueId = randomUUID().substring(0, 8);
  const startDate = faker.date.future({ years: 1 });
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + faker.number.int({ min: 1, max: 7 }));

  return {
    id: "",
    name: `Test Event ${uniqueId}`,
    description: faker.lorem.sentence(),
    startDate,
    endDate,
    location: faker.location.city(),
  };
}

export function generateTestProject() {
  const uniqueId = randomUUID().substring(0, 8);
  const startDate = faker.date.future({ years: 1 });
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + faker.number.int({ min: 1, max: 6 }));

  return {
    id: "",
    title: `Test Project ${uniqueId}`,
    abstract: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    scheduledStart: startDate,
    scheduledEnd: endDate,
  };
}

export function generateTestDues() {
  const periodStart = faker.date.past({ years: 1 });
  const periodEnd = new Date(periodStart);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  return {
    id: "",
    amount: faker.number
      .float({ min: 50, max: 500, fractionDigits: 2 })
      .toFixed(2),
    currency: "GHS",
    periodStart,
    periodEnd,
    chapterId: null, // Global dues (no chapter-specific dues for now)
  };
}

export function generateTestOrganization() {
  const uniqueId = randomUUID().substring(0, 8);
  return {
    id: "",
    name: `Test Organization ${uniqueId}`,
    website: faker.internet.url(),
    description: faker.lorem.sentence(),
    logoUrl: faker.image.avatar(),
    isActive: true,
  };
}

export function generateTestPartnership() {
  const startedAt = faker.date.past({ years: 1 });
  const endedAt = new Date(startedAt);
  endedAt.setFullYear(endedAt.getFullYear() + 2);

  return {
    id: "",
    partnershipType: faker.helpers.arrayElement([
      "SPONSOR",
      "IN_KIND",
      "TECHNICAL",
      "VENUE",
      "OTHER",
    ]) as "SPONSOR" | "IN_KIND" | "TECHNICAL" | "VENUE" | "OTHER",
    startedAt,
    endedAt,
    value: faker.number
      .float({ min: 1000, max: 100000, fractionDigits: 2 })
      .toFixed(2),
    metadata: JSON.stringify({ notes: faker.lorem.sentence() }),
  };
}
