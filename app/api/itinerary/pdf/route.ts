import { itineraryOutputSchema } from "@/ai/schemas";
import { renderItineraryPdf } from "@/lib/itinerary-pdf";

export const maxDuration = 30;

const MAX_BODY_BYTES = 400_000;

// The itinerary lives in the browser, so the client posts it here as a form
// field. A form submission (rather than fetch + blob) is what makes the
// download work in mobile browsers and in-app webviews.
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return Response.json({ error: "The itinerary is too large to export." }, { status: 413 });
  }

  let raw: unknown;
  try {
    const form = await request.formData();
    raw = JSON.parse(String(form.get("itinerary") ?? ""));
  } catch {
    return Response.json({ error: "The itinerary could not be read." }, { status: 400 });
  }

  const parsed = itineraryOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "The itinerary could not be read." }, { status: 400 });
  }

  const bytes = await renderItineraryPdf(parsed.data);
  const slug = parsed.data.destination.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "trip";

  return new Response(new Blob([bytes as BlobPart], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}-itinerary.pdf"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
