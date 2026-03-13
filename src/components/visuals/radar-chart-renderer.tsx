"use client";

import { ResponsiveRadar } from "@nivo/radar";
import { RadarChartData, VisualTheme } from "@/types";
import { ChartWrapper } from "./chart-wrapper";

interface RadarChartRendererProps {
  data: RadarChartData;
  theme: VisualTheme;
}

export function RadarChartRenderer({ data, theme }: RadarChartRendererProps) {
  return (
    <ChartWrapper title={data.title} theme={theme} height={340}>
      {(nivoTheme, colors) => (
        <ResponsiveRadar
          data={data.data}
          keys={data.keys}
          indexBy={data.indexBy}
          maxValue="auto"
          margin={{ top: 40, right: 60, bottom: 40, left: 60 }}
          curve="linearClosed"
          borderWidth={2}
          borderColor={{ from: "color" }}
          gridLevels={5}
          gridShape="circular"
          gridLabelOffset={16}
          dotSize={8}
          dotColor={{ theme: "background" }}
          dotBorderWidth={2}
          dotBorderColor={{ from: "color" }}
          colors={colors}
          fillOpacity={0.2}
          blendMode="normal"
          animate={true}
          motionConfig="gentle"
          theme={nivoTheme}
          legends={data.keys.length > 1 ? [
            {
              anchor: "bottom",
              direction: "row",
              translateY: 36,
              itemsSpacing: 4,
              itemWidth: 80,
              itemHeight: 20,
              itemDirection: "left-to-right",
              symbolSize: 10,
              symbolShape: "circle",
            },
          ] : []}
        />
      )}
    </ChartWrapper>
  );
}
