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
