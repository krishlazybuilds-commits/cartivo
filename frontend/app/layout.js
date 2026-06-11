import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./lib/auth";
import { CartProvider } from "./lib/cart";
import { WishlistProvider } from "./lib/wishlist";
import { ToastProvider } from "./lib/toast";
import ConditionalNav from "./components/ConditionalNav";
import ConditionalFooter from "./components/ConditionalFooter";
import CookieConsent from "./components/CookieConsent";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Cartivo — Shop the latest tech",
  description:
    "Shop laptops, smartphones, audio, wearables and more at Cartivo. Secure Stripe checkout, guest ordering, and shipping costs shown upfront.",
  openGraph: {
    title: "Cartivo — Shop the latest tech",
    description:
      "Shop laptops, smartphones, audio, wearables and more. Secure checkout, guest ordering, and shipping shown upfront.",
    siteName: "Cartivo",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cartivo — Shop the latest tech",
    description:
      "Shop laptops, smartphones, audio, wearables and more. Secure checkout and fast delivery.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ background: "#ffffff" }}>
      <body className={`${jakarta.variable} ${fraunces.variable}`} style={{ background: "#ffffff" }}>
        <AuthProvider>
          <ToastProvider>
            <CartProvider>
              <WishlistProvider>
                <ConditionalNav />
                {children}
                <ConditionalFooter />
                <CookieConsent />
              </WishlistProvider>
            </CartProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
