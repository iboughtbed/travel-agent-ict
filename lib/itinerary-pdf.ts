import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb, type RGB } from "pdf-lib";
import type { Itinerary } from "@/ai/schemas";
import { formatDateRange } from "./itinerary";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TIME_COLUMN = 44;
const GUTTER = 22;
const STOP_TEXT_X = MARGIN + TIME_COLUMN + GUTTER;
const STOP_TEXT_WIDTH = CONTENT_WIDTH - TIME_COLUMN - GUTTER;

const ink = rgb(0.106, 0.165, 0.192);
const ink2 = rgb(0.357, 0.416, 0.439);
const route = rgb(0.169, 0.333, 0.839);
const line = rgb(0.882, 0.902, 0.894);

type Fonts = { regular: PDFFont; semibold: PDFFont };

type TextOptions = {
  font: PDFFont;
  size: number;
  color?: RGB;
  x?: number;
  width?: number;
  lineHeight?: number;
};

const modeLabels: Record<string, string> = {
  walk: "Walk",
  transit: "Local transit",
  train: "Train",
  ferry: "Ferry",
  taxi: "Taxi",
  bike: "Bike",
};

const paceLabels: Record<Itinerary["pace"], string> = {
  relaxed: "relaxed pace",
  balanced: "balanced pace",
  full: "full days",
};

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

let fontCache: Promise<{ regular: Uint8Array; semibold: Uint8Array }> | null = null;

function loadFontFiles() {
  fontCache ??= Promise.all([
    readFile(path.join(process.cwd(), "assets/fonts/Onest-Regular.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/Onest-SemiBold.ttf")),
  ]).then(([regular, semibold]) => ({ regular, semibold }));
  return fontCache;
}

// Writes text top-down with word wrapping and page breaks. pdf-lib's origin is
// the bottom-left corner, so `y` here is the distance from the top of the page.
class Writer {
  page: PDFPage;
  y = MARGIN;
  private supported: Set<number>;

  constructor(
    private pdf: PDFDocument,
    private fonts: Fonts,
  ) {
    this.page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.supported = new Set(fonts.regular.getCharacterSet());
  }

  private clean(text: string) {
    let dropped = false;
    const kept = Array.from(text.replace(/\s+/g, " ")).filter(char => {
      const ok = this.supported.has(char.codePointAt(0) ?? -1);
      if (!ok) dropped = true;
      return ok;
    });
    return kept.join("").replace(/\s{2,}/g, " ").trim() + (dropped && !kept.length ? "?" : "");
  }

  wrap(text: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    for (const paragraph of this.clean(text).split("\n")) {
      let current = "";
      for (const word of paragraph.split(" ")) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          current = candidate;
          continue;
        }
        if (current) lines.push(current);
        current = word;
        // A single word wider than the column is broken by character.
        while (font.widthOfTextAtSize(current, size) > width && current.length > 1) {
          let cut = current.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(current.slice(0, cut), size) > width) cut -= 1;
          lines.push(current.slice(0, cut));
          current = current.slice(cut);
        }
      }
      lines.push(current);
    }
    return lines;
  }

  ensure(height: number) {
    if (this.y + height > PAGE_HEIGHT - MARGIN) this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = MARGIN;
  }

  space(points: number) {
    this.y += points;
  }

  rule(color = line, x = MARGIN, width = CONTENT_WIDTH) {
    this.page.drawLine({
      start: { x, y: PAGE_HEIGHT - this.y },
      end: { x: x + width, y: PAGE_HEIGHT - this.y },
      thickness: 0.6,
      color,
    });
  }

  text(text: string, options: TextOptions) {
    const {
      font,
      size,
      color = ink,
      x = MARGIN,
      width = CONTENT_WIDTH,
      lineHeight = size * 1.4,
    } = options;
    const lines = this.wrap(text, font, size, width);
    for (const [index, value] of lines.entries()) {
      if (index === 0) this.ensure(lineHeight);
      else if (this.y + lineHeight > PAGE_HEIGHT - MARGIN) this.newPage();
      this.page.drawText(value, {
        x,
        y: PAGE_HEIGHT - this.y - size,
        size,
        font,
        color,
      });
      this.y += lineHeight;
    }
    return lines.length;
  }

  // Draws a single line of text at an absolute position without moving the cursor.
  label(text: string, x: number, y: number, options: Omit<TextOptions, "x" | "width" | "lineHeight">) {
    this.page.drawText(this.clean(text), {
      x,
      y: PAGE_HEIGHT - y - options.size,
      size: options.size,
      font: options.font,
      color: options.color ?? ink,
    });
  }

  heightOf(text: string, font: PDFFont, size: number, width: number, lineHeight = size * 1.4) {
    return this.wrap(text, font, size, width).length * lineHeight;
  }
}

export async function renderItineraryPdf(itinerary: Itinerary) {
  const files = await loadFontFiles();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts: Fonts = {
    regular: await pdf.embedFont(files.regular, { subset: true }),
    semibold: await pdf.embedFont(files.semibold, { subset: true }),
  };
  pdf.setTitle(`${itinerary.destination} itinerary`);
  pdf.setProducer("Elsewhere");
  pdf.setCreator("Elsewhere");

  const w = new Writer(pdf, fonts);

  // Trip heading
  w.text(itinerary.destination, { font: fonts.semibold, size: 30, lineHeight: 34 });
  w.space(4);
  w.text(itinerary.tripNote, { font: fonts.regular, size: 11.5, color: ink2, width: CONTENT_WIDTH * 0.85 });
  w.space(16);

  const nights = Math.max(itinerary.days.length - 1, 0);
  const facts: Array<[string, string]> = [
    ["Dates", formatDateRange(itinerary.startDate, itinerary.endDate)],
    [
      "Length",
      `${itinerary.days.length} ${itinerary.days.length === 1 ? "day" : "days"}${nights ? `, ${nights} ${nights === 1 ? "night" : "nights"}` : ""}`,
    ],
    ["Travelers", `${itinerary.travelers}, ${paceLabels[itinerary.pace]}`],
    ["Budget", itinerary.budgetSummary],
  ];
  w.rule(rgb(0.77, 0.8, 0.79));
  for (const [key, value] of facts) {
    w.space(7);
    const valueHeight = w.heightOf(value, fonts.regular, 10.5, CONTENT_WIDTH - 90, 14);
    w.ensure(valueHeight + 8);
    w.label(key, MARGIN, w.y, { font: fonts.regular, size: 9.5, color: ink2 });
    w.text(value, { font: fonts.regular, size: 10.5, x: MARGIN + 90, width: CONTENT_WIDTH - 90, lineHeight: 14 });
    w.space(6);
    w.rule();
  }

  // Days
  for (const [dayIndex, day] of itinerary.days.entries()) {
    w.space(28);
    const headingHeight =
      14 + w.heightOf(day.title, fonts.semibold, 17, CONTENT_WIDTH, 21) + w.heightOf(day.summary, fonts.regular, 10.5, CONTENT_WIDTH * 0.85, 14) + 40;
    w.ensure(Math.min(headingHeight, PAGE_HEIGHT / 3));
    w.text(`Day ${dayIndex + 1}, ${dayLabel(day.date)}`, { font: fonts.semibold, size: 9.5, color: route, lineHeight: 14 });
    w.space(2);
    w.text(day.title, { font: fonts.semibold, size: 17, lineHeight: 21 });
    w.space(2);
    w.text(day.summary, { font: fonts.regular, size: 10.5, color: ink2, width: CONTENT_WIDTH * 0.85, lineHeight: 14 });
    w.space(14);

    for (const [stopIndex, stop] of day.stops.entries()) {
      const place = `${stop.neighborhood}, about ${stop.durationMinutes} min`;
      const costWidth = fonts.regular.widthOfTextAtSize(stop.estimatedCost, 9.5) + 12;
      const titleWidth = STOP_TEXT_WIDTH - costWidth;
      const blockHeight =
        w.heightOf(stop.title, fonts.semibold, 11.5, titleWidth, 15) +
        w.heightOf(place, fonts.regular, 9.5, STOP_TEXT_WIDTH, 13) +
        4 +
        w.heightOf(stop.description, fonts.regular, 10.5, STOP_TEXT_WIDTH, 14.5);
      w.ensure(Math.min(blockHeight + 20, PAGE_HEIGHT / 2));

      const markerPage = w.page;
      const markerY = w.y + 5;
      const markerX = MARGIN + TIME_COLUMN + GUTTER / 2;
      w.label(stop.time, MARGIN, w.y + 1, { font: fonts.regular, size: 9.5, color: ink2 });
      markerPage.drawCircle({
        x: markerX,
        y: PAGE_HEIGHT - markerY,
        size: 3.4,
        borderColor: route,
        borderWidth: 1.6,
        color: rgb(1, 1, 1),
      });
      w.label(stop.estimatedCost, PAGE_WIDTH - MARGIN - costWidth + 12, w.y + 2, { font: fonts.regular, size: 9.5, color: ink2 });

      w.text(stop.title, { font: fonts.semibold, size: 11.5, x: STOP_TEXT_X, width: titleWidth, lineHeight: 15 });
      w.text(place, { font: fonts.regular, size: 9.5, color: ink2, x: STOP_TEXT_X, width: STOP_TEXT_WIDTH, lineHeight: 13 });
      w.space(4);
      w.text(stop.description, { font: fonts.regular, size: 10.5, x: STOP_TEXT_X, width: STOP_TEXT_WIDTH, lineHeight: 14.5 });

      if (stop.travelToNext) {
        w.space(5);
        const leg = stop.travelToNext;
        const legLine = `${modeLabels[leg.mode] ?? leg.mode}, ${leg.minutes} min${leg.status === "estimated" ? " (estimate)" : ""}. ${leg.note}`;
        w.text(legLine, { font: fonts.regular, size: 9.5, color: leg.status === "estimated" ? ink2 : route, x: STOP_TEXT_X, width: STOP_TEXT_WIDTH, lineHeight: 13 });
      }

      const isLast = stopIndex === day.stops.length - 1;
      w.space(isLast ? 6 : 18);

      // Route line from this marker down to the next stop, on whichever page
      // the marker was drawn. If the stop spilled onto a new page the line
      // simply runs to the bottom margin.
      if (!isLast) {
        const endY = markerPage === w.page ? w.y : PAGE_HEIGHT - MARGIN;
        markerPage.drawLine({
          start: { x: markerX, y: PAGE_HEIGHT - markerY - 4 },
          end: { x: markerX, y: PAGE_HEIGHT - endY },
          thickness: 1.2,
          color: route,
          dashArray: stop.travelToNext?.status === "estimated" ? [3, 3] : undefined,
        });
      }
    }
  }

  if (itinerary.assumptions.length) {
    w.space(30);
    w.ensure(60);
    w.rule(rgb(0.77, 0.8, 0.79));
    w.space(14);
    w.text("Check before you go", { font: fonts.semibold, size: 14, lineHeight: 18 });
    w.space(6);
    for (const assumption of itinerary.assumptions) {
      w.ensure(28);
      w.label("•", MARGIN, w.y, { font: fonts.regular, size: 10.5, color: ink2 });
      w.text(assumption, { font: fonts.regular, size: 10.5, color: ink2, x: MARGIN + 14, width: CONTENT_WIDTH - 14, lineHeight: 14.5 });
      w.space(3);
    }
  }

  // Footer with page numbers
  const pages = pdf.getPages();
  for (const [index, page] of pages.entries()) {
    const footer = `${itinerary.destination} itinerary`;
    const pageLabel = `${index + 1} of ${pages.length}`;
    page.drawText(footer, { x: MARGIN, y: 28, size: 8.5, font: fonts.regular, color: ink2 });
    page.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN - fonts.regular.widthOfTextAtSize(pageLabel, 8.5),
      y: 28,
      size: 8.5,
      font: fonts.regular,
      color: ink2,
    });
  }

  return pdf.save();
}
