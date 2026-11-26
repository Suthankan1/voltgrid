import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoltGrid Operator Console",
  description:
    "Operations dashboard for the VoltGrid EV charging network platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
