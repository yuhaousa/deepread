// 数据库访问：Cloudflare D1（SQLite）。
// Workers 没有常驻连接池：每个请求从 Cloudflare 上下文取 D1 绑定（wrangler.jsonc 中的 DB）。
// 导出的 db 是一个惰性句柄，用法与普通 drizzle 实例相同，首次访问时绑定到当前请求的 D1。

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { setCallLogger } from "@/server/llm/router";

export type Db = DrizzleD1Database<typeof schema>;

// 同一个 D1 绑定只创建一次 drizzle 实例
const cache = new WeakMap<object, Db>();

export function getDb(): Db {
  const binding = getCloudflareContext().env.DB;
  if (!binding) throw new Error("缺少 D1 绑定 DB：请检查 wrangler.jsonc 的 d1_databases 配置");
  let d = cache.get(binding);
  if (!d) {
    d = drizzle(binding, { schema });
    cache.set(binding, d);
  }
  return d;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const d = getDb();
    const value = Reflect.get(d, prop, d);
    return typeof value === "function" ? value.bind(d) : value;
  },
});

export { schema };

// 所有模型调用写入 ai_calls，用于成本与质量看板
setCallLogger(async (log) => {
  await db.insert(schema.aiCalls).values(log);
});
