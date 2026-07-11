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
  title: "MyScheduler - Book Your Appointment",
  description: "A modern scheduling and booking platform.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "MyScheduler - Book Your Appointment",
    description: "A modern scheduling and booking platform.",
    url: "https://myscheduler.com",
    siteName: "MyScheduler",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyScheduler - Book Your Appointment",
    description: "A modern scheduling and booking platform.",
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
