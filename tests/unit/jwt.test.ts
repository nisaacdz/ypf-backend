import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import z from "zod";
import type { Valid, Expired } from "@/shared/utils/jwt";

// Mock the config modules to avoid environment setup issues (must be at top level with no variable references)
vi.mock("@/configs/env", () => ({
  default: {
    security: {
      jwtSecret: "test-secret-key-for-unit-tests-must-be-32-chars-long",
    },
  },
}));

vi.mock("@/configs/logger", () => ({
  default: {
    error: vi.fn(),
  },
}));

// Import after mocking setup
import { decodeToken, encodeData } from "@/shared/utils/jwt";

const TEST_SECRET = "test-secret-key-for-unit-tests-must-be-32-chars-long";
const TestSchema = z.object({
  id: z.string(),
  name: z.string(),
});

type TestPayload = z.infer<typeof TestSchema>;

describe("decodeToken", () => {
  it("should return Valid type for a valid, non-expired token", () => {
    const payload: TestPayload = { id: "123", name: "Test User" };
    const token = jwt.sign(payload, TEST_SECRET, { expiresIn: "1h" });

    const result = decodeToken(token, TestSchema);

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("id", "123");
    expect(result).toHaveProperty("name", "Test User");
    expect(result).toHaveProperty("exp");
    expect(typeof (result as any)?.exp).toBe("number");
    
    // Verify it's a Valid type by checking it has the payload properties
    if (result && "id" in result) {
      const valid: Valid<TestPayload> = result;
      expect(valid.id).toBe("123");
      expect(valid.name).toBe("Test User");
    }
  });

  it("should return Expired type for an expired but otherwise valid token", () => {
    const payload: TestPayload = { id: "456", name: "Expired User" };
    const token = jwt.sign(payload, TEST_SECRET, { expiresIn: "-1h" }); // Already expired

    const result = decodeToken(token, TestSchema);

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("exp");
    expect(result).not.toHaveProperty("id"); // Expired tokens only have exp
    
    // Verify it's an Expired type by checking it only has exp
    if (result && !("id" in result)) {
      const expired: Expired = result;
      expect(typeof expired.exp).toBe("number");
    }
  });

  it("should return null for a malformed token", () => {
    const malformedToken = "this.is.not.a.valid.jwt";

    const result = decodeToken(malformedToken, TestSchema);

    expect(result).toBeNull();
  });

  it("should return null for a token with invalid signature", () => {
    const payload: TestPayload = { id: "789", name: "Invalid Sig User" };
    const token = jwt.sign(payload, "wrong-secret", { expiresIn: "1h" });

    const result = decodeToken(token, TestSchema);

    expect(result).toBeNull();
  });

  it("should return null for a token that fails schema validation", () => {
    const invalidPayload = { id: "999", age: 25 }; // 'age' instead of 'name'
    const token = jwt.sign(invalidPayload, TEST_SECRET, { expiresIn: "1h" });

    const result = decodeToken(token, TestSchema);

    expect(result).toBeNull();
  });

  it("should return null for an expired token that also fails schema validation", () => {
    const invalidPayload = { id: "888", age: 30 }; // Missing 'name'
    const token = jwt.sign(invalidPayload, TEST_SECRET, { expiresIn: "-1h" });

    const result = decodeToken(token, TestSchema);

    expect(result).toBeNull();
  });

  it("should return null for a token without exp field", () => {
    // Create a token without exp by using noTimestamp option
    const payload: TestPayload = { id: "777", name: "No Exp User" };
    const token = jwt.sign(payload, TEST_SECRET, { noTimestamp: true });

    const result = decodeToken(token, TestSchema);

    expect(result).toBeNull();
  });
});

describe("encodeData", () => {
  it("should create a valid JWT token", () => {
    const payload: TestPayload = { id: "123", name: "Test User" };
    
    const token = encodeData(payload);

    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    
    // Verify it can be decoded
    const decoded = jwt.verify(token, TEST_SECRET) as any;
    expect(decoded.id).toBe("123");
    expect(decoded.name).toBe("Test User");
  });

  it("should respect custom expiration options", () => {
    const payload: TestPayload = { id: "456", name: "Custom Exp User" };
    
    const token = encodeData(payload, { expiresIn: "2h" });

    const decoded = jwt.verify(token, TEST_SECRET) as any;
    expect(decoded.id).toBe("456");
    
    // Verify the token has an expiration time
    expect(decoded.exp).toBeDefined();
  });
});
