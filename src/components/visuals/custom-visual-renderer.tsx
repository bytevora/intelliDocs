"use client";

import {
  CustomVisualType,
  DataChartType,
  VisualTheme,
  ComparisonData,
  FunnelData,
  StatsData,
  SwotData,
  OrgChartData,
  VennData,
  MindmapData,
  BarChartData,
  LineChartData,
  AreaChartData,
  DonutChartData,
  RadarChartData,
  ScatterChartData,
  HeatmapChartData,
  SankeyChartData,
} from "@/types";
import {
  ComparisonRenderer,
  FunnelRenderer,
  StatsRenderer,
  SwotRenderer,
  OrgChartRenderer,
  VennRenderer,
  MindmapRenderer,
  BarChartRenderer,
  LineChartRenderer,
  AreaChartRenderer,
  DonutChartRenderer,
  RadarChartRenderer,
  ScatterChartRenderer,
  HeatmapChartRenderer,
  SankeyChartRenderer,
} from ".";

interface CustomVisualRendererProps {
  visualType: CustomVisualType | DataChartType;
  customData: string;
  theme: VisualTheme;
  onCustomDataChange?: (newData: string) => void;
}

export function CustomVisualRenderer({
  visualType,
  customData,
  theme,
  onCustomDataChange,
}: CustomVisualRendererProps) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(customData);
  } catch {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">Failed to parse visual data</p>
      </div>
    );
  }

  switch (visualType) {
    case "mindmap":
      return (
        <MindmapRenderer
          data={parsed as MindmapData}
          theme={theme}
          onDataChange={onCustomDataChange ? (newData) => onCustomDataChange(JSON.stringify(newData)) : undefined}
        />
      );
    case "comparison":
      return <ComparisonRenderer data={parsed as ComparisonData} theme={theme} />;
    case "funnel":
      return <FunnelRenderer data={parsed as FunnelData} theme={theme} />;
    case "stats":
      return <StatsRenderer data={parsed as StatsData} theme={theme} />;
    case "swot":
      return <SwotRenderer data={parsed as SwotData} theme={theme} />;
    case "orgchart":
      return <OrgChartRenderer data={parsed as OrgChartData} theme={theme} />;
    case "venn":
      return <VennRenderer data={parsed as VennData} theme={theme} />;
    // Data chart types
    case "bar":
      return (
        <BarChartRenderer
          data={parsed as BarChartData}
          theme={theme}
          onDataChange={onCustomDataChange ? (newData) => onCustomDataChange(JSON.stringify(newData)) : undefined}
        />
      );
    case "line":
      return <LineChartRenderer data={parsed as LineChartData} theme={theme} />;
    case "area":
      return <AreaChartRenderer data={parsed as AreaChartData} theme={theme} />;
    case "donut":
      return <DonutChartRenderer data={parsed as DonutChartData} theme={theme} />;
    case "radar":
      return <RadarChartRenderer data={parsed as RadarChartData} theme={theme} />;
    case "scatter":
      return <ScatterChartRenderer data={parsed as ScatterChartData} theme={theme} />;
    case "heatmap":
      return <HeatmapChartRenderer data={parsed as HeatmapChartData} theme={theme} />;
    case "sankey":
      return <SankeyChartRenderer data={parsed as SankeyChartData} theme={theme} />;
    default:
      return (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            Unknown visual type: {visualType}
          </p>
        </div>
      );
  }
}
