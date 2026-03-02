import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vibeforge",
  description: "Vibe to playlist recommendations and Spotify playlist generation"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
