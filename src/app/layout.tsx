import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Baby Milk Tracker",
  description: "Track your baby's milk intake",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-slate-900 text-slate-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
