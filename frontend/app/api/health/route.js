import { NextResponse } from "next/server";

/**
 * Health check endpoint for Docker / Kubernetes / Load Balancers.
 * Returns 200 OK as long as the Next.js server is responding.
 */
export async function GET() {
  return NextResponse.json({ status: "ok", uptime: process.uptime() });
}
