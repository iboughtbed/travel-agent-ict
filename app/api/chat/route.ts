import { createAgentUIStreamResponse } from "ai";
import { travelAgent } from "@/ai/travel-agent";
import { validateMessageAttachments } from "@/lib/attachments";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Add OPENAI_API_KEY to .env.local before starting a plan." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { messages?: unknown[] };

    if (!Array.isArray(body.messages) || body.messages.length > 120) {
      return Response.json(
        { error: "The conversation could not be read." },
        { status: 400 },
      );
    }

    validateMessageAttachments(body.messages);

    return createAgentUIStreamResponse({
      agent: travelAgent,
      uiMessages: body.messages,
      abortSignal: request.signal,
      sendSources: true,
      timeout: { totalMs: 55_000 },
      onError: error => {
        console.error("Travel agent stream failed", error);
        return "The plan could not be completed. Try the request again.";
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The request could not be read.";
    return Response.json({ error: message }, { status: 400 });
  }
}
