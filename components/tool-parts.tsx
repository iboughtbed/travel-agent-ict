"use client";

import { useState } from "react";
import type { TravelMessage } from "@/ai/travel-agent";
import { CheckIcon, CompassIcon } from "./icons";

type MessagePart = TravelMessage["parts"][number];

function ToolStatus({ label }: { label: string }) {
  return (
    <div className="tool-status" role="status">
      <span className="tool-pulse" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function ToolError({ message }: { message: string }) {
  return (
    <div className="tool-error" role="status">
      <span>{message}</span>
    </div>
  );
}

export function ToolPartRenderer({
  part,
  addClarificationOutput,
  onOpenItinerary,
}: {
  part: MessagePart;
  addClarificationOutput: (
    toolCallId: string,
    output: { value: string; label: string },
  ) => void;
  onOpenItinerary: () => void;
}) {
  if (part.type === "tool-askTripQuestion") {
    if (part.state === "input-streaming") {
      return <ToolStatus label="Writing a question" />;
    }

    if (part.state === "input-available") {
      return (
        <ClarificationForm
          input={part.input}
          onChoose={output => addClarificationOutput(part.toolCallId, output)}
        />
      );
    }

    if (part.state === "output-available") {
      return (
        <div className="choice-receipt">
          <CheckIcon width={17} height={17} />
          <span>{part.output.label}</span>
        </div>
      );
    }

    if (part.state === "output-error") {
      return <ToolError message={part.errorText} />;
    }

    return null;
  }

  if (part.type === "tool-checkWeather") {
    if (part.state === "input-streaming" || part.state === "input-available") {
      return <ToolStatus label="Checking the forecast" />;
    }

    if (part.state === "output-error") {
      return <ToolError message="Weather data did not load. Ask me to retry the forecast." />;
    }

    if (part.state === "output-available") {
      return (
        <section className="weather-result" aria-label="Destination forecast">
          <header>
            <strong>
              Forecast for {part.output.place.name}, {part.output.place.country}
            </strong>
          </header>
          <div className="weather-days">
            {part.output.days.map(day => (
              <div key={day.date}>
                <time dateTime={day.date}>
                  {new Intl.DateTimeFormat("en", {
                    weekday: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${day.date}T00:00:00Z`))}
                </time>
                <strong>{day.highC}°</strong>
                <span>{day.condition}</span>
                <small>{day.precipitationChance}% rain</small>
              </div>
            ))}
          </div>
          <p>Source: {part.output.source}</p>
        </section>
      );
    }

    return null;
  }

  if (part.type === "tool-showPlaceShortlist") {
    if (part.state === "input-streaming" || part.state === "input-available") {
      return <ToolStatus label="Putting together a shortlist" />;
    }

    if (part.state === "output-error") {
      return <ToolError message="The place shortlist could not be prepared." />;
    }

    if (part.state === "output-available") {
      return (
        <section className="place-result" aria-label="Place shortlist">
          <header>
            <strong>Places worth choosing between in {part.output.destination}</strong>
          </header>
          <ol>
            {part.output.places.map(place => (
              <li key={`${place.name}-${place.neighborhood}`}>
                <div className="place-index" aria-hidden="true" />
                <div>
                  <div className="place-title">
                    <strong>{place.name}</strong>
                    <span>{place.costBand}</span>
                  </div>
                  <small>
                    {place.category}, {place.neighborhood}, {place.durationMinutes} min
                  </small>
                  <p>{place.reason}</p>
                  {place.sourceUrl ? (
                    <a href={place.sourceUrl} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      );
    }

    return null;
  }

  if (part.type === "tool-publishItinerary") {
    if (part.state === "input-streaming" || part.state === "input-available") {
      return <ToolStatus label="Laying out the days" />;
    }

    if (part.state === "output-error") {
      return <ToolError message="The itinerary did not save. Ask for it again and it will be rebuilt." />;
    }

    if (part.state === "output-available") {
      return (
        <div className="itinerary-receipt">
          <CompassIcon width={18} height={18} />
          <div>
            <strong>Itinerary updated</strong>
            <span>
              {part.output.days.length} {part.output.days.length === 1 ? "day" : "days"} in {part.output.destination}
            </span>
          </div>
          <button type="button" onClick={onOpenItinerary}>Open itinerary</button>
        </div>
      );
    }

    return null;
  }

  if (part.type === "tool-web_search") {
    if (part.state === "output-error") {
      return <ToolError message="The web search failed, so hours and fares are unverified." />;
    }
    if (part.state === "output-available") {
      return (
        <div className="research-receipt">
          <CheckIcon width={16} height={16} />
          <span>Checked current hours and fares</span>
        </div>
      );
    }
    return <ToolStatus label="Checking current hours and fares" />;
  }

  return null;
}

function ClarificationForm({
  input,
  onChoose,
}: {
  input: {
    question: string;
    context: string;
    options: Array<{ label: string; value: string; detail: string }>;
  };
  onChoose: (output: { value: string; label: string }) => void;
}) {
  const [choice, setChoice] = useState<string>("");
  const selected = input.options.find(option => option.value === choice);

  return (
    <fieldset className="clarification">
      <legend>{input.question}</legend>
      <p>{input.context}</p>
      <div className="choice-list">
        {input.options.map(option => (
          <label key={option.value}>
            <input
              type="radio"
              name={`trip-question-${input.question}`}
              value={option.value}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.detail}</small>
            </span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="small-primary"
        disabled={!selected}
        onClick={() => selected && onChoose({ value: selected.value, label: selected.label })}
      >
        Continue
      </button>
    </fieldset>
  );
}
