import { describe, it, expect } from "vitest";
import { uuidSchema } from "@/lib/auth";

describe("uuidSchema", () => {
  it("accepte un UUID valide", () => {
    expect(uuidSchema.safeParse("123e4567-e89b-42d3-a456-426614174000").success).toBe(true);
  });

  it("rejette un ID non-UUID", () => {
    expect(uuidSchema.safeParse("abc").success).toBe(false);
    expect(uuidSchema.safeParse("").success).toBe(false);
    expect(uuidSchema.safeParse("123e4567-e89b-42d3-a456").success).toBe(false);
  });

  it("rejette les valeurs non-strings injectées", () => {
    const result = uuidSchema.safeParse(";DROP TABLE guests;");
    expect(result.success).toBe(false);
  });
});