import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Police Inter embarquée (mêmes fichiers que les maquettes) : aucun appel à Google Fonts.
const inter = localFont({
  src: [
    { path: "./fonts/inter-latin.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/inter-latin-ext.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Réclamations clients · Groupe COSEMAD",
    template: "%s · Groupe COSEMAD",
  },
  description: "Déposez et suivez vos réclamations auprès des sociétés du Groupe COSEMAD.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B4A8B",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
