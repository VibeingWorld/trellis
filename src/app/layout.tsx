import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cove — a little room for big ideas",
  description: "Your boards, connected. A calm workspace for projects, linked cards, and ideas on the move.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
