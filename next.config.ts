import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg"],
  outputFileTracingIncludes: { "/*": ["./node_modules/drizzle-orm/**/*", "./node_modules/pg/**/*"] },
  poweredByHeader: false,
};

export default nextConfig;
