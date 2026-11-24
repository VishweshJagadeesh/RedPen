import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  outputFileTracingIncludes: {
    "/**": ["./evals/reports/latest.json"],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // SQLite writes and uploaded files must not trigger recompiles while grading runs.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/prisma/*.db*", "**/.data/**", "**/evals/**", "**/public/samples/**", "**/test-results/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
