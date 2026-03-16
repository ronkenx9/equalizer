import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EQUALIZER — The deal that actually holds",
  description: "AI agent that evaluates work and pays people. Internet handshakes finally mean something.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-base text-text-primary">
        {children}
      </body>
    </html>
  );
}
