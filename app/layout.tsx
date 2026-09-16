import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({
  subsets: ["latin", "latin-ext"],
  variable: "--font-onest",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Elsewhere, a travel planner",
  description: "Turn a loose travel idea into a practical, sourced itinerary.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android keyboards shrink the layout viewport so the sticky composer stays visible.
  interactiveWidget: "resizes-content",
  themeColor: "#f3f4f1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={onest.variable}>
      <body>{children}</body>
    </html>
  );
}
