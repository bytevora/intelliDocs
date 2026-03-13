"use client";

import { StatsData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";

interface StatsRendererProps {
  data: StatsData;
  theme: VisualTheme;
}

function TrendIcon({ trend, color }: { trend?: string; color: string }) {
  if (trend === "up") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 3L13 8H10V13H6V8H3L8 3Z" fill={color} />
      </svg>
    );
  }
  if (trend === "down") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 13L3 8H6V3H10V8H13L8 13Z" fill={color} />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8H13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function StatsRenderer({ data, theme }: StatsRendererProps) {
  const colors = THEME_COLORS[theme];

  return (
    <div className="w-full" style={{ color: colors.text }}>
      {data.title && (
        <h3 className="text-center text-lg font-bold mb-5" style={{ color: colors.text }}>
          {data.title}
        </h3>
      )}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${Math.min(data.metrics.length, 3)}, 1fr)`,
        }}
      >
        {data.metrics.map((metric, i) => {
          const accentColor = colors.palette[i % colors.palette.length];
          const trendColor =
            metric.trend === "up" ? "#10b981" : metric.trend === "down" ? "#ef4444" : colors.textMuted;

          return (
            <div
              key={i}
              className="rounded-xl p-5 relative overflow-hidden"
              style={{
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.border}`,
              }}
            >
              {/* Decorative gradient circle */}
              <div
                className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10"
                style={{ backgroundColor: accentColor }}
              />
              <p
                className="text-xs font-medium uppercase tracking-wider mb-2"
                style={{ color: colors.textMuted }}
              >
                {metric.label}
              </p>
              <p
                className="text-2xl font-bold mb-1"
                style={{ color: colors.text }}
              >
                {metric.value}
              </p>
              {metric.change && (
                <div className="flex items-center gap-1">
                  <TrendIcon trend={metric.trend} color={trendColor} />
                  <span
                    className="text-sm font-medium"
                    style={{ color: trendColor }}
                  >
                    {metric.change}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
