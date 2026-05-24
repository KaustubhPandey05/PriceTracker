import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pokemon Card Market Tracker",
  description: "Local dashboard for Pokemon card price, supply, and trend analysis."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("pokemon-market-theme");if(["light","dark-graphite","dark-midnight","dark-neon"].indexOf(t)>-1){document.documentElement.dataset.theme=t;}}catch(e){}})();`
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
