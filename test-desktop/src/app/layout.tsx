import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HydroGem Test Website",
  description: "Testing Values from Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ position: "relative", minHeight: "100vh" }}
      >
        {/* Background image with blur */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -2,
            backgroundImage: "url('/background.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(20px)",
            width: "100vw",
            height: "100vh",
          }}
        />
        {/* White overlay with 20% opacity */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -1,
            background: "rgba(255,255,255,0.1)",
            width: "100vw",
            height: "100vh",
          }}
        />
        {children}
      </body>
    </html>
  );
}
