import { NextResponse } from "next/server";
import { rateLimit } from "../../lib/rate-limit";

/**
 * CSP Violation Report Endpoint
 *
 * Browsers POST violation reports here (as application/csp-report) when
 * Content-Security-Policy is breached.  This is a no-storage receiver:
 * violations are logged server-side so they can be monitored without
 * exposing a feedback channel to attackers.
 *
 * In production, wire this into your error-monitoring pipeline (e.g.
 * forward the report payload to Sentry) instead of (or in addition to)
 * logging.
 *
 * Rate-limited per IP to 120 req/min to prevent log flooding.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#violation_reports
 */
export async function POST(request) {
  // Lightweight rate limit: 120 requests per minute per IP.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const { allowed, retryAfter } = rateLimit({
    key: `csp-report:${ip}`,
    windowMs: 60_000,
    max: 120,
  });
  if (!allowed) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const report = await request.json();

    // Log the violation — structured so log-aggregation tools can parse it.
    const cspReport = report["csp-report"] ?? report;
    console.warn(
      JSON.stringify({
        event: "csp_violation",
        blockedUri: cspReport["blocked-uri"],
        documentUri: cspReport["document-uri"],
        violatedDirective: cspReport["violated-directive"],
        effectiveDirective: cspReport["effective-directive"],
        originalPolicy: cspReport["original-policy"],
        sourceFile: cspReport["source-file"],
        lineNumber: cspReport["line-number"],
        columnNumber: cspReport["column-number"],
        disposition: cspReport["disposition"],
        userAgent: request.headers.get("user-agent") ?? "unknown",
      }),
    );
  } catch {
    // Malformed payload — nothing to do.
  }

  // CSP spec says return 204 (or 200 with empty body) so the browser
  // doesn't show a console error about the report delivery itself.
  return new NextResponse(null, { status: 204 });
}
