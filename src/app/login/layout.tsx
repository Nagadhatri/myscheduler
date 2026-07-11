import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | MyScheduler",
  description: "Sign in to manage your schedule and appointments.",
  openGraph: {
    title: "Sign In | MyScheduler",
    description: "Sign in to manage your schedule and appointments.",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
