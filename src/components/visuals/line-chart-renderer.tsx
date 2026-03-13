"use client";

import { ResponsiveLine } from "@nivo/line";
import { LineChartData, VisualTheme } from "@/types";
import { ChartWrapper } from "./chart-wrapper";

interface LineChartRendererProps {
  data: LineChartData;
  theme: VisualTheme;
}

export function LineChartRenderer({ data, theme }: LineChartRendererProps) {
  return (
    <ChartWrapper title={data.title} theme={theme}>
      {(nivoTheme, colors) => (
        <ResponsiveLine
          data={data.series}
          margin={{ top: 10, right: 20, bottom: 50, left: 50 }}
          xScale={{ type: "point" }}
          yScale={{ type: "linear", min: "auto", max: "auto", stacked: false }}
          curve="catmullRom"
          colors={colors}
          lineWidth={2.5}
          pointSize={8}
          pointColor={{ theme: "background" }}
          pointBorderWidth={2}
          pointBorderColor={{ from: "serieColor" }}
          pointLabelYOffset={-12}
          enableGridX={false}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: -30,
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
              itemsSpacing: 2,
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
