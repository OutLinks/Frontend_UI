import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OutboundOS — Outreach control center",
  description: "A calm, evidence-led AI outreach workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
