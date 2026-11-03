import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { getLang } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { SwRegister } from "@/components/SwRegister";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Kaafiye", template: "%s · Kaafiye" },
  description: "Kaafiye — spare parts inventory, sales and Banjarka records",
  applicationName: "Kaafiye",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Kaafiye", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a1d36",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} className={jakarta.variable}>
      <body>
        <I18nProvider lang={lang}>
          {children}
          <SwRegister />
        </I18nProvider>
      </body>
    </html>
  );
}
