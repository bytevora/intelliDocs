"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { RadarChartData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";
import { hexToRgb, lightenColor, formatNumber } from "./chart-utils";

// ── Constants ────────────────────────────────────────────
const ANIM_DURATION = 500;
const POINT_R = 5;
const POINT_HOVER_R = 8;
const VALUE_FONT = 11;
const LABEL_FONT = 11;
const LEGEND_FONT = 11;
const BTN_R = 11;
const GRID_LEVELS = 5;
const LABEL_OFFSET = 24;

// ── Polar helpers ────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number): { x: number; y: number } {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

/** Angle for axis i out of n, starting at top (-PI/2) going clockwise */
function axisAngle(i: number, n: number): number {
  return -Math.PI / 2 + (2 * Math.PI * i) / n;
}

// ── Layout types ─────────────────────────────────────────

interface RadarVertex {
  x: number;
  y: number;
  value: number;
  axisIndex: number;
  keyIndex: number;
  color: string;
  angle: number;
}

interface RadarSeriesLayout {
  keyIndex: number;
  key: string;
  color: string;
  vertices: RadarVertex[];
  path: string;
  animatedPath: string; // collapsed to center
}

interface RadarLayout {
  cx: number;
  cy: number;
  radius: number;
  maxVal: number;
  numAxes: number;
  axisLabels: { label: string; x: number; y: number; angle: number; axisIndex: number }[];
  gridCircles: { r: number; value: number }[];
  axisLines: { x1: number; y1: number; x2: number; y2: number }[];
  seriesLayouts: RadarSeriesLayout[];
}

// ── Layout computation ───────────────────────────────────

function computeLayout(
  data: RadarChartData,
  width: number,
  height: number,
  palette: string[]
): RadarLayout {
  const margin = 60;
  const radius = Math.max(40, Math.min(width - margin * 2, height - margin * 2) / 2);
  const cx = width / 2;
  const cy = height / 2;
  const numAxes = data.data.length;
  const keys = data.keys;

  // Find max value across all data
  let rawMax = 0;
  for (const row of data.data) {
    for (const k of keys) {
      rawMax = Math.max(rawMax, Number(row[k]) || 0);
    }
  }
  // Nice round max
  const maxVal = rawMax <= 0 ? 10 : Math.ceil(rawMax * 1.1);

  // Grid circles
  const gridCircles: { r: number; value: number }[] = [];
  for (let level = 1; level <= GRID_LEVELS; level++) {
    const frac = level / GRID_LEVELS;
    gridCircles.push({ r: radius * frac, value: Math.round(maxVal * frac) });
  }

  // Axis lines
  const axisLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < numAxes; i++) {
    const angle = axisAngle(i, numAxes);
    const end = polarToCartesian(cx, cy, radius, angle);
    axisLines.push({ x1: cx, y1: cy, x2: end.x, y2: end.y });
  }

  // Axis labels
  const axisLabels = data.data.map((row, i) => {
    const angle = axisAngle(i, numAxes);
    const pos = polarToCartesian(cx, cy, radius + LABEL_OFFSET, angle);
    return { label: String(row[data.indexBy] ?? `Axis ${i + 1}`), x: pos.x, y: pos.y, angle, axisIndex: i };
  });

  // Series layouts
  const seriesLayouts: RadarSeriesLayout[] = keys.map((key, ki) => {
    const color = palette[ki % palette.length];
    const vertices: RadarVertex[] = data.data.map((row, ai) => {
      const value = Number(row[key]) || 0;
      const angle = axisAngle(ai, numAxes);
      const r = maxVal > 0 ? (value / maxVal) * radius : 0;
      const pos = polarToCartesian(cx, cy, r, angle);
      return { x: pos.x, y: pos.y, value, axisIndex: ai, keyIndex: ki, color, angle };
    });

    const path = vertices.length > 0
      ? vertices.map((v, i) => `${i === 0 ? "M" : "L"}${v.x},${v.y}`).join("") + "Z"
      : "";

    // Collapsed path (all at center)
    const animatedPath = vertices.length > 0
      ? vertices.map((_, i) => `${i === 0 ? "M" : "L"}${cx},${cy}`).join("") + "Z"
      : "";

    return { keyIndex: ki, key, color, vertices, path, animatedPath };
  });

  return { cx, cy, radius, maxVal, numAxes, axisLabels, gridCircles, axisLines, seriesLayouts };
}

// ── Editable point value (click to edit) ─────────────────

function EditablePointValue({
  vertex, cx, cy, isDark, mounted, onValueChange,
}: {
  vertex: RadarVertex; cx: number; cy: number; isDark: boolean; mounted: boolean;
  onValueChange: (axisIndex: number, keyIndex: number, newVal: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayX = mounted ? vertex.x : cx;
  const displayY = mounted ? vertex.y : cy;

  // Offset the label away from center
  const dx = displayX - cx;
  const dy = displayY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const labelOffX = dist > 0 ? (dx / dist) * 16 : 0;
  const labelOffY = dist > 0 ? (dy / dist) * 16 : -16;

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    setEditing(true);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
  }, []);

  const commit = useCallback(() => {
    setEditing(false);
    const raw = inputRef.current?.value ?? "";
    const val = parseFloat(raw);
    if (!isNaN(val) && val >= 0 && val !== vertex.value) onValueChange(vertex.axisIndex, vertex.keyIndex, val);
  }, [vertex, onValueChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") setEditing(false);
  }, [commit]);

  if (editing) {
    return (
      <foreignObject x={displayX + labelOffX - 32} y={displayY + labelOffY - 12} width={64} height={24}
        style={{ transition: `x ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }}>
        <input ref={inputRef} type="number" min={0} step="any" defaultValue={vertex.value}
          onBlur={commit} onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "100%", height: "100%", fontSize: VALUE_FONT, fontWeight: 700,
            textAlign: "center",
            background: isDark ? "rgba(30,30,50,0.95)" : "rgba(255,255,255,0.95)",
            color: isDark ? "#e2e8f0" : "#1e293b",
            border: `2px solid ${vertex.color}`, borderRadius: 4, outline: "none",
            padding: "0 4px", boxShadow: `0 0 0 3px ${vertex.color}33`,
          }}
        />
      </foreignObject>
    );
  }

  const displayText = formatNumber(vertex.value);
  return (
    <text
      x={displayX + labelOffX} y={displayY + labelOffY}
      textAnchor="middle" dominantBaseline="central"
      fontSize={VALUE_FONT} fontWeight={700} fontFamily="system-ui, -apple-system, sans-serif"
      fill={vertex.color}
      onClick={startEdit}
      style={{
        cursor: "pointer", pointerEvents: "auto",
        transition: `x ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
      }}
    >
      {displayText}
    </text>
  );
}

// ── Editable axis label (double-click to edit) ───────────

function EditableAxisLabel({
  label, x, y, angle, isDark, textColor, onLabelChange,
}: {
  label: string; x: number; y: number; angle: number; isDark: boolean; textColor: string;
  onLabelChange: (newLabel: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Determine text anchor based on angle
  const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const isRight = normalizedAngle < Math.PI * 0.4 || normalizedAngle > Math.PI * 1.6;
  const isLeft = normalizedAngle > Math.PI * 0.6 && normalizedAngle < Math.PI * 1.4;
  const textAnchor = isRight ? "start" : isLeft ? "end" : "middle";

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    setEditing(true);
    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.focus();
        const range = document.createRange(); range.selectNodeContents(ref.current);
        const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range);
      }
    });
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    setEditing(false);
    const newText = e.currentTarget.textContent?.trim() || label;
    if (newText !== label) onLabelChange(newText);
  }, [label, onLabelChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); }
    if (e.key === "Escape") { if (ref.current) ref.current.textContent = label; (e.target as HTMLElement).blur(); }
  }, [label]);

  if (editing) {
    return (
      <foreignObject x={x - 50} y={y - 14} width={100} height={28}>
        <div ref={ref} contentEditable suppressContentEditableWarning
          onBlur={handleBlur} onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: LABEL_FONT, fontFamily: "system-ui, -apple-system, sans-serif",
            color: isDark ? "#e2e8f0" : "#1e293b", textAlign: "center", outline: "none", cursor: "text",
            borderRadius: 4,
            background: isDark ? "rgba(30,30,50,0.95)" : "rgba(255,255,255,0.95)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"}`,
            padding: "2px 4px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>
          {label}
        </div>
      </foreignObject>
    );
  }

  return (
    <text
      x={x} y={y}
      textAnchor={textAnchor} dominantBaseline="central"
      fontSize={LABEL_FONT} fontFamily="system-ui, -apple-system, sans-serif"
      fill={textColor}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: "pointer", pointerEvents: "auto" }}
    >
      {label}
    </text>
  );
}

// ── Editable legend item ─────────────────────────────────

function EditableLegendItem({
  seriesKey, color, isDark, textColor, x, y, onRename, onRemove, canRemove,
}: {
  seriesKey: string; color: string; isDark: boolean; textColor: string;
  x: number; y: number;
  onRename: (newName: string) => void; onRemove: () => void; canRemove: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.focus();
        const range = document.createRange(); range.selectNodeContents(ref.current);
        const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range);
      }
    });
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    setEditing(false);
    const newText = e.currentTarget.textContent?.trim() || seriesKey;
    if (newText !== seriesKey) onRename(newText);
  }, [seriesKey, onRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); }
    if (e.key === "Escape") { if (ref.current) ref.current.textContent = seriesKey; (e.target as HTMLElement).blur(); }
  }, [seriesKey]);

  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <circle cx={x} cy={y + 7} r={5} fill={color} />
      <foreignObject x={x + 10} y={y - 2} width={70} height={18}>
        <div ref={ref} contentEditable={editing} suppressContentEditableWarning
          onDoubleClick={handleDoubleClick} onBlur={handleBlur} onKeyDown={handleKeyDown}
          style={{
            fontSize: LEGEND_FONT, fontFamily: "system-ui, -apple-system, sans-serif",
            color: textColor, outline: "none",
            cursor: editing ? "text" : "default", userSelect: editing ? "text" : "none",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "18px",
            background: editing ? (isDark ? "rgba(30,30,50,0.9)" : "rgba(255,255,255,0.9)") : "transparent",
            borderRadius: 3, padding: "0 2px",
          }}>
          {seriesKey}
        </div>
      </foreignObject>
      {canRemove && hovered && !editing && (
        <g data-export-ignore style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <circle cx={x + 86} cy={y + 7} r={7} fill={isDark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.15)"} stroke="#ef4444" strokeWidth={1} strokeOpacity={0.6} />
          <line x1={x + 83} y1={y + 7} x2={x + 89} y2={y + 7} stroke={isDark ? "#fca5a5" : "#ef4444"} strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

// ── Action button (add/remove) ───────────────────────────

function ActionButton({
  cx, cy, type, color, isDark, onClick,
}: {
  cx: number; cy: number; type: "add" | "remove"; color: string; isDark: boolean;
  onClick: () => void;
}) {
  const rgb = hexToRgb(color);
  const bgFill = type === "add"
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.35 : 0.2})`
    : `rgba(239, 68, 68, ${isDark ? 0.35 : 0.2})`;
  const strokeCol = type === "add" ? color : "#ef4444";
  const iconColor = type === "add" ? (isDark ? lightenColor(color, 0.6) : color) : (isDark ? "#fca5a5" : "#ef4444");

  return (
    <g data-export-ignore style={{ cursor: "pointer", pointerEvents: "auto" }}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      onMouseDown={(e) => e.stopPropagation()}>
      <circle cx={cx} cy={cy} r={BTN_R + 4} fill="transparent" />
      <circle cx={cx} cy={cy} r={BTN_R} fill={bgFill} stroke={strokeCol} strokeWidth={1.2} strokeOpacity={0.6} />
      {type === "add" ? (
        <>
          <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke={iconColor} strokeWidth={1.8} strokeLinecap="round" />
          <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} stroke={iconColor} strokeWidth={1.8} strokeLinecap="round" />
        </>
      ) : (
        <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke={iconColor} strokeWidth={1.8} strokeLinecap="round" />
      )}
    </g>
  );
}

// ── Main renderer ────────────────────────────────────────

interface RadarChartRendererProps {
  data: RadarChartData;
  theme: VisualTheme;
  onDataChange?: (data: RadarChartData) => void;
}

export function RadarChartRenderer({ data, theme, onDataChange }: RadarChartRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [mounted, setMounted] = useState(false);
  const [hoveredPt, setHoveredPt] = useState<{ ki: number; ai: number } | null>(null);
  const [hoveredAxis, setHoveredAxis] = useState<number | null>(null);

  const colors = THEME_COLORS[theme];
  const palette = colors.palette;
  const isDark = theme === "dark";
  const titleColor = isDark ? "#e2e8f0" : colors.text;
  const axisColor = colors.textMuted;
  const gridColor = colors.border;

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Mount animation
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

  // Re-trigger animation on data change
  const prevDataRef = useRef(data);
  useEffect(() => {
    if (prevDataRef.current !== data) {
      setMounted(false);
      const t = setTimeout(() => setMounted(true), 30);
      prevDataRef.current = data;
      return () => clearTimeout(t);
    }
  }, [data]);

  const svgHeight = 380;
  const legendH = data.keys.length > 1 ? 30 : 0;
  const totalH = svgHeight + legendH;
  const layout = computeLayout(data, containerWidth, svgHeight, palette);

  // ── Edit handlers ──────────────────────────────────────

  const handleValueChange = useCallback((axisIndex: number, keyIndex: number, newVal: number) => {
    if (!onDataChange) return;
    const key = data.keys[keyIndex];
    onDataChange({
      ...data,
      data: data.data.map((row, i) => i !== axisIndex ? row : { ...row, [key]: newVal }),
    });
  }, [data, onDataChange]);

  const handleLabelChange = useCallback((axisIndex: number, newLabel: string) => {
    if (!onDataChange) return;
    onDataChange({
      ...data,
      data: data.data.map((row, i) => i !== axisIndex ? row : { ...row, [data.indexBy]: newLabel }),
    });
  }, [data, onDataChange]);

  const handleAddAxis = useCallback(() => {
    if (!onDataChange) return;
    const newRow: Record<string, string | number> = { [data.indexBy]: `Axis ${data.data.length + 1}` };
    for (const k of data.keys) newRow[k] = 0;
    onDataChange({ ...data, data: [...data.data, newRow] });
  }, [data, onDataChange]);

  const handleRemoveAxis = useCallback((axisIndex: number) => {
    if (!onDataChange || data.data.length <= 3) return; // Need at least 3 axes for a radar
    onDataChange({ ...data, data: data.data.filter((_, i) => i !== axisIndex) });
  }, [data, onDataChange]);

  const handleRenameSeries = useCallback((keyIndex: number, newName: string) => {
    if (!onDataChange) return;
    const oldKey = data.keys[keyIndex];
    if (newName === oldKey || !newName) return;
    const newKeys = data.keys.map((k, i) => i === keyIndex ? newName : k);
    const newRows = data.data.map((row) => {
      const r = { ...row };
      r[newName] = r[oldKey];
      delete r[oldKey];
      return r;
    });
    onDataChange({ ...data, keys: newKeys, data: newRows });
  }, [data, onDataChange]);

  const handleAddSeries = useCallback(() => {
    if (!onDataChange) return;
    const newKey = `Series ${data.keys.length + 1}`;
    onDataChange({
      ...data,
      keys: [...data.keys, newKey],
      data: data.data.map((row) => ({ ...row, [newKey]: 0 })),
    });
  }, [data, onDataChange]);

  const handleRemoveSeries = useCallback((keyIndex: number) => {
    if (!onDataChange || data.keys.length <= 1) return;
    const removeKey = data.keys[keyIndex];
    const newKeys = data.keys.filter((_, i) => i !== keyIndex);
    onDataChange({
      ...data,
      keys: newKeys,
      data: data.data.map((row) => { const r = { ...row }; delete r[removeKey]; return r; }),
    });
  }, [data, onDataChange]);

  const handleTitleBlur = useCallback((e: React.FocusEvent<HTMLHeadingElement>) => {
    const newTitle = e.currentTarget.textContent?.trim() || data.title;
    if (newTitle !== data.title && onDataChange) onDataChange({ ...data, title: newTitle });
  }, [data, onDataChange]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); }
  }, []);

  return (
    <div ref={containerRef} className="w-full relative">
      {data.title && (
        <h3
          contentEditable={!!onDataChange}
          suppressContentEditableWarning
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          className="text-center text-lg font-bold mb-3 tracking-tight outline-none cursor-text focus:ring-1 focus:ring-primary/30 focus:rounded px-2"
          style={{ color: titleColor }}
        >
          {data.title}
        </h3>
      )}

      <svg
        data-visual-svg
        width="100%"
        height={totalH}
        viewBox={`0 0 ${containerWidth} ${totalH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: "visible" }}
      >
        {/* Concentric circular grid lines */}
        {layout.gridCircles.map((gc, i) => (
          <circle
            key={`grid-${i}`}
            cx={layout.cx} cy={layout.cy} r={gc.r}
            fill="none" stroke={gridColor} strokeOpacity={0.3}
            strokeDasharray={i < GRID_LEVELS - 1 ? "4 3" : "none"}
          />
        ))}

        {/* Grid level value labels (on the top axis) */}
        {layout.gridCircles.map((gc, i) => (
          <text
            key={`grid-val-${i}`}
            x={layout.cx + 4} y={layout.cy - gc.r - 2}
            fontSize={9} fontFamily="system-ui, -apple-system, sans-serif"
            fill={axisColor} opacity={0.7}
          >
            {formatNumber(gc.value)}
          </text>
        ))}

        {/* Axis lines from center to edge */}
        {layout.axisLines.map((line, i) => (
          <line
            key={`axis-${i}`}
            x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            stroke={gridColor} strokeOpacity={0.4} strokeWidth={1}
          />
        ))}

        {/* Axis hover zones for remove buttons */}
        {layout.axisLabels.map((al) => {
          const endPos = polarToCartesian(layout.cx, layout.cy, layout.radius + LABEL_OFFSET + 20, al.angle);
          return (
            <line
              key={`axis-hit-${al.axisIndex}`}
              x1={layout.cx} y1={layout.cy} x2={endPos.x} y2={endPos.y}
              stroke="transparent" strokeWidth={20}
              style={{ pointerEvents: "stroke" }}
              onMouseEnter={() => setHoveredAxis(al.axisIndex)}
              onMouseLeave={() => setHoveredAxis(null)}
            />
          );
        })}

        {/* Filled polygons for each series */}
        {layout.seriesLayouts.map((sl) => {
          const rgb = hexToRgb(sl.color);
          const isAnyHovered = hoveredPt?.ki === sl.keyIndex;
          return (
            <g key={`series-${sl.keyIndex}`}>
              {/* Fill area */}
              <path
                d={mounted ? sl.path : sl.animatedPath}
                fill={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isAnyHovered ? 0.3 : 0.15})`}
                stroke={sl.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeOpacity={isAnyHovered ? 1 : 0.8}
                style={{
                  transition: `d ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), fill ${150}ms ease, stroke-opacity 150ms ease`,
                }}
              />
            </g>
          );
        })}

        {/* Dots at each vertex */}
        {layout.seriesLayouts.map((sl) =>
          sl.vertices.map((v) => {
            const isHovered = hoveredPt?.ki === v.keyIndex && hoveredPt?.ai === v.axisIndex;
            const displayX = mounted ? v.x : layout.cx;
            const displayY = mounted ? v.y : layout.cy;
            const rgb = hexToRgb(v.color);

            return (
              <g key={`dot-${v.keyIndex}-${v.axisIndex}`}
                onMouseEnter={() => setHoveredPt({ ki: v.keyIndex, ai: v.axisIndex })}
                onMouseLeave={() => setHoveredPt(null)}
                style={{ cursor: "pointer" }}>
                {/* Invisible hit target */}
                <circle cx={displayX} cy={displayY} r={POINT_HOVER_R + 4} fill="transparent"
                  style={{ transition: `cx ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), cy ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }} />
                {/* Glow on hover */}
                {isHovered && (
                  <circle cx={displayX} cy={displayY} r={POINT_HOVER_R + 3}
                    fill={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`}
                    style={{ transition: `cx ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), cy ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }} />
                )}
                {/* Outer ring */}
                <circle cx={displayX} cy={displayY} r={isHovered ? POINT_HOVER_R : POINT_R}
                  fill={isDark ? colors.cardBg : "#fff"} stroke={v.color} strokeWidth={2.5}
                  style={{ transition: `cx ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), cy ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), r 150ms ease` }} />
                {/* Inner dot */}
                <circle cx={displayX} cy={displayY} r={isHovered ? 3 : 2}
                  fill={v.color}
                  style={{ transition: `cx ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), cy ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), r 150ms ease` }} />
              </g>
            );
          })
        )}

        {/* Value labels near each point (click to edit) */}
        {layout.seriesLayouts.map((sl) =>
          sl.vertices.map((v) => (
            <EditablePointValue
              key={`val-${v.keyIndex}-${v.axisIndex}`}
              vertex={v}
              cx={layout.cx} cy={layout.cy}
              isDark={isDark} mounted={mounted}
              onValueChange={onDataChange ? handleValueChange : () => {}}
            />
          ))
        )}

        {/* Axis labels at outer edge (double-click to edit) */}
        {layout.axisLabels.map((al) => (
          <EditableAxisLabel
            key={`label-${al.axisIndex}`}
            label={al.label}
            x={al.x} y={al.y}
            angle={al.angle}
            isDark={isDark} textColor={axisColor}
            onLabelChange={(newLabel) => handleLabelChange(al.axisIndex, newLabel)}
          />
        ))}

        {/* Remove axis button (on hover) */}
        {onDataChange && hoveredAxis !== null && data.data.length > 3 && (() => {
          const al = layout.axisLabels[hoveredAxis];
          if (!al) return null;
          const btnPos = polarToCartesian(layout.cx, layout.cy, layout.radius + LABEL_OFFSET + 16, al.angle);
          // Offset the button perpendicular to the axis
          const perpAngle = al.angle + Math.PI / 2;
          const offsetX = Math.cos(perpAngle) * 18;
          const offsetY = Math.sin(perpAngle) * 18;
          return (
            <ActionButton
              cx={btnPos.x + offsetX} cy={btnPos.y + offsetY}
              type="remove" color="#ef4444" isDark={isDark}
              onClick={() => handleRemoveAxis(hoveredAxis)}
            />
          );
        })()}

        {/* Add axis button (positioned outside the chart) */}
        {onDataChange && (
          <ActionButton
            cx={layout.cx + layout.radius + LABEL_OFFSET + 30}
            cy={layout.cy - layout.radius - LABEL_OFFSET}
            type="add" color={palette[data.data.length % palette.length]} isDark={isDark}
            onClick={handleAddAxis}
          />
        )}

        {/* Legend (multi-series) */}
        {data.keys.length > 1 && (() => {
          const legendY = svgHeight + 4;
          const itemWidth = 100;
          const totalLegendW = data.keys.length * itemWidth + (onDataChange ? 30 : 0);
          const startX = (containerWidth - totalLegendW) / 2;
          return (
            <g>
              {data.keys.map((k, i) => (
                <EditableLegendItem
                  key={`legend-${k}`} seriesKey={k}
                  color={palette[i % palette.length]} isDark={isDark} textColor={axisColor}
                  x={startX + i * itemWidth} y={legendY}
                  onRename={(n) => handleRenameSeries(i, n)}
                  onRemove={() => handleRemoveSeries(i)}
                  canRemove={!!onDataChange && data.keys.length > 1}
                />
              ))}
              {onDataChange && (
                <ActionButton
                  cx={startX + data.keys.length * itemWidth + 12} cy={legendY + 7}
                  type="add" color={palette[data.keys.length % palette.length]} isDark={isDark}
                  onClick={handleAddSeries}
                />
              )}
            </g>
          );
        })()}

        {/* Single-key legend (just show add series button) */}
        {data.keys.length === 1 && onDataChange && (() => {
          const legendY = svgHeight + 4;
          const startX = containerWidth / 2 - 50;
          return (
            <g>
              <EditableLegendItem
                seriesKey={data.keys[0]} color={palette[0]}
                isDark={isDark} textColor={axisColor}
                x={startX} y={legendY}
                onRename={(n) => handleRenameSeries(0, n)}
                onRemove={() => {}}
                canRemove={false}
              />
              <ActionButton
                cx={startX + 100 + 12} cy={legendY + 7}
                type="add" color={palette[1 % palette.length]} isDark={isDark}
                onClick={handleAddSeries}
              />
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
