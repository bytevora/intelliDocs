import { VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";

export function getNivoTheme(theme: VisualTheme): Record<string, unknown> {
  const c = THEME_COLORS[theme];
  return {
    background: "transparent",
    text: {
      fontSize: 12,
      fill: c.text,
    },
    axis: {
      domain: {
        line: { stroke: c.border, strokeWidth: 1 },
      },
      ticks: {
        line: { stroke: c.border, strokeWidth: 1 },
        text: { fontSize: 11, fill: c.textMuted },
      },
      legend: {
        text: { fontSize: 12, fill: c.text, fontWeight: 600 },
      },
    },
    grid: {
      line: { stroke: c.border, strokeOpacity: 0.5 },
    },
    legends: {
      text: { fontSize: 11, fill: c.textMuted },
    },
    labels: {
      text: { fontSize: 12, fill: c.text, fontWeight: 500 },
    },
    tooltip: {
      container: {
        background: c.cardBg,
        color: c.text,
        fontSize: 12,
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        border: `1px solid ${c.border}`,
      },
    },
  };
}

export function getNivoColors(theme: VisualTheme): string[] {
  return THEME_COLORS[theme].palette;
}
