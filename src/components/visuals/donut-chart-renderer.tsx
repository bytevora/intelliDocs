"use client";

import { ResponsivePie } from "@nivo/pie";
import { DonutChartData, VisualTheme } from "@/types";
import { ChartWrapper } from "./chart-wrapper";
import { THEME_COLORS } from "./theme-colors";

interface DonutChartRendererProps {
  data: DonutChartData;
  theme: VisualTheme;
}

export function DonutChartRenderer({ data, theme }: DonutChartRendererProps) {
  const tc = THEME_COLORS[theme];
  const isHalf = data.variant === "half";

  return (
    <ChartWrapper title={data.title} theme={theme}>
      {(nivoTheme, colors) => (
        <ResponsivePie
          data={data.data}
          margin={{ top: 20, right: 80, bottom: isHalf ? 20 : 40, left: 80 }}
          innerRadius={0.55}
          padAngle={1.5}
          cornerRadius={4}
          startAngle={isHalf ? -90 : 0}
          endAngle={isHalf ? 90 : 360}
          colors={colors}
          borderWidth={1}
          borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
          arcLinkLabelsSkipAngle={10}
          arcLinkLabelsTextColor={tc.text}
          arcLinkLabelsThickness={2}
          arcLinkLabelsColor={{ from: "color" }}
          arcLabelsSkipAngle={10}
          arcLabelsTextColor={{ from: "color", modifiers: [["darker", 2]] }}
          animate={true}
          motionConfig="gentle"
          theme={nivoTheme}
          legends={[
            {
              anchor: "bottom",
              direction: "row",
              translateY: isHalf ? 16 : 36,
              itemsSpacing: 4,
              itemWidth: 80,
              itemHeight: 18,
              itemDirection: "left-to-right",
              symbolSize: 10,
              symbolShape: "circle",
            },
          ]}
        />
      )}
    </ChartWrapper>
  );
}
