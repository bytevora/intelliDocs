"use client";

import { VennData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";

interface VennRendererProps {
  data: VennData;
  theme: VisualTheme;
}

export function VennRenderer({ data, theme }: VennRendererProps) {
  const colors = THEME_COLORS[theme];
  const setCount = Math.min(data.sets.length, 3);

  // Circle positions for 2 or 3 sets
  const positions =
    setCount === 2
      ? [
          { cx: 160, cy: 170 },
          { cx: 280, cy: 170 },
        ]
      : [
          { cx: 220, cy: 140 },
          { cx: 160, cy: 230 },
          { cx: 280, cy: 230 },
        ];

  const radius = setCount === 2 ? 110 : 95;
  const svgWidth = 440;
  const svgHeight = setCount === 2 ? 340 : 360;

  // Label positions (outside the circles)
  const labelPositions =
    setCount === 2
      ? [
          { x: 100, y: 40 },
          { x: 340, y: 40 },
        ]
      : [
          { x: 220, y: 30 },
          { x: 40, y: 320 },
          { x: 400, y: 320 },
        ];

  // Intersection label position
  const intersectionPos =
    setCount === 2
      ? { x: 220, y: 170 }
      : { x: 220, y: 200 };

  return (
    <div className="w-full" style={{ color: colors.text }}>
      {data.title && (
        <h3 className="text-center text-lg font-bold mb-4" style={{ color: colors.text }}>
          {data.title}
        </h3>
      )}
      <div className="flex justify-center">
        <svg
          data-visual-svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full max-w-md"
          style={{ maxHeight: "350px" }}
        >
          <defs>
            {data.sets.slice(0, setCount).map((_, i) => (
              <linearGradient
                key={i}
                id={`venn-grad-${i}-${theme}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor={colors.palette[i % colors.palette.length]}
                  stopOpacity="0.35"
                />
                <stop
                  offset="100%"
                  stopColor={colors.palette[i % colors.palette.length]}
                  stopOpacity="0.15"
                />
              </linearGradient>
            ))}
          </defs>

          {/* Circles */}
          {positions.slice(0, setCount).map((pos, i) => (
            <circle
              key={i}
              cx={pos.cx}
              cy={pos.cy}
              r={radius}
              fill={`url(#venn-grad-${i}-${theme})`}
              stroke={colors.palette[i % colors.palette.length]}
              strokeWidth="2.5"
            />
          ))}

          {/* Set labels */}
          {data.sets.slice(0, setCount).map((set, i) => (
            <g key={`label-${i}`}>
              <text
                x={labelPositions[i].x}
                y={labelPositions[i].y}
                textAnchor="middle"
                fill={colors.palette[i % colors.palette.length]}
                fontSize="14"
                fontWeight="700"
              >
                {set.label}
              </text>
              {/* Items inside the circle (non-overlapping area) */}
              {set.items.slice(0, 3).map((item, j) => {
                const offsetY = positions[i].cy - 20 + j * 18;
                const offsetX =
                  setCount === 2
                    ? i === 0
                      ? positions[i].cx - 35
                      : positions[i].cx + 35
                    : positions[i].cx + (i === 0 ? 0 : i === 1 ? -30 : 30);
                return (
                  <text
                    key={j}
                    x={offsetX}
                    y={offsetY}
                    textAnchor="middle"
                    fill={colors.textMuted}
                    fontSize="11"
                  >
                    {item.length > 20 ? item.slice(0, 18) + "..." : item}
                  </text>
                );
              })}
            </g>
          ))}

          {/* Intersection items */}
          {data.intersections && data.intersections.length > 0 && (
            <g>
              {data.intersections[0].items.slice(0, 3).map((item, j) => (
                <text
                  key={j}
                  x={intersectionPos.x}
                  y={intersectionPos.y - 10 + j * 18}
                  textAnchor="middle"
                  fill={colors.text}
                  fontSize="11"
                  fontWeight="600"
                >
                  {item.length > 22 ? item.slice(0, 20) + "..." : item}
                </text>
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
