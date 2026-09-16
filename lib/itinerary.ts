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

export function formatDateRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${startDate}T00:00:00Z`))} to ${formatter.format(new Date(`${endDate}T00:00:00Z`))}`;
}
