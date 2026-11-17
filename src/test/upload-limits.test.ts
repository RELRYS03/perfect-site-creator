import { describe, expect, it } from "vitest";
import { isSTLFileWithinLimit } from "@/lib/studio/uploadLimits";

describe("STL upload limit", () => {
  it("accepts files up to and including 500 MB", () => {
    expect(isSTLFileWithinLimit(21 * 1024 * 1024)).toBe(true);
    expect(isSTLFileWithinLimit(500 * 1024 * 1024)).toBe(true);
    expect(isSTLFileWithinLimit(500 * 1024 * 1024 + 1)).toBe(false);
  });
});