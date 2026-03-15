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
      <body className="antialiased bg-background text-foreground">
        <a
          href="#main"
          className="fixed left-2 top-2 z-[100] -translate-y-[200%] rounded-md bg-[#1a1d23] px-4 py-2 text-sm font-semibold text-white shadow-lg transition focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-white dark:text-[#1a1d23]"
        >
          Pular para o conteúdo principal
        </a>
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


