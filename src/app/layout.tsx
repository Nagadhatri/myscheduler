import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://my-scheduler-ruddy.vercel.app"),
  title: "MyScheduler - Book Your Appointment",
  description: "A modern scheduling and booking platform.",
  openGraph: {
    title: "MyScheduler - Book Your Appointment",
    description: "A modern scheduling and booking platform.",
    url: "/",
    siteName: "MyScheduler",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MyScheduler" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyScheduler - Book Your Appointment",
    description: "A modern scheduling and booking platform.",
    images: ["/og-image.png"],
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground">Skip to content</a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
