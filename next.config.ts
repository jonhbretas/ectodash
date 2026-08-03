import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // TypeScript 7.0.2 (pinned per RESEARCH.md Pitfall 7) does not yet expose
    // the compiler API Next.js's build-time type-checker relies on by
    // default. Fall back to shelling out to the `tsc` CLI instead.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
