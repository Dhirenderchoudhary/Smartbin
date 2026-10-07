import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@smartbin/api", "@smartbin/db"],
  serverExternalPackages: ["postgres"],
  agentRules: false,
};

export default nextConfig;
