import { describe, expect, test } from "bun:test";
import { formatDateRange } from "@/lib/itinerary";

describe("itinerary formatting", () => {
  test("formats dates without local timezone drift", () => {
    expect(formatDateRange("2026-10-12", "2026-10-14")).toBe("Oct 12 to Oct 14");
  });
});
