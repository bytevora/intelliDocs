"use client";

import { SwotData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";

interface SwotRendererProps {
  data: SwotData;
  theme: VisualTheme;
}

const QUADRANTS = [
  { key: "strengths" as const, label: "Strengths", icon: "S", defaultColor: "#10b981" },
  { key: "weaknesses" as const, label: "Weaknesses", icon: "W", defaultColor: "#ef4444" },
  { key: "opportunities" as const, label: "Opportunities", icon: "O", defaultColor: "#3b82f6" },
  { key: "threats" as const, label: "Threats", icon: "T", defaultColor: "#f59e0b" },
];

export function SwotRenderer({ data, theme }: SwotRendererProps) {
  const colors = THEME_COLORS[theme];

  return (
    <div className="w-full" style={{ color: colors.text }}>
      {data.title && (
        <h3 className="text-center text-lg font-bold mb-5" style={{ color: colors.text }}>
          {data.title}
        </h3>
      )}
      <div className="grid grid-cols-2 gap-3">
        {QUADRANTS.map((q, i) => {
          const items = data[q.key];
          const quadColor = colors.palette[i % colors.palette.length] || q.defaultColor;

          return (
            <div
              key={q.key}
              className="rounded-xl p-4 relative overflow-hidden"
              style={{
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{
                    backgroundColor: quadColor,
                    color: "#ffffff",
                  }}
                >
                  {q.icon}
                </div>
                <h4
                  className="font-semibold text-sm"
                  style={{ color: quadColor }}
                >
                  {q.label}
                </h4>
              </div>
              <ul className="space-y-1.5">
                {items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: quadColor }}
                    />
                    <span style={{ color: colors.text }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
