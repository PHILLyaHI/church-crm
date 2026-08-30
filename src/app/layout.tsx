import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { IconSprite } from "@/components/Icons";
import "./globals.css";

// One family, loaded as a variable font so the design's 640 weight is real.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tend",
  description: "A church outreach CRM: the people you pray for, and when you last saw them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      {/* Extensions (Grammarly and friends) stamp attributes on <body> before
          React hydrates. Their diff is noise, and it is only ever on this tag. */}
      <body suppressHydrationWarning>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
