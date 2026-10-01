import { describe, expect, test } from "bun:test";
import type { TravelMessage } from "@/ai/travel-agent";
import { findPendingQuestion, formatDateRange } from "@/lib/itinerary";

describe("itinerary formatting", () => {
  test("formats dates without local timezone drift", () => {
    expect(formatDateRange("2026-10-12", "2026-10-14")).toBe("Oct 12 to Oct 14");
  });
});

describe("pending trip questions", () => {
  const question: TravelMessage["parts"][number] = {
    type: "tool-askTripQuestion",
    toolCallId: "call-1",
    state: "input-available",
    input: {
      question: "When are you going?",
      context: "Dates decide the season.",
      options: [
        { label: "October", value: "oct", detail: "Mild" },
        { label: "December", value: "dec", detail: "Cold" },
      ],
    },
  };

  test("finds an unanswered question in the latest assistant message", () => {
    const messages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "Lisbon" }] },
      { id: "2", role: "assistant", parts: [question] },
    ] satisfies TravelMessage[];
    expect(findPendingQuestion(messages)?.toolCallId).toBe("call-1");
  });

  test("ignores questions that are no longer the latest turn", () => {
    const messages = [
      { id: "2", role: "assistant", parts: [question] },
      { id: "3", role: "user", parts: [{ type: "text", text: "October" }] },
    ] satisfies TravelMessage[];
    expect(findPendingQuestion(messages)).toBeNull();
  });
});
