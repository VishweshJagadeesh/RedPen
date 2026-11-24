import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploaded sheets are sent one photo per request after client-side downscaling.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  outputFileTracingIncludes: {
    "/**": ["./evals/reports/latest.json"],
  },
};

export default nextConfig;
