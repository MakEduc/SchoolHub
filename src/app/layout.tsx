import type { Metadata } from "next";
import { LanguageProvider, Text } from "@/components/language";
import { AppShell } from "@/components/shell";
import { SchoolGate } from "@/components/school-gate";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-serif-display/400.css";
import "./globals.css";
export const metadata: Metadata = { title: { default: "SchoolHub — Your school. Your space.", template: "%s · SchoolHub" }, description: "A school commons for questions, shared study, classroom debates, and calmer spaces.", robots: { index: false, follow: false } };
// School-day dates must be rendered per request, rather than frozen at build time.
export const dynamic = "force-dynamic";
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><LanguageProvider><a className="skip-link" href="#main-content"><Text>Skip to content</Text></a><SchoolGate><AppShell>{children}</AppShell></SchoolGate></LanguageProvider></body></html>;
}
