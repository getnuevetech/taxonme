import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSetting } from "@/lib/settings";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Every page is database-driven (settings, plans, content), so nothing is
// prerendered at build time — builds must work without a reachable database.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [name, tagline] = await Promise.all([
    getSetting("app.name", "TaxOnMe"),
    getSetting("app.tagline", "Your friendly tax assistant"),
  ]);
  return { title: { default: name, template: `%s · ${name}` }, description: tagline };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>{children}</body>
    </html>
  );
}
