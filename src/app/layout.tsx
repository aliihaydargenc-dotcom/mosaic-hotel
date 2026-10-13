import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Mosaic | Ambar & Maliyet",
  description: "Mosaic Hotel stok, alım ve maliyet yönetimi",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
