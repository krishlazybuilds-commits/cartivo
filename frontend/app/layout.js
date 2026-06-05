import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata = {
  title: "Cartivo — Commerce, beautifully simple",
  description:
    "Cartivo is the modern commerce platform that helps you launch, sell, and grow with a storefront your customers will love.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${fraunces.variable}`}>
        {children}
      </body>
    </html>
  );
}
