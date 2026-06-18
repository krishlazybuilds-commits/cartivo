"use client";

import { usePathname } from "next/navigation";

import Nav from "./Nav";

const HIDDEN_ON = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

export default function ConditionalNav() {
  const pathname = usePathname();
  const hidden = HIDDEN_ON.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  if (hidden) return null;
  return <Nav />;
}
