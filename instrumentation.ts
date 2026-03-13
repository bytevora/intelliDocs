export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    const { db } = await import("./src/lib/db/index");
    migrate(db, { migrationsFolder: "./drizzle" });

    const { seedAdmin } = await import("./src/lib/db/seed");
    await seedAdmin();
  }
}
