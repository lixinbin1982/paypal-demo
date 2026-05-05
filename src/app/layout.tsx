import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luxe — Fashion & Jewelry",
  description:
    "Discover our curated collection of luxury fashion and jewelry. Fast checkout with PayPal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
