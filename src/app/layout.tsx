import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pokemon Card Market Tracker",
  description: "Local dashboard for Pokemon card price, supply, and trend analysis."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
