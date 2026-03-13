"use client";

import { ComparisonData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";

interface ComparisonRendererProps {
  data: ComparisonData;
  theme: VisualTheme;
}

export function ComparisonRenderer({ data, theme }: ComparisonRendererProps) {
  const colors = THEME_COLORS[theme];

  return (
    <div className="w-full" style={{ color: colors.text }}>
      {data.title && (
        <h3
          className="text-center text-lg font-bold mb-4"
          style={{ color: colors.text }}
        >
          {data.title}
        </h3>
      )}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${Math.min(data.items.length, 4)}, 1fr)`,
        }}
      >
        {data.items.map((item, i) => {
          const itemColor = item.color || colors.palette[i % colors.palette.length];
          return (
            <div
              key={i}
              className="rounded-xl p-4 relative overflow-hidden"
              style={{
                backgroundColor: colors.cardBg,
                border: `2px solid ${itemColor}20`,
              }}
            >
              {/* Color accent bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: itemColor }}
              />
              <h4
                className="font-semibold text-base mt-2 mb-3"
                style={{ color: itemColor }}
              >
                {item.name}
              </h4>
              <ul className="space-y-2">
                {item.points.map((point, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: itemColor }}
                    />
                    <span style={{ color: colors.text }}>{point}</span>
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
