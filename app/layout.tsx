import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} min-h-screen bg-[#0a0a0b] text-[#ededed] relative`}>
        {children}
      </body>
    </html>
  );
}
