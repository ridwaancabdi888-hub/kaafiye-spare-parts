import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLang } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { SwRegister } from "@/components/SwRegister";

export const metadata: Metadata = {
  title: { default: "Kaafiye Spare Parts", template: "%s · Kaafiye" },
  description: "Kaafiye — spare parts inventory, sales and Banjarka records",
  applicationName: "Kaafiye",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Kaafiye", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#092d35",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body>
        <I18nProvider lang={lang}>
          {children}
          <SwRegister />
        </I18nProvider>
      </body>
    </html>
  );
}
