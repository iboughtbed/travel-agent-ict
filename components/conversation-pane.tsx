"use client";

import { forwardRef, useEffect, useRef } from "react";
import type { TravelMessage } from "@/ai/travel-agent";
import type { FileUIPart } from "ai";
import { ChatComposer, type ComposerHandle } from "./chat-composer";
import { FileIcon } from "./icons";
import { ToolPartRenderer } from "./tool-parts";

type ConversationPaneProps = {
  messages: TravelMessage[];
  busy: boolean;
  error: Error | undefined;
  previewingSample: boolean;
  onSend: (text: string, files: FileUIPart[]) => Promise<void>;
  onStop: () => void;
  onRetry: () => void;
  onOpenItinerary: () => void;
  onClarification: (
    toolCallId: string,
    output: { value: string; label: string },
  ) => void;
};

export const ConversationPane = forwardRef<ComposerHandle, ConversationPaneProps>(
  function ConversationPane(
    {
      messages,
      busy,
      error,
      previewingSample,
      onSend,
      onStop,
      onRetry,
      onOpenItinerary,
      onClarification,
    },
    ref,
  ) {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (messages.length || busy) {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }, [busy, messages]);

    return (
      <section className="conversation" aria-label="Conversation">
        <div className="message-list" aria-live="polite" aria-relevant="additions text">
          {previewingSample && messages.length === 0 ? (
            <div className="sample-note">
              <strong>You are looking at a sample route.</strong>
              <p>Describe your own dates, budget, and pace to replace it.</p>
            </div>
          ) : null}

          {messages.map(message => (
            <article className={`message is-${message.role}`} key={message.id}>
              <div className="message-parts">
                {message.parts.map((part, index) => {
                  const key = `${message.id}-${index}`;

                  if (part.type === "text") {
                    return (
                      <p className="message-text" key={key}>
                        {part.text}
                      </p>
                    );
                  }

                  if (part.type === "file") {
                    return (
                      <div className="message-file" key={key}>
                        {part.mediaType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={part.url} alt={part.filename ?? "Attached image"} />
                        ) : (
                          <FileIcon />
                        )}
                        <span>{part.filename ?? "Attached file"}</span>
                      </div>
                    );
                  }

                  if (part.type === "source-url") {
                    return (
                      <a className="source-link" href={part.url} target="_blank" rel="noreferrer" key={key}>
                        {part.title ?? part.url}
                      </a>
                    );
                  }

                  if (part.type.startsWith("tool-")) {
                    return (
                      <ToolPartRenderer
                        key={key}
                        part={part}
                        addClarificationOutput={onClarification}
                        onOpenItinerary={onOpenItinerary}
                      />
                    );
                  }

                  return null;
                })}
              </div>
            </article>
          ))}

          {busy ? <div className="thinking-line">Working on the next part of your route</div> : null}

          {error ? (
            <div className="chat-error" role="alert">
              <p>{error.message || "The request stopped before the plan was ready."}</p>
              <button type="button" onClick={onRetry}>Try again</button>
            </div>
          ) : null}
          <div ref={endRef} className="message-end" />
        </div>

        <div className="composer-dock">
          <ChatComposer ref={ref} compact busy={busy} onSend={onSend} onStop={onStop} />
        </div>
      </section>
    );
  },
);
