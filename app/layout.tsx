import type { Metadata } from "next";
import { Inter, Syne, DM_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne" });
const dmMono = DM_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-dm-mono" });
const instrumentSerif = Instrument_Serif({ weight: ["400"], subsets: ["latin"], variable: "--font-instrument-serif" });

export const metadata: Metadata = {
  title: "Microsoft Student Community - SRM University AP",
  description: "A vibrant student-led tech community focused on Azure, AI, and cloud computing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} ${syne.variable} ${dmMono.variable} ${instrumentSerif.variable} ${inter.className} min-h-screen bg-[#0a0a0b] text-[#ededed] relative`}>
        {children}
      </body>
    </html>
  );
}
