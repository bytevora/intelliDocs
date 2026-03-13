"use client";

import { ResponsiveSankey } from "@nivo/sankey";
import { SankeyChartData, VisualTheme } from "@/types";
import { ChartWrapper } from "./chart-wrapper";
import { THEME_COLORS } from "./theme-colors";

interface SankeyChartRendererProps {
  data: SankeyChartData;
  theme: VisualTheme;
}

export function SankeyChartRenderer({ data, theme }: SankeyChartRendererProps) {
  const tc = THEME_COLORS[theme];

  return (
    <ChartWrapper title={data.title} theme={theme} height={340}>
      {(nivoTheme, colors) => (
        <ResponsiveSankey
          data={{ nodes: data.nodes, links: data.links }}
          margin={{ top: 20, right: 120, bottom: 20, left: 20 }}
          align="justify"
          colors={colors}
          nodeOpacity={1}
          nodeHoverOthersOpacity={0.35}
          nodeThickness={16}
          nodeSpacing={20}
          nodeBorderWidth={1}
          nodeBorderColor={{ from: "color", modifiers: [["darker", 0.4]] }}
          nodeBorderRadius={3}
          linkOpacity={0.4}
          linkHoverOthersOpacity={0.1}
          linkContract={2}
          enableLinkGradient={true}
          labelPosition="outside"
          labelOrientation="horizontal"
          labelPadding={12}
          labelTextColor={tc.text}
          animate={true}
          motionConfig="gentle"
          theme={nivoTheme}
        />
      )}
    </ChartWrapper>
  );
}
