import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";

// ── Auth ────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  username: z.string().min(1, "Username is required").max(50),
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
});

// ── Admin Users ─────────────────────────────────────────

export const createUserSchema = z.object({
  username: z.string().min(1, "Username is required").max(50),
  email: z.string().min(1, "Email is required").email("Invalid email"),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
  role: z.enum(["admin", "user"]).default("user"),
  isActive: z.boolean().default(false),
});

export const updateUserSchema = z
  .object({
    username: z.string().min(1).max(50).optional(),
    email: z.string().email("Invalid email").optional(),
    role: z.enum(["admin", "user"]).optional(),
    isActive: z.boolean().optional(),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

// ── Documents ───────────────────────────────────────────

export const createDocumentSchema = z.object({
  title: z.string().max(500).optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().optional(),
});

export const generateDocumentSchema = z.object({
  idea: z.string().min(1, "Please provide an idea for the document").max(5000),
});

// ── Sharing ─────────────────────────────────────────────

export const shareDocumentSchema = z.object({
  identifier: z.string().min(1, "identifier (username or email) is required"),
  permission: z.enum(["viewer", "editor"]).default("viewer"),
});

// ── Visuals ─────────────────────────────────────────────

const VISUAL_TYPES = [
  "flowchart", "mindmap", "timeline", "sequence", "pie",
  "comparison", "funnel", "stats", "swot", "orgchart", "venn",
  "bar", "line", "area", "donut", "radar", "scatter", "heatmap", "sankey",
] as const;

export const generateVisualSchema = z.object({
  sourceText: z.string().min(1, "sourceText is required"),
  visualType: z.enum(VISUAL_TYPES).optional(),
  templateId: z.string().optional(),
  forceRefresh: z.boolean().optional(),
});

export const updateVisualSchema = z.object({
  action: z.enum(["regenerate"]).optional(),
  visualType: z.enum(VISUAL_TYPES).optional(),
  theme: z.enum(["default", "forest", "dark", "neutral", "ocean", "sunset", "monochrome"]).optional(),
  customData: z.string().optional(),
});
