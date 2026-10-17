// 生产镜像内的迁移入口（无 TypeScript 运行时）。
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("数据库迁移完成");
} finally {
  await pool.end();
}
