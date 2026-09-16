import { openai } from "@ai-sdk/openai";
import { tool } from "ai";
import { z } from "zod";
import {
  clarificationInputSchema,
  clarificationOutputSchema,
  itineraryInputSchema,
  itineraryOutputSchema,
  placeShortlistInputSchema,
} from "./schemas";
import { getDestinationWeather } from "./weather";

export const askTripQuestion = tool({
  title: "Ask a trip question",
  description:
    "Ask one short question when a missing trip constraint would materially change the itinerary. Prefer concrete answer choices.",
  inputSchema: clarificationInputSchema,
  outputSchema: clarificationOutputSchema,
});

export const checkWeather = tool({
  title: "Check destination weather",
  description:
    "Get a daily forecast for a destination and date range. Use this before publishing an itinerary when the dates fall within the available forecast window.",
  inputSchema: z.object({
    destination: z.string().min(1).max(100),
    startDate: z.string().date(),
    endDate: z.string().date(),
  }),
  execute: getDestinationWeather,
});

export const showPlaceShortlist = tool({
  title: "Show place shortlist",
  description:
    "Present a researched shortlist of places that match the trip. Call this after web research and before publishing the itinerary when choosing among places helps the traveler.",
  inputSchema: placeShortlistInputSchema,
  execute: async input => ({
    ...input,
    reviewedAt: new Date().toISOString(),
  }),
});

export const publishItinerary = tool({
  title: "Publish itinerary",
  description:
    "Publish the complete itinerary to the travel workspace. Use only after dates and destination are known. Keep each day geographically practical and include travel time between stops.",
  inputSchema: itineraryInputSchema,
  outputSchema: itineraryOutputSchema,
  execute: async input => ({
    ...input,
    revisionId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
  }),
});

export const travelTools = {
  web_search: openai.tools.webSearch({
    searchContextSize: "medium",
  }),
  askTripQuestion,
  checkWeather,
  showPlaceShortlist,
  publishItinerary,
};
