"use client";

import { OrgChartData, OrgNode, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";

interface OrgChartRendererProps {
  data: OrgChartData;
  theme: VisualTheme;
}

function OrgNodeCard({
  node,
  depth,
  colors,
  palette,
}: {
  node: OrgNode;
  depth: number;
  colors: ReturnType<typeof getColors>;
  palette: string[];
}) {
  const nodeColor = palette[depth % palette.length];
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div
        className="rounded-xl px-4 py-3 text-center relative min-w-[120px] max-w-[180px]"
        style={{
          backgroundColor: colors.cardBg,
          border: `2px solid ${nodeColor}`,
          boxShadow: depth === 0 ? `0 4px 12px ${nodeColor}20` : undefined,
        }}
      >
        {depth === 0 && (
          <div
            className="absolute -top-0.5 left-0 right-0 h-1 rounded-t-xl"
            style={{ backgroundColor: nodeColor }}
          />
        )}
        <p
          className="font-semibold text-sm"
          style={{ color: colors.text }}
        >
          {node.name}
        </p>
        {node.role && (
          <p
            className="text-xs mt-0.5"
            style={{ color: colors.textMuted }}
          >
            {node.role}
          </p>
        )}
      </div>

      {/* Children */}
      {hasChildren && (
        <>
          {/* Vertical connector */}
          <div
            className="w-0.5 h-5"
            style={{ backgroundColor: colors.border }}
          />
          {/* Horizontal connector bar */}
          {node.children!.length > 1 && (
            <div
              className="h-0.5"
              style={{
                backgroundColor: colors.border,
                width: `calc(${(node.children!.length - 1) * 100}% / ${node.children!.length} + 120px)`,
                maxWidth: "100%",
              }}
            />
          )}
          <div className="flex gap-6 items-start">
            {node.children!.map((child, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="w-0.5 h-5"
                  style={{ backgroundColor: colors.border }}
                />
                <OrgNodeCard
                  node={child}
                  depth={depth + 1}
                  colors={colors}
                  palette={palette}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function getColors(theme: VisualTheme) {
  return THEME_COLORS[theme];
}

export function OrgChartRenderer({ data, theme }: OrgChartRendererProps) {
  const colors = getColors(theme);

  return (
    <div className="w-full overflow-x-auto" style={{ color: colors.text }}>
      {data.title && (
        <h3 className="text-center text-lg font-bold mb-6" style={{ color: colors.text }}>
          {data.title}
        </h3>
      )}
      <div className="flex justify-center min-w-fit">
        <OrgNodeCard
          node={data.root}
          depth={0}
          colors={colors}
          palette={colors.palette}
        />
      </div>
    </div>
  );
}
