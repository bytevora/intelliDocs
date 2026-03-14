import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  isActive: integer("is_active", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("Untitled"),
  content: text("content")
    .notNull()
    .default('{"type":"doc","content":[{"type":"paragraph"}]}'),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  yjsState: text("yjs_state"),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const documentShares = sqliteTable("document_shares", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  sharedWith: text("shared_with")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  permission: text("permission", { enum: ["viewer", "editor"] })
    .notNull()
    .default("viewer"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const visuals = sqliteTable("visuals", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  sourceText: text("source_text").notNull(),
  visualType: text("visual_type", {
    enum: [
      "mindmap",
      "comparison", "funnel", "stats", "swot", "orgchart", "venn",
      "flowchart", "timeline", "sequence", "pie",
      "bar", "line", "area", "donut", "radar", "scatter", "heatmap", "sankey",
    ],
  }).notNull(),
  customData: text("custom_data"),
  theme: text("theme", {
    enum: ["default", "forest", "dark", "neutral", "ocean", "sunset", "monochrome"],
  })
    .notNull()
    .default("default"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jti: text("jti").notNull().unique(),
  revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const visualCache = sqliteTable("visual_cache", {
  contentHash: text("content_hash").primaryKey(),
  visualType: text("visual_type", {
    enum: [
      "mindmap",
      "comparison", "funnel", "stats", "swot", "orgchart", "venn",
      "flowchart", "timeline", "sequence", "pie",
      "bar", "line", "area", "donut", "radar", "scatter", "heatmap", "sankey",
    ],
  }).notNull(),
  customData: text("custom_data"),
  hitCount: integer("hit_count").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
