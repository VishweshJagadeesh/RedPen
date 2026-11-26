import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-mode "N" badge sits over the walkthrough's caption bar.
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  outputFileTracingIncludes: {
    "/**": ["./evals/reports/latest.json", "./evals/gold/*.json"],
    // Generated practice sheets embed the handwriting font; live grading reads the bundled samples from disk.
    "/api/files/**": ["./node_modules/@fontsource/kalam/files/kalam-latin-400-normal.woff2"],
    "/api/assessments/**": ["./public/samples/**"],
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
