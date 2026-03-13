"use client";

import { ResponsiveScatterPlot } from "@nivo/scatterplot";
import { ScatterChartData, VisualTheme } from "@/types";
import { ChartWrapper } from "./chart-wrapper";

interface ScatterChartRendererProps {
  data: ScatterChartData;
  theme: VisualTheme;
}

export function ScatterChartRenderer({ data, theme }: ScatterChartRendererProps) {
  return (
    <ChartWrapper title={data.title} theme={theme}>
      {(nivoTheme, colors) => (
        <ResponsiveScatterPlot
          data={data.series}
          margin={{ top: 10, right: 20, bottom: 50, left: 60 }}
          xScale={{ type: "linear", min: "auto", max: "auto" }}
          yScale={{ type: "linear", min: "auto", max: "auto" }}
          colors={colors}
          nodeSize={10}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
          }}
          useMesh={true}
          animate={true}
          motionConfig="gentle"
          theme={nivoTheme}
          legends={data.series.length > 1 ? [
            {
              anchor: "bottom",
              direction: "row",
              translateY: 48,
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
