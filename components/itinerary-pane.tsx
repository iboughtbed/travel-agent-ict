import type { Itinerary } from "@/ai/schemas";
import { formatDateRange } from "@/lib/itinerary";
import { CompassIcon } from "./icons";

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function modeLabel(mode: string) {
  const labels: Record<string, string> = {
    walk: "Walk",
    transit: "Local transit",
    train: "Train",
    ferry: "Ferry",
    taxi: "Taxi",
    bike: "Bike",
  };
  return labels[mode] ?? mode;
}

const paceLabel: Record<Itinerary["pace"], string> = {
  relaxed: "Relaxed pace",
  balanced: "Balanced pace",
  full: "Full days",
};

export function ItineraryPane({
  itinerary,
  isSample = false,
  onDownload,
  onAskForChanges,
}: {
  itinerary: Itinerary | null;
  isSample?: boolean;
  onDownload: () => void;
  onAskForChanges: () => void;
}) {
  if (!itinerary) {
    return (
      <section className="itinerary-empty" aria-labelledby="empty-plan-title">
        <h2 id="empty-plan-title">No itinerary yet</h2>
        <p>
          Once the plan is ready it appears here as a day-by-day route with times,
          travel between stops, costs, and sources.
        </p>
        <button type="button" className="primary-button" onClick={onAskForChanges}>
          Back to the chat
        </button>
      </section>
    );
  }

  const nights = Math.max(itinerary.days.length - 1, 0);

  return (
    <section className="itinerary-pane" aria-labelledby="trip-title">
      {isSample ? (
        <p className="sample-flag">Sample itinerary. Describe your own trip in the chat to replace it.</p>
      ) : null}

      <header className="trip-heading">
        <h1 id="trip-title">{itinerary.destination}</h1>
        <p className="trip-note">{itinerary.tripNote}</p>
        <dl className="trip-facts">
          <div>
            <dt>Dates</dt>
            <dd>{formatDateRange(itinerary.startDate, itinerary.endDate)}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>
              {itinerary.days.length} {itinerary.days.length === 1 ? "day" : "days"}
              {nights ? `, ${nights} ${nights === 1 ? "night" : "nights"}` : ""}
            </dd>
          </div>
          <div>
            <dt>Travelers</dt>
            <dd>{itinerary.travelers}, {paceLabel[itinerary.pace].toLowerCase()}</dd>
          </div>
          <div>
            <dt>Budget</dt>
            <dd>{itinerary.budgetSummary}</dd>
          </div>
        </dl>
        <div className="trip-actions">
          <button type="button" className="primary-button" onClick={onAskForChanges}>
            Ask for changes
          </button>
          <button type="button" className="secondary-button" onClick={onDownload}>
            Download PDF
          </button>
        </div>
      </header>

      <ol className="day-list">
        {itinerary.days.map((day, dayIndex) => (
          <li className="day" key={day.date}>
            <header className="day-heading">
              <p className="day-date">
                <span>Day {dayIndex + 1}</span>
                <time dateTime={day.date}>{dayLabel(day.date)}</time>
              </p>
              <h2>{day.title}</h2>
              <p className="day-summary">{day.summary}</p>
            </header>

            <ol className="stop-list">
              {day.stops.map((stop, stopIndex) => (
                <li className="stop" key={`${day.date}-${stop.time}-${stop.title}`}>
                  <div className="route-gutter" aria-hidden="true">
                    <span className="route-marker" />
                    {stopIndex < day.stops.length - 1 ? (
                      <span
                        className={`route-line ${stop.travelToNext?.status === "estimated" ? "is-estimated" : ""}`}
                      />
                    ) : null}
                  </div>
                  <time dateTime={`${day.date}T${stop.time}`}>{stop.time}</time>
                  <div className="stop-copy">
                    <div className="stop-title-line">
                      <h3>{stop.title}</h3>
                      <span>{stop.estimatedCost}</span>
                    </div>
                    <p className="stop-place">{stop.neighborhood}, about {stop.durationMinutes} min</p>
                    <p className="stop-description">{stop.description}</p>
                    {stop.sourceUrl ? (
                      <a className="stop-source" href={stop.sourceUrl} target="_blank" rel="noreferrer">
                        Official source
                      </a>
                    ) : null}
                    {stop.travelToNext ? (
                      <div className={`travel-leg ${stop.travelToNext.status === "estimated" ? "is-estimated" : ""}`}>
                        <CompassIcon width={15} height={15} />
                        <span>
                          {modeLabel(stop.travelToNext.mode)}, {stop.travelToNext.minutes} min
                          {stop.travelToNext.status === "estimated" ? " (estimate)" : ""}
                        </span>
                        <small>{stop.travelToNext.note}</small>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      {itinerary.assumptions.length ? (
        <aside className="assumptions">
          <h2>Check before you go</h2>
          <ul>
            {itinerary.assumptions.map(assumption => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </aside>
      ) : null}
    </section>
  );
}
