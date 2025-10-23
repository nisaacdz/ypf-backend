import { describe, it, expect } from "vitest";
import { rateLimit } from "../../shared/middlewares/rateLimit";

describe("rateLimit middleware", () => {
  it("should create a middleware function", () => {
    const middleware = rateLimit(10);
    expect(typeof middleware).toBe("function");
  });

  it("should accept different max request values", () => {
    const middleware1 = rateLimit(10);
    const middleware2 = rateLimit(50);
    const middleware3 = rateLimit(100);

    expect(typeof middleware1).toBe("function");
    expect(typeof middleware2).toBe("function");
    expect(typeof middleware3).toBe("function");
  });

  it("should be usable as Express middleware", () => {
    const middleware = rateLimit(50);

    // Check that it has the expected signature
    expect(middleware.length).toBe(3); // req, res, next
  });
});
