# Elsewhere

Elsewhere is a conversational travel planner built around a readable itinerary rather than a stack of chat bubbles. The assistant researches current details, asks focused questions, checks near-term weather, presents place choices, and publishes a structured day-by-day route into the workspace.

## Run it

Requirements: Bun 1.4.2 and an OpenAI API key with access to `gpt-5.6-luna`.

```bash
bun install
cp .env.example .env.local
# Add a fresh OPENAI_API_KEY to .env.local
bun run dev
```

Open the local URL printed by Next.js. The API key stays on the server and `.env.local` is ignored by Git.

## Included

- AI SDK 7 `ToolLoopAgent` on the OpenAI Responses API
- `gpt-5.6-luna` as the default model
- streaming chat with browser-local conversation storage
- web search, live Open-Meteo forecasts, clarification choices, place shortlists, and structured itinerary publishing
- image, PDF, plain-text, and CSV attachments with client and server validation
- one centered layout for phone and desktop with a Chat / Itinerary switch, reduced-motion support, and PDF export through the print dialog

## Checks

```bash
bun test
bun run typecheck
bun run build
```

The sample itinerary is available without an API key, so the interface can be reviewed before connecting the model.
