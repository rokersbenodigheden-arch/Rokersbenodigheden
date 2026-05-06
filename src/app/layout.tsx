import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Rokersbenodigheden — Product Admin",
  description: "Productzoeker, catalogus en dashboard voor het volledige Rokersbenodigheden assortiment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
