"use client";

import { usePathname } from "next/navigation";

import Footer from "./Footer";

// Auth pages use a full-screen split layout with their own branding, so the
// global site footer is hidden on them.
const HIDDEN_ON = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/email-change"];

export default function ConditionalFooter() {
  const pathname = usePathname();
  const hidden = HIDDEN_ON.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  if (hidden) return null;
  return <Footer />;
}
