import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import AppProvider from "@/components/AppProvider";
import AppShell from "@/components/AppShell";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";

export const metadata: Metadata = {
  title: "Хронос — занятия по истории",
  description: "Даты, исторические понятия и диктанты для занятий на электронной доске.",
  manifest: `${basePath}/manifest.webmanifest`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f4f1",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
