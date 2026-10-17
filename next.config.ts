import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;

// next dev 时提供 Cloudflare 绑定（本地 D1 存在 .wrangler/ 下）
initOpenNextCloudflareForDev();
