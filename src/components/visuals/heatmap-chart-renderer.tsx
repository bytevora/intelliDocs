"use client";

import { ResponsiveHeatMap } from "@nivo/heatmap";
import { HeatmapChartData, VisualTheme } from "@/types";
import { ChartWrapper } from "./chart-wrapper";
import { THEME_COLORS } from "./theme-colors";

interface HeatmapChartRendererProps {
  data: HeatmapChartData;
  theme: VisualTheme;
}

export function HeatmapChartRenderer({ data, theme }: HeatmapChartRendererProps) {
  const tc = THEME_COLORS[theme];

  return (
    <ChartWrapper title={data.title} theme={theme} height={340}>
      {(nivoTheme) => (
        <ResponsiveHeatMap
          data={data.data}
          margin={{ top: 30, right: 30, bottom: 50, left: 80 }}
          axisTop={{
            tickSize: 5,
            tickPadding: 5,
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
          }}
          colors={{
            type: "sequential",
            scheme: theme === "dark" ? "purples" : theme === "forest" ? "greens" : theme === "ocean" ? "blues" : theme === "sunset" ? "oranges" : "blues",
          }}
          borderRadius={3}
          borderWidth={1}
          borderColor={tc.border}
          labelTextColor={{ from: "color", modifiers: [["darker", 3]] }}
          animate={true}
          motionConfig="gentle"
          theme={nivoTheme}
        />
      )}
    </ChartWrapper>
  );
}
