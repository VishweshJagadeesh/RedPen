import type { Metadata, Viewport } from "next";
import "@fontsource/kalam/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RedPen", template: "%s · RedPen" },
  description: "Grade handwritten tests, see which concepts each student is missing, and act on it.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
