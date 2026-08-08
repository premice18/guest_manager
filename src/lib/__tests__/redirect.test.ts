import { describe, it, expect } from "vitest";
import { isSafeRedirect } from "@/lib/redirect";

describe("isSafeRedirect", () => {
  it("accepte un chemin local simple", () => {
    expect(isSafeRedirect("/dashboard")).toBe(true);
    expect(isSafeRedirect("/event/abc")).toBe(true);
    expect(isSafeRedirect("/dashboard?tab=stats")).toBe(true);
  });

  it("rejette les URLs absolues", () => {
    expect(isSafeRedirect("https://evil.com")).toBe(false);
    expect(isSafeRedirect("http://evil.com")).toBe(false);
  });

  it("rejette les chemins protocol-relative", () => {
    expect(isSafeRedirect("//evil.com")).toBe(false);
    expect(isSafeRedirect("\\evil.com")).toBe(false);
  });

  it("rejette les chemins qui imitent une URL absolue", () => {
    expect(isSafeRedirect("/\\evil.com")).toBe(false);
  });

  it("rejette les valeurs qui ne commencent pas par /", () => {
    expect(isSafeRedirect("dashboard")).toBe(false);
    expect(isSafeRedirect("")).toBe(false);
    expect(isSafeRedirect("javascript:alert(1)")).toBe(false);
  });
});