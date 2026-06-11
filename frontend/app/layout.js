import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { AuthProvider } from "./lib/auth";
import { CartProvider } from "./lib/cart";
import { WishlistProvider } from "./lib/wishlist";
import { ToastProvider } from "./lib/toast";
import ConditionalNav from "./components/ConditionalNav";
import ConditionalFooter from "./components/ConditionalFooter";
import CookieConsent from "./components/CookieConsent";
import LandingIntro from "./components/LandingIntro";

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
  // Read the non-sensitive auth hint cookies so the server-rendered nav can
  // show the right controls and the correct avatar initial on first paint
  // (avoids the Sign in / Get started flash and the "U" avatar flash).
  const cookieStore = cookies();
  const initialAuthed = cookieStore.get("cartivo_auth")?.value === "1";
  let initialName = "";
  try {
    initialName = decodeURIComponent(cookieStore.get("cartivo_name")?.value || "");
  } catch {
    initialName = "";
  }
  return (
    <html lang="en" style={{ background: "#ffffff" }}>
      <body className={`${jakarta.variable} ${fraunces.variable}`} style={{ background: "#ffffff" }}>
        {/*
          Inline script runs synchronously before the first paint.
          It reads sessionStorage + prefers-reduced-motion and sets
          data-intro="play" or "skip" on <html> so the CSS overlay
          is visible/hidden from byte 1 — no hydration wait needed.
        */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var d=document.documentElement;var r=window.matchMedia('(prefers-reduced-motion: reduce)').matches;var onHome=window.location.pathname==='/';if(r||!onHome){d.setAttribute('data-intro','skip');}else{d.setAttribute('data-intro','play');}}catch(e){d.setAttribute('data-intro','skip');}})();` }} />
        {/* Static overlay — present in the initial HTML, shown/hidden by CSS keyed on data-intro */}
        <div className="landing-intro" aria-hidden="true">
          {/* Three stacked strips — exit with staggered upward slides */}
          <div className="li-strip li-strip-1" />
          <div className="li-strip li-strip-2" />
          <div className="li-strip li-strip-3" />

          {/* Brand center — letter-by-letter clip reveal */}
          <div className="li-center">
            <p className="li-tagline">Premium tech, fair prices</p>
            <div className="li-word" aria-label="Cartivo">
              {"CARTIVO".split("").map((ch, i) => (
                <span key={i} className="li-letter-wrap">
                  <span className="li-letter" style={{ animationDelay: `${0.08 + i * 0.07}s` }}>{ch}</span>
                </span>
              ))}
            </div>
            <span className="li-underline" />
          </div>

          {/* Counter — bottom right */}
          <div className="li-counter-block">
            <span id="li-counter-num">0</span>
            <span className="li-counter-pct">%</span>
          </div>
        </div>
        {/* Hydration-side cleanup only */}
        <LandingIntro />
        <AuthProvider initialAuthed={initialAuthed} initialName={initialName}>
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
