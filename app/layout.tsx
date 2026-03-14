import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Editora Globo - Férias",
  description: "Gestão interna de férias com fluxo de aprovação.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`antialiased bg-background text-foreground`}
      >
        <Toaster richColors position="top-center" />
        {children}
        <Analytics />
      </body>
    </html>
  );
}


