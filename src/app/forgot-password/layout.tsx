import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password | MyScheduler",
  description: "Reset your MyScheduler password.",
  openGraph: {
    title: "Reset Password | MyScheduler",
    description: "Reset your MyScheduler password.",
  },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
