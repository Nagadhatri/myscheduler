import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find a Scheduler | MyScheduler",
  description: "Search for scheduling profiles and book appointments.",
  openGraph: {
    title: "Find a Scheduler | MyScheduler",
    description: "Search for scheduling profiles and book appointments.",
  },
};

export default function VisitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
