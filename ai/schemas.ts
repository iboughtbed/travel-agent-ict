import { z } from "zod";

export const travelModeSchema = z.enum([
  "walk",
  "transit",
  "train",
  "ferry",
  "taxi",
  "bike",
]);

// Field limits are generous on purpose. The model occasionally writes a two
// sentence budget note or assumption, and a hard cap used to reject the whole
// itinerary. The agent instructions ask for short fields; these caps only stop
// runaway output.
const shortText = (max: number) => z.string().trim().min(1).max(max);

export const travelLegSchema = z.object({
  mode: travelModeSchema,
  minutes: z.number().int().min(1).max(360),
  note: shortText(300),
  status: z.enum(["checked", "estimated"]),
});

export const itineraryStopSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  title: shortText(120),
  neighborhood: shortText(100),
  kind: z.enum(["sight", "food", "rest", "culture", "nature", "travel"]),
  durationMinutes: z.number().int().min(15).max(720),
  description: shortText(500),
  estimatedCost: shortText(60),
  sourceUrl: z.string().url().nullable(),
  travelToNext: travelLegSchema.nullable(),
});

export const itineraryDaySchema = z.object({
  date: z.string().date(),
  title: shortText(100),
  summary: shortText(360),
  stops: z.array(itineraryStopSchema).min(1).max(8),
});

export const itineraryInputSchema = z.object({
  destination: shortText(100),
  country: shortText(100),
  startDate: z.string().date(),
  endDate: z.string().date(),
  travelers: z.number().int().min(1).max(20),
  pace: z.enum(["relaxed", "balanced", "full"]),
  currency: z.string().length(3),
  budgetSummary: shortText(400),
  tripNote: shortText(500),
  days: z.array(itineraryDaySchema).min(1).max(14),
  assumptions: z.array(shortText(400)).max(10),
});

export const itineraryOutputSchema = itineraryInputSchema.extend({
  revisionId: z.string(),
  generatedAt: z.string().datetime(),
});

export const clarificationInputSchema = z.object({
  question: shortText(240),
  context: shortText(360),
  options: z
    .array(
      z.object({
        label: shortText(80),
        value: shortText(80),
        detail: shortText(200),
      }),
    )
    .min(2)
    .max(5),
});

export const clarificationOutputSchema = z.object({
  value: shortText(80),
  label: shortText(80),
});

export const placeShortlistInputSchema = z.object({
  destination: shortText(100),
  places: z
    .array(
      z.object({
        name: shortText(120),
        neighborhood: shortText(100),
        category: shortText(60),
        reason: shortText(360),
        durationMinutes: z.number().int().min(15).max(480),
        costBand: shortText(60),
        sourceUrl: z.string().url().nullable(),
      }),
    )
    .min(2)
    .max(8),
});

export type Itinerary = z.infer<typeof itineraryOutputSchema>;
export type ItineraryInput = z.infer<typeof itineraryInputSchema>;
export type ClarificationInput = z.infer<typeof clarificationInputSchema>;
export type PlaceShortlist = z.infer<typeof placeShortlistInputSchema>;
