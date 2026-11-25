import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Polices de l'app iOS, servies via /_next/static (hors du Proxy d'auth,
// donc disponibles aussi sur la page de connexion).
const cormorant = localFont({
  src: [
    { path: "./fonts/CormorantGaramond-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/CormorantGaramond-LightItalic.ttf", weight: "300", style: "italic" },
    { path: "./fonts/CormorantGaramond-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/CormorantGaramond-Italic.ttf", weight: "400", style: "italic" },
    { path: "./fonts/CormorantGaramond-SemiBoldItalic.ttf", weight: "600", style: "italic" },
    { path: "./fonts/CormorantGaramond-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyVine",
  description: "Journal de dégustation et gestion de cave.",
  appleWebApp: { capable: true, title: "MyVine", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#7A2030",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`h-full antialiased ${cormorant.variable}`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
