import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https://*.supabase.co https://lh3.googleusercontent.com data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co https://opencode.ai https://api.assinafy.com.br https://www.googleapis.com https://oauth2.googleapis.com",
      "frame-ancestors 'none",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // V-004: Security headers to prevent clickjacking, MIME sniffing, and data exfiltration.
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
  // pdfkit loads its .afm font metrics via __dirname-relative paths; when
  // Turbopack bundles it the path resolves to a fake /ROOT that doesn't
  // exist (ENOENT Helvetica.afm → 500 on /api/atas/[id]/pdf). Keeping it
  // external makes Next require it from node_modules at runtime instead.
  serverExternalPackages: ["pdfkit"],
  experimental: {
    // TypeScript 7.0.2 (pinned per RESEARCH.md Pitfall 7) does not yet expose
    // the compiler API Next.js's build-time type-checker relies on by
    // default. Fall back to shelling out to the `tsc` CLI instead.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
