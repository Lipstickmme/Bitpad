import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Tree-shake icon/chart/SDK barrels so each page ships only what it uses
  experimental: { optimizePackageImports: ["lucide-react", "recharts", "@ton/core", "@ton/ton", "lightweight-charts"] },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
