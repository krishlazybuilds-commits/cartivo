/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      // Local dev (HTTP)
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "localhost", port: "9000" },
      // Production / staging (HTTPS) — hostname set via NEXT_PUBLIC_MEDIA_HOST
      ...(process.env.NEXT_PUBLIC_MEDIA_HOST
        ? [{ protocol: "https", hostname: process.env.NEXT_PUBLIC_MEDIA_HOST }]
        : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
          // Content-Security-Policy is set per-request in middleware.js
          // with a nonce to avoid 'unsafe-inline'.
        ],
      },
    ];
  },
};

export default nextConfig;
