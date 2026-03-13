import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
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
      "flowchart", "mindmap", "timeline", "sequence", "pie",
      "comparison", "funnel", "stats", "swot", "orgchart", "venn",
      "bar", "line", "area", "donut", "radar", "scatter", "heatmap", "sankey",
    ],
  }).notNull(),
  renderMode: text("render_mode", {
    enum: ["mermaid", "custom"],
  }).notNull().default("mermaid"),
  mermaidSyntax: text("mermaid_syntax").notNull().default(""),
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

export const visualCache = sqliteTable("visual_cache", {
  contentHash: text("content_hash").primaryKey(),
  visualType: text("visual_type", {
    enum: [
      "flowchart", "mindmap", "timeline", "sequence", "pie",
      "comparison", "funnel", "stats", "swot", "orgchart", "venn",
      "bar", "line", "area", "donut", "radar", "scatter", "heatmap", "sankey",
    ],
  }).notNull(),
  renderMode: text("render_mode", {
    enum: ["mermaid", "custom"],
  }).notNull(),
  mermaidSyntax: text("mermaid_syntax").notNull().default(""),
  customData: text("custom_data"),
  hitCount: integer("hit_count").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
