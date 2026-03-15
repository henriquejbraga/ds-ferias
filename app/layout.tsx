import type { Metadata } from "next";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { DashboardNavProvider } from "@/components/dashboard-nav-provider";
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
        <Suspense fallback={null}>
          <DashboardNavProvider>
            <Toaster richColors position="top-center" />
            {children}
            <Analytics />
          </DashboardNavProvider>
        </Suspense>
      </body>
    </html>
  );
}


