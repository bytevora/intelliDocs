"use client";

import { VisualTheme } from "@/types";
import { getNivoTheme, getNivoColors } from "./nivo-theme";

interface ChartWrapperProps {
  title: string;
  theme: VisualTheme;
  height?: number;
  children: (nivoTheme: Record<string, unknown>, colors: string[]) => React.ReactNode;
}

export function ChartWrapper({ title, theme, height = 320, children }: ChartWrapperProps) {
  const nivoTheme = getNivoTheme(theme);
  const colors = getNivoColors(theme);

  return (
    <div style={{ padding: "4px 0" }}>
      <p className="text-sm font-semibold text-center mb-3 text-foreground">
        {title}
      </p>
      <div style={{ height }}>{children(nivoTheme, colors)}</div>
    </div>
  );
}
