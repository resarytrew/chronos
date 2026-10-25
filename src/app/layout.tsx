import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import AppProvider from "@/components/AppProvider";
import AppShell from "@/components/AppShell";
import PwaRegistration from "@/components/PwaRegistration";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";

export const metadata: Metadata = {
  title: "Хронос — хронологические диктанты",
  description: "Простой инструмент для проведения хронологических диктантов на уроках истории.",
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
        <PwaRegistration />
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
