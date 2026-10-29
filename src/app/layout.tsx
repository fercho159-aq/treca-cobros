import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TRECA Cobros",
  description: "Sistema de cobros - Transporte Escolar TRECA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full bg-gray-50 font-sans">
        <header className="bg-blue-700 text-white px-4 py-3 shadow-md">
          <div className="max-w-[1800px] mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight hover:text-blue-100">
              TRECA Cobros
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-blue-200 text-sm">Fortaleza</span>
              <Link
                href="/sync"
                className="text-sm bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition"
              >
                Sync Sheets
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
