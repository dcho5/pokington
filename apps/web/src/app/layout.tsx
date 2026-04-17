import { Metadata } from "next";
import Script from "next/script";
import { normalizePartyKitHost } from "lib/party";
import "./globals.css";

// This metadata object is picked up by Next.js automatically
export const metadata: Metadata = {
  title: "Pokington",
  description: "Real-time multiplayer Texas Hold'em",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico", rel: "icon" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const runtimeConfig = {
    partykitHost: normalizePartyKitHost(process.env.PARTYKIT_HOST ?? process.env.NEXT_PUBLIC_PARTYKIT_HOST),
  };

  return (
    <html lang="en">
      <body>
        <Script id="pokington-runtime-config" strategy="beforeInteractive">
          {`window.__POKINGTON_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};`}
        </Script>
        {children}
      </body>
    </html>
  );
}
