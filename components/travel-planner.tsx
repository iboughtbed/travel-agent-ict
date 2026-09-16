"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type FileUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import type { TravelMessage } from "@/ai/travel-agent";
import { findLatestItinerary } from "@/lib/itinerary";
import { sampleTrip } from "@/lib/sample-trip";
import {
  clearActiveChat,
  loadActiveChat,
  saveActiveChat,
} from "@/lib/browser-chat-store";
import { ChatComposer, type ComposerHandle } from "./chat-composer";
import { ConversationPane } from "./conversation-pane";
import { CheckIcon, CompassIcon } from "./icons";
import { ItineraryPane } from "./itinerary-pane";

type View = "chat" | "itinerary";

const starters = [
  "Five quiet days in Lisbon under €1,400, no car",
  "A food weekend in Tbilisi for two",
  "Kyoto in November at a relaxed pace",
  "Four accessible days in Copenhagen",
];

export function TravelPlanner() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const [sampleVisible, setSampleVisible] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [seenRevision, setSeenRevision] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const composerRef = useRef<ComposerHandle>(null);

  const {
    messages,
    setMessages,
    sendMessage,
    addToolOutput,
    status,
    error,
    stop,
    regenerate,
  } = useChat<TravelMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const generatedItinerary = findLatestItinerary(messages);
  const itinerary = generatedItinerary ?? (sampleVisible ? sampleTrip : null);
  const busy = status === "submitted" || status === "streaming";
  const started = messages.length > 0 || Boolean(itinerary);
  const itineraryUnseen =
    Boolean(itinerary) && view !== "itinerary" && seenRevision !== itinerary?.revisionId;

  useEffect(() => {
    loadActiveChat()
      .then(stored => {
        if (stored.length) setMessages(stored);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, [setMessages]);

  useEffect(() => {
    if (!hydrated || busy) return;
    const timeout = window.setTimeout(() => {
      saveActiveChat(messages)
        .then(() => {
          if (messages.length) {
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1800);
          }
        })
        .catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [busy, hydrated, messages]);

  function showItinerary() {
    setView("itinerary");
    if (itinerary) setSeenRevision(itinerary.revisionId);
    window.scrollTo({ top: 0 });
  }

  function showChat(focusComposer = false) {
    setView("chat");
    if (focusComposer) window.setTimeout(() => composerRef.current?.focus(), 0);
  }

  async function handleSend(text: string, files: FileUIPart[]) {
    setSampleVisible(false);
    setView("chat");
    await sendMessage({ text, files });
  }

  async function startOver() {
    stop();
    setMessages([]);
    setSampleVisible(false);
    setView("chat");
    setSeenRevision(null);
    await clearActiveChat().catch(() => undefined);
  }

  function downloadTrip() {
    if (!itinerary) return;
    // A real form submission is the one download path that works everywhere,
    // including iOS Safari and in-app browsers where blob links and print
    // dialogs are unreliable. The server answers with a PDF attachment, so
    // the page itself does not navigate.
    const form = document.createElement("form");
    form.method = "post";
    form.action = "/api/itinerary/pdf";
    form.style.display = "none";
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = "itinerary";
    field.value = JSON.stringify(itinerary);
    form.append(field);
    document.body.append(form);
    form.submit();
    form.remove();
  }

  return (
    <main className="planner">
      <header className="app-header">
        <button className="wordmark" type="button" onClick={() => void startOver()} aria-label="Elsewhere home">
          <span className="wordmark-mark"><CompassIcon width={18} height={18} /></span>
          <span>Elsewhere</span>
        </button>

        {started ? (
          <div className="view-switch" role="tablist" aria-label="Workspace view">
            <button
              type="button"
              role="tab"
              aria-selected={view === "chat"}
              className={view === "chat" ? "is-active" : ""}
              onClick={() => showChat()}
            >
              Chat
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "itinerary"}
              className={view === "itinerary" ? "is-active" : ""}
              onClick={showItinerary}
              disabled={!itinerary}
            >
              Itinerary
              {itineraryUnseen ? <span className="view-dot" aria-label="updated" /> : null}
            </button>
          </div>
        ) : null}

        <div className="header-actions">
          {saved ? <span className="saved-state"><CheckIcon width={14} height={14} /> Saved</span> : null}
          {started ? <button type="button" onClick={() => void startOver()}>New trip</button> : null}
        </div>
      </header>

      {!started ? (
        <section className="opening">
          <div className="opening-copy">
            <h1>Where do you want to go?</h1>
            <p className="opening-intro">
              Give me dates, a budget, and how fast you like to move. Attach a screenshot,
              a list, or a PDF if the details are already written down somewhere.
            </p>
            <ChatComposer ref={composerRef} busy={busy} onSend={handleSend} onStop={stop} />
            <div className="starter-list" aria-label="Example requests">
              {starters.map(starter => (
                <button type="button" key={starter} onClick={() => void handleSend(starter, [])}>
                  {starter}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setSampleVisible(true);
                setView("itinerary");
              }}
            >
              See a sample itinerary
            </button>
          </div>
        </section>
      ) : view === "chat" ? (
        <ConversationPane
          ref={composerRef}
          messages={messages}
          busy={busy}
          error={error}
          previewingSample={sampleVisible && !generatedItinerary}
          onSend={handleSend}
          onStop={stop}
          onRetry={() => void regenerate()}
          onOpenItinerary={showItinerary}
          onClarification={(toolCallId, output) => {
            void addToolOutput({
              tool: "askTripQuestion",
              toolCallId,
              output,
            });
          }}
        />
      ) : (
        <div className="itinerary-view">
          <ItineraryPane
            itinerary={itinerary}
            isSample={sampleVisible && !generatedItinerary}
            onDownload={downloadTrip}
            onAskForChanges={() => showChat(true)}
          />
        </div>
      )}
    </main>
  );
}
