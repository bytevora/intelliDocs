import { VisualTheme } from "@/types";

/** Theme metadata for UI selectors (theme picker dropdown, context menu, etc.) */
export const THEME_OPTIONS: { value: VisualTheme; label: string; preview: string }[] = [
  { value: "default", label: "Default", preview: "bg-blue-500" },
  { value: "forest", label: "Forest", preview: "bg-emerald-500" },
  { value: "dark", label: "Dark", preview: "bg-zinc-700" },
  { value: "neutral", label: "Neutral", preview: "bg-stone-400" },
  { value: "ocean", label: "Ocean", preview: "bg-cyan-500" },
  { value: "sunset", label: "Sunset", preview: "bg-orange-500" },
  { value: "monochrome", label: "Mono", preview: "bg-gray-500" },
];

export interface ThemeColors {
  bg: string;
  cardBg: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textMuted: string;
  border: string;
  palette: string[];
  gradient: [string, string];
}

export const THEME_COLORS: Record<VisualTheme, ThemeColors> = {
  default: {
    bg: "#ffffff",
    cardBg: "#f8fafc",
    primary: "#3b82f6",
    secondary: "#6366f1",
    accent: "#8b5cf6",
    text: "#1e293b",
    textMuted: "#64748b",
    border: "#e2e8f0",
    palette: ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"],
    gradient: ["#3b82f6", "#6366f1"],
  },
  forest: {
    bg: "#f0fdf4",
    cardBg: "#ecfdf5",
    primary: "#16a34a",
    secondary: "#15803d",
    accent: "#059669",
    text: "#14532d",
    textMuted: "#4d7c0f",
    border: "#bbf7d0",
    palette: ["#16a34a", "#059669", "#0d9488", "#65a30d", "#ca8a04", "#dc2626"],
    gradient: ["#16a34a", "#059669"],
  },
  dark: {
    bg: "#1e1e2e",
    cardBg: "#2a2a3e",
    primary: "#89b4fa",
    secondary: "#b4befe",
    accent: "#cba6f7",
    text: "#cdd6f4",
    textMuted: "#a6adc8",
    border: "#45475a",
    palette: ["#89b4fa", "#f38ba8", "#a6e3a1", "#f9e2af", "#cba6f7", "#f5c2e7"],
    gradient: ["#89b4fa", "#b4befe"],
  },
  neutral: {
    bg: "#fafafa",
    cardBg: "#f5f5f5",
    primary: "#525252",
    secondary: "#737373",
    accent: "#404040",
    text: "#171717",
    textMuted: "#737373",
    border: "#d4d4d4",
    palette: ["#525252", "#737373", "#404040", "#a3a3a3", "#262626", "#8b8b8b"],
    gradient: ["#525252", "#737373"],
  },
  ocean: {
    bg: "#f0f9ff",
    cardBg: "#e0f2fe",
    primary: "#0284c7",
    secondary: "#0369a1",
    accent: "#0ea5e9",
    text: "#0c4a6e",
    textMuted: "#0369a1",
    border: "#bae6fd",
    palette: ["#0284c7", "#0ea5e9", "#06b6d4", "#0891b2", "#14b8a6", "#6366f1"],
    gradient: ["#0284c7", "#06b6d4"],
  },
  sunset: {
    bg: "#fff7ed",
    cardBg: "#ffedd5",
    primary: "#ea580c",
    secondary: "#dc2626",
    accent: "#f59e0b",
    text: "#7c2d12",
    textMuted: "#c2410c",
    border: "#fed7aa",
    palette: ["#ea580c", "#dc2626", "#f59e0b", "#e11d48", "#9333ea", "#0891b2"],
    gradient: ["#ea580c", "#f59e0b"],
  },
  monochrome: {
    bg: "#ffffff",
    cardBg: "#f9fafb",
    primary: "#111827",
    secondary: "#374151",
    accent: "#6b7280",
    text: "#111827",
    textMuted: "#6b7280",
    border: "#d1d5db",
    palette: ["#111827", "#374151", "#4b5563", "#6b7280", "#9ca3af", "#d1d5db"],
    gradient: ["#111827", "#4b5563"],
  },
};
