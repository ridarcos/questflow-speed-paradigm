import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
// Tipografía servida desde el propio origen (paquetes npm): el build no necesita red.
// Bricolage desde standard.css, el único con los ejes opsz, wdth y wght.
import "@fontsource-variable/bricolage-grotesque/standard.css";
import "@fontsource-variable/instrument-sans/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuestFlow — Cada misión, un tramo de tu ruta",
  description:
    "Organiza tus misiones personales como una ruta de montaña: elige el terreno, complétalas y gana XP.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink">{children}</body>
    </html>
  );
}
