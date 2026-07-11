import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account | MyScheduler",
  description: "Join MyScheduler and start managing your time.",
  openGraph: {
    title: "Create Account | MyScheduler",
    description: "Join MyScheduler and start managing your time.",
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
