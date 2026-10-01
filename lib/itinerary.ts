import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import type { TravelMessage } from "@/ai/travel-agent";
import type { Itinerary } from "@/ai/schemas";

export function findLatestItinerary(
  messages: TravelMessage[],
): Itinerary | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const parts = messages[messageIndex]?.parts ?? [];
    for (let partIndex = parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = parts[partIndex];
      if (
        part?.type === "tool-publishItinerary" &&
        part.state === "output-available"
      ) {
        return part.output;
      }
    }
  }
  return null;
}

// The open askTripQuestion call in the latest assistant message, if the
// traveler has not answered it yet. Typed replies answer it instead of
// starting a new message, which would leave the tool call without a result.
export function findPendingQuestion(messages: TravelMessage[]) {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return null;
  for (const part of last.parts) {
    if (part.type === "tool-askTripQuestion" && part.state === "input-available") {
      return part;
    }
  }
  return null;
}

// Resume the agent only after the traveler answers a question. Other tool
// calls run on the server, and a turn that ends on publishItinerary is done.
export function shouldResumeAfterAnswer({ messages }: { messages: TravelMessage[] }) {
  if (!lastAssistantMessageIsCompleteWithToolCalls({ messages })) return false;
  const parts = messages.at(-1)?.parts ?? [];
  const lastStep = parts.slice(parts.findLastIndex(part => part.type === "step-start"));
  return lastStep.some(part => part.type === "tool-askTripQuestion");
}

export function formatDateRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${startDate}T00:00:00Z`))} to ${formatter.format(new Date(`${endDate}T00:00:00Z`))}`;
}
