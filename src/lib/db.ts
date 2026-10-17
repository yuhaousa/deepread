import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { setCallLogger } from "@/server/llm/router";

const globalForDb = globalThis as unknown as { pool?: Pool };
const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };

// 所有模型调用写入 ai_calls，用于成本与质量看板
setCallLogger(async (log) => {
  await db.insert(schema.aiCalls).values(log);
});
