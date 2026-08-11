import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Embed to Qdrant",
  description: "Local AI • Vector Search — Embed files into Qdrant for semantic search",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
