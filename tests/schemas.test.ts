import { describe, expect, test } from "bun:test";
import {
  clarificationInputSchema,
  itineraryInputSchema,
} from "@/ai/schemas";
import { sampleTrip } from "@/lib/sample-trip";

describe("travel schemas", () => {
  test("accepts the sample itinerary as publish input", () => {
    const { revisionId: _revisionId, generatedAt: _generatedAt, ...input } = sampleTrip;
    expect(itineraryInputSchema.safeParse(input).success).toBe(true);
  });

  test("rejects impossible stop times", () => {
    const { revisionId: _revisionId, generatedAt: _generatedAt, ...input } = sampleTrip;
    input.days[0]!.stops[0]!.time = "27:15";
    expect(itineraryInputSchema.safeParse(input).success).toBe(false);
  });

  test("requires useful clarification choices", () => {
    expect(
      clarificationInputSchema.safeParse({
        question: "Which pace suits you?",
        context: "This changes how many stops fit each day.",
        options: [{ label: "Relaxed", value: "relaxed", detail: "Long breaks" }],
      }).success,
    ).toBe(false);
  });
});
