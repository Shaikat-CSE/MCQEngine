import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codemy MCQ Bank — AI-Powered MCQ Search",
  description: "Find answers instantly from your course question banks using advanced fuzzy matching.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased light">
      <body className="min-h-full flex flex-col bg-[#fafafa] text-zinc-800">
        {children}
      </body>
    </html>
  );
}
