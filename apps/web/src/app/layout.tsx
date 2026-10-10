import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { SITE } from "@/lib/site";
import { themeScript } from "@/lib/theme";
import "./globals.css";

// Uber Move is proprietary; Inter Tight (headlines, 700) and Inter (text, 400/500) mirror its Move / Move Text pairing
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"], weight: ["700"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ["dustbin near me", "public dustbin map", "waste bin locator", "wet and dry waste", "Swachh Bharat", "India"],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name}: ${SITE.tagline}`,
    description: SITE.description,
    locale: "en_IN",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by themeScript before React hydrates
    <html lang="en-IN" className={`${inter.variable} ${interTight.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* Extensions like Grammarly add attributes to <body> before React loads */}
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
