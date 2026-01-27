import type { Metadata, Viewport } from "next";
import { Playfair_Display, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { MainLayout } from "@/components/layout/MainLayout";
import { YearProvider } from "@/contexts/YearContext";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-playfair",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "예봄교회 재정부",
  description: "예봄교회 재정관리 시스템",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "예봄재정",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1e40af",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${playfair.variable} ${notoSansKR.variable} antialiased`}
      >
        <QueryProvider>
          <YearProvider>
            <MainLayout>
              {children}
            </MainLayout>
          </YearProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
