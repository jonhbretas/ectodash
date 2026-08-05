import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit loads its .afm font metrics via __dirname-relative paths; when
  // Turbopack bundles it the path resolves to a fake /ROOT that doesn't
  // exist (ENOENT Helvetica.afm → 500 on /api/atas/[id]/pdf). Keeping it
  // external makes Next require it from node_modules at runtime instead.
  serverExternalPackages: ["pdfkit"],
  /* config options here */
  experimental: {
    // TypeScript 7.0.2 (pinned per RESEARCH.md Pitfall 7) does not yet expose
    // the compiler API Next.js's build-time type-checker relies on by
    // default. Fall back to shelling out to the `tsc` CLI instead.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
