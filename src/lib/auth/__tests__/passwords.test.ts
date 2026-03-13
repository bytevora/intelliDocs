import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../passwords";

describe("passwords", () => {
  it("hashes a password and verifies it correctly", async () => {
    const password = "testpassword123";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(0);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-password");
    const isValid = await verifyPassword("wrong-password", hash);
    expect(isValid).toBe(false);
  });

  it("produces different hashes for the same password (salted)", async () => {
    const password = "samepassword";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
  });
});
