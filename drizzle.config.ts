import { defineConfig } from "drizzle-kit";

// 生成 SQLite 迁移到 drizzle/，由 wrangler d1 migrations apply 执行（见 wrangler.jsonc 的 migrations_dir）
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
