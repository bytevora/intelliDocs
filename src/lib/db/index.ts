import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbPath = path.resolve(process.env.DATABASE_URL || "./data/intellidocs.db");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>>;
};

export const db =
  globalForDb.db || drizzle(sqlite, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
