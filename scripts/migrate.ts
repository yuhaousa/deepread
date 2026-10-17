// 生产 / CI 迁移：只依赖 drizzle-orm 与 pg，无需额外二进制。
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
migrate(drizzle(pool), { migrationsFolder: "drizzle" })
  .then(() => console.log("数据库迁移完成"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
