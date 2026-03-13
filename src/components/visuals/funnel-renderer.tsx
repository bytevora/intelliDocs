"use client";

import { FunnelData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";

interface FunnelRendererProps {
  data: FunnelData;
  theme: VisualTheme;
}

export function FunnelRenderer({ data, theme }: FunnelRendererProps) {
  const colors = THEME_COLORS[theme];
  const maxStages = data.stages.length;

  return (
    <div className="w-full max-w-lg mx-auto" style={{ color: colors.text }}>
      {data.title && (
        <h3 className="text-center text-lg font-bold mb-6" style={{ color: colors.text }}>
          {data.title}
        </h3>
      )}
      <div className="flex flex-col items-center gap-1">
        {data.stages.map((stage, i) => {
          const widthPercent = 100 - (i / maxStages) * 50;
          const opacity = 1 - (i / maxStages) * 0.4;
          const colorIdx = i % colors.palette.length;
          const stageColor = colors.palette[colorIdx];

          return (
            <div
              key={i}
              className="relative flex items-center justify-center py-3 px-4 transition-all duration-300"
              style={{
                width: `${widthPercent}%`,
                backgroundColor: stageColor,
                opacity,
                borderRadius: i === 0 ? "12px 12px 4px 4px" : i === maxStages - 1 ? "4px 4px 12px 12px" : "4px",
                minHeight: "52px",
              }}
            >
              <div className="flex items-center justify-between w-full gap-3">
                <span
                  className="font-medium text-sm truncate"
                  style={{ color: "#ffffff" }}
                >
                  {stage.label}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm" style={{ color: "#ffffff" }}>
                    {stage.value}
                  </span>
                  {stage.percentage !== undefined && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.25)",
                        color: "#ffffff",
                      }}
                    >
                      {stage.percentage}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
