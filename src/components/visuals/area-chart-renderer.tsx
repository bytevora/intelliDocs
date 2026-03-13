"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { AreaChartData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";
import { hexToRgb, lightenColor, contrastText, niceScale, formatNumber, wrapLabel } from "./chart-utils";

// ── Constants ────────────────────────────────────────────
const CHART_PADDING = { top: 24, right: 32, bottom: 80, left: 56 };
const ANIM_DURATION = 500;
const POINT_R = 4;
const POINT_HOVER_R = 7;
const VALUE_FONT = 11;
const LABEL_FONT = 11;
const LEGEND_FONT = 11;
const LABEL_LINE_H = 13;
const MAX_LABEL_CHARS_PER_LINE = 12;
const AREA_OPACITY = 0.15;
const BTN_R = 11;

// ── Smooth curve (monotone cubic hermite) ────────────────
function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;

  // Compute tangents using monotone method
  const n = pts.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];
  const tangents: number[] = new Array(n);

  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    dy.push(pts[i + 1].y - pts[i].y);
    m.push(dx[i] !== 0 ? dy[i] / dx[i] : 0);
  }

  tangents[0] = m[0];
  tangents[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (m[i - 1] + m[i]) / 2;
    }
  }

  // Ensure monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-6) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const alpha = tangents[i] / m[i];
      const beta = tangents[i + 1] / m[i];
      const s = alpha * alpha + beta * beta;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        tangents[i] = t * alpha * m[i];
        tangents[i + 1] = t * beta * m[i];
      }
    }
  }

  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const segDx = dx[i] / 3;
    const cp1x = pts[i].x + segDx;
    const cp1y = pts[i].y + tangents[i] * segDx;
    const cp2x = pts[i + 1].x - segDx;
    const cp2y = pts[i + 1].y - tangents[i + 1] * segDx;
    d += `C${cp1x},${cp1y},${cp2x},${cp2y},${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

function areaPath(pts: { x: number; y: number }[], baselineY: number): string {
  if (pts.length === 0) return "";
  const linePath = monotonePath(pts);
  return `${linePath}L${pts[pts.length - 1].x},${baselineY}L${pts[0].x},${baselineY}Z`;
}

// ── Layout types ─────────────────────────────────────────
interface PlotPoint { x: number; y: number; dataX: string | number; dataY: number; seriesIdx: number; ptIdx: number; color: string }
interface AxisTick { value: number; pos: number; label: string }
interface AreaLayout {
  series: PlotPoint[][];
  yTicks: AxisTick[];
  xPositions: number[];
  xLabels: string[];
  chartX: number; chartY: number; chartW: number; chartH: number;
}

// ── Layout computation ───────────────────────────────────
function computeLayout(data: AreaChartData, width: number, height: number, palette: string[]): AreaLayout {
  const cX = CHART_PADDING.left;
  const cY = CHART_PADDING.top;
  const cW = width - CHART_PADDING.left - CHART_PADDING.right;
  const cH = height - CHART_PADDING.top - CHART_PADDING.bottom;

  let rawMax = 0;
  for (const s of data.series) for (const d of s.data) rawMax = Math.max(rawMax, d.y);
  const { max, ticks } = niceScale(rawMax);
  const yTicks: AxisTick[] = ticks.map((v) => ({ value: v, pos: cY + cH - (v / max) * cH, label: formatNumber(v) }));

  const refSeries = data.series[0];
  const numPoints = refSeries?.data.length || 0;
  const xStep = numPoints > 1 ? cW / (numPoints - 1) : 0;
  const xPositions = Array.from({ length: numPoints }, (_, i) => cX + i * xStep);
  const xLabels = refSeries?.data.map((d) => String(d.x)) || [];

  const series: PlotPoint[][] = data.series.map((s, si) => {
    const color = palette[si % palette.length];
    return s.data.map((d, pi) => ({
      x: numPoints > 1 ? cX + pi * xStep : cX + cW / 2,
      y: max > 0 ? cY + cH - (d.y / max) * cH : cY + cH,
      dataX: d.x, dataY: d.y, seriesIdx: si, ptIdx: pi, color,
    }));
  });

  return { series, yTicks, xPositions, xLabels, chartX: cX, chartY: cY, chartW: cW, chartH: cH };
}

// ── Editable point value ─────────────────────────────────
function EditablePointValue({
  pt, isDark, mounted, baselineY, onValueChange, onHover,
}: {
  pt: PlotPoint; isDark: boolean; mounted: boolean; baselineY: number;
  onValueChange: (seriesIdx: number, ptIdx: number, newVal: number) => void;
  onHover?: (hovering: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayY = mounted ? pt.y : baselineY;

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    setEditing(true);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
  }, []);

  const commit = useCallback(() => {
    setEditing(false);
    const raw = inputRef.current?.value ?? "";
    const val = parseFloat(raw);
    if (!isNaN(val) && val >= 0 && val !== pt.dataY) onValueChange(pt.seriesIdx, pt.ptIdx, val);
  }, [pt, onValueChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") setEditing(false);
  }, [commit]);

  if (editing) {
    return (
      <foreignObject x={pt.x - 32} y={displayY - 32} width={64} height={24}
        onMouseEnter={() => onHover?.(true)} onMouseLeave={() => onHover?.(false)}
        style={{ transition: `y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }}>
        <input ref={inputRef} type="number" min={0} step="any" defaultValue={pt.dataY}
          onBlur={commit} onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "100%", height: "100%", fontSize: VALUE_FONT, fontWeight: 700,
            textAlign: "center",
            background: isDark ? "rgba(30,30,50,0.95)" : "rgba(255,255,255,0.95)",
            color: isDark ? "#e2e8f0" : "#1e293b",
            border: `2px solid ${pt.color}`, borderRadius: 4, outline: "none",
            padding: "0 4px", boxShadow: `0 0 0 3px ${pt.color}33`,
          }}
        />
      </foreignObject>
    );
  }

  const displayText = formatNumber(pt.dataY);
  return (
    <text x={pt.x} y={displayY - 12} textAnchor="middle" dominantBaseline="auto"
      fontSize={VALUE_FONT} fontWeight={700} fontFamily="system-ui, -apple-system, sans-serif"
      fill={isDark ? "#e2e8f0" : "#1e293b"}
      onMouseEnter={() => onHover?.(true)} onMouseLeave={() => onHover?.(false)}
      onClick={startEdit} style={{ cursor: "pointer", transition: `y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }}>
      {displayText}
    </text>
  );
}

// ── Rotated x-axis label ─────────────────────────────────
function RotatedAxisLabel({
  label, x, y, isDark, textColor, onLabelChange,
}: {
  label: string; x: number; y: number; isDark: boolean; textColor: string;
  onLabelChange: (newLabel: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lines = wrapLabel(label, MAX_LABEL_CHARS_PER_LINE);

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
      <foreignObject x={x - 50} y={y + 4} width={100} height={28}>
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
    <g transform={`translate(${x}, ${y + 16}) rotate(-45)`} onDoubleClick={handleDoubleClick} style={{ cursor: "pointer", pointerEvents: "auto" }}>
      <text textAnchor="end" fontSize={LABEL_FONT} fontFamily="system-ui, -apple-system, sans-serif" fill={textColor}>
        {lines.map((line, i) => (<tspan key={i} x={0} dy={i === 0 ? 0 : LABEL_LINE_H}>{line}</tspan>))}
      </text>
    </g>
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

// ── Action button ────────────────────────────────────────
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
interface AreaChartRendererProps {
  data: AreaChartData;
  theme: VisualTheme;
  onDataChange?: (data: AreaChartData) => void;
}

export function AreaChartRenderer({ data, theme, onDataChange }: AreaChartRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [mounted, setMounted] = useState(false);
  const [hoveredPt, setHoveredPt] = useState<{ si: number; pi: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueLabelHoveredRef = useRef(false);

  const handlePointEnter = useCallback((si: number, pi: number) => {
    if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null; }
    setHoveredPt({ si, pi });
  }, []);

  const handlePointLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      if (!valueLabelHoveredRef.current) setHoveredPt(null);
    }, 100);
  }, []);

  const handleValueLabelHover = useCallback((hovering: boolean) => {
    valueLabelHoveredRef.current = hovering;
    if (!hovering) {
      hoverTimeoutRef.current = setTimeout(() => {
        if (!valueLabelHoveredRef.current) setHoveredPt(null);
      }, 100);
    } else if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const colors = THEME_COLORS[theme];
  const palette = colors.palette;
  const isDark = theme === "dark";
  const titleColor = isDark ? "#e2e8f0" : colors.text;
  const axisColor = colors.textMuted;
  const gridColor = colors.border;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

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
  const legendH = data.series.length > 1 ? 30 : 0;
  const totalH = svgHeight + legendH;
  const layout = computeLayout(data, containerWidth, svgHeight, palette);
  const baseline = layout.chartY + layout.chartH;

  // ── Edit handlers ──────────────────────────────────────
  const handleValueChange = useCallback((seriesIdx: number, ptIdx: number, newVal: number) => {
    if (!onDataChange) return;
    const newSeries = data.series.map((s, si) =>
      si !== seriesIdx ? s : { ...s, data: s.data.map((d, pi) => pi !== ptIdx ? d : { ...d, y: newVal }) }
    );
    onDataChange({ ...data, series: newSeries });
  }, [data, onDataChange]);

  const handleLabelChange = useCallback((ptIdx: number, newLabel: string) => {
    if (!onDataChange) return;
    const newSeries = data.series.map((s) => ({
      ...s, data: s.data.map((d, pi) => pi !== ptIdx ? d : { ...d, x: newLabel }),
    }));
    onDataChange({ ...data, series: newSeries });
  }, [data, onDataChange]);

  const handleAddPoint = useCallback((atIndex?: number) => {
    if (!onDataChange) return;
    const idx = atIndex ?? data.series[0]?.data.length ?? 0;
    const newSeries = data.series.map((s) => {
      const newData = [...s.data];
      newData.splice(idx, 0, { x: `New ${idx + 1}`, y: 0 });
      return { ...s, data: newData };
    });
    onDataChange({ ...data, series: newSeries });
  }, [data, onDataChange]);

  const handleRemovePoint = useCallback((ptIdx: number) => {
    if (!onDataChange || (data.series[0]?.data.length || 0) <= 2) return;
    const newSeries = data.series.map((s) => ({
      ...s, data: s.data.filter((_, pi) => pi !== ptIdx),
    }));
    onDataChange({ ...data, series: newSeries });
  }, [data, onDataChange]);

  const handleRenameSeries = useCallback((seriesIdx: number, newName: string) => {
    if (!onDataChange) return;
    const newSeries = data.series.map((s, i) => i !== seriesIdx ? s : { ...s, id: newName });
    onDataChange({ ...data, series: newSeries });
  }, [data, onDataChange]);

  const handleAddSeries = useCallback(() => {
    if (!onDataChange) return;
    const refData = data.series[0]?.data || [{ x: "A", y: 0 }];
    const newSeries = { id: `Series ${data.series.length + 1}`, data: refData.map((d) => ({ x: d.x, y: 0 })) };
    onDataChange({ ...data, series: [...data.series, newSeries] });
  }, [data, onDataChange]);

  const handleRemoveSeries = useCallback((seriesIdx: number) => {
    if (!onDataChange || data.series.length <= 1) return;
    onDataChange({ ...data, series: data.series.filter((_, i) => i !== seriesIdx) });
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
        <h3 contentEditable={!!onDataChange} suppressContentEditableWarning
          onBlur={handleTitleBlur} onKeyDown={handleTitleKeyDown}
          className="text-center text-lg font-bold mb-3 tracking-tight outline-none cursor-text focus:ring-1 focus:ring-primary/30 focus:rounded px-2"
          style={{ color: titleColor }}>
          {data.title}
        </h3>
      )}

      <svg data-visual-svg width="100%" height={totalH}
        viewBox={`0 0 ${containerWidth} ${totalH}`} preserveAspectRatio="xMidYMid meet"
        style={{ overflow: "visible" }}>

        {/* Grid lines */}
        {layout.yTicks.map((tick) => (
          <line key={`grid-${tick.value}`} x1={layout.chartX} y1={tick.pos} x2={layout.chartX + layout.chartW} y2={tick.pos} stroke={gridColor} strokeOpacity={0.3} strokeDasharray="4 3" />
        ))}

        {/* Y-axis labels */}
        {layout.yTicks.map((tick) => (
          <text key={`ytick-${tick.value}`} x={layout.chartX - 8} y={tick.pos} textAnchor="end" dominantBaseline="middle" fontSize={VALUE_FONT} fontFamily="system-ui, -apple-system, sans-serif" fill={axisColor}>
            {tick.label}
          </text>
        ))}

        {/* Baseline */}
        <line x1={layout.chartX} y1={baseline} x2={layout.chartX + layout.chartW} y2={baseline} stroke={gridColor} strokeOpacity={0.5} />

        {/* Area fills — rendered back to front so first series is on top */}
        {[...layout.series].reverse().map((pts, ri) => {
          const si = layout.series.length - 1 - ri;
          const animatedPts = pts.map((p) => ({ x: p.x, y: mounted ? p.y : baseline }));
          const aPath = areaPath(animatedPts, baseline);
          const color = palette[si % palette.length];
          return (
            <path key={`area-${si}`} d={aPath} fill={color} fillOpacity={AREA_OPACITY}
              stroke="none"
              style={{ transition: `d ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }} />
          );
        })}

        {/* Lines */}
        {layout.series.map((pts, si) => {
          const animatedPts = pts.map((p) => ({ x: p.x, y: mounted ? p.y : baseline }));
          const path = monotonePath(animatedPts);
          return (
            <path key={`line-${si}`} d={path} fill="none"
              stroke={palette[si % palette.length]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: `d ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }}
            />
          );
        })}

        {/* Points */}
        {layout.series.map((pts) =>
          pts.map((pt) => {
            const isHovered = hoveredPt?.si === pt.seriesIdx && hoveredPt?.pi === pt.ptIdx;
            const cy = mounted ? pt.y : baseline;
            return (
              <g key={`pt-${pt.seriesIdx}-${pt.ptIdx}`}
                onMouseEnter={() => handlePointEnter(pt.seriesIdx, pt.ptIdx)}
                onMouseLeave={handlePointLeave}
                style={{ cursor: "pointer" }}>
                {/* Expanded hit area covering both point and value label above */}
                <rect x={pt.x - 32} y={cy - 36} width={64} height={36 + POINT_HOVER_R + 4} fill="transparent" />
                {isHovered && (
                  <circle cx={pt.x} cy={cy} r={POINT_HOVER_R + 3}
                    fill={`${pt.color}22`} style={{ transition: `cy ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }} />
                )}
                <circle cx={pt.x} cy={cy} r={isHovered ? POINT_HOVER_R : POINT_R}
                  fill={isDark ? colors.cardBg : "#fff"} stroke={pt.color} strokeWidth={2}
                  style={{ transition: `cy ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), r 150ms ease` }} />
                <circle cx={pt.x} cy={cy} r={isHovered ? 2.5 : 1.5}
                  fill={pt.color}
                  style={{ transition: `cy ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), r 150ms ease` }} />
              </g>
            );
          })
        )}

        {/* Value labels on hover */}
        {hoveredPt && layout.series[hoveredPt.si] && (
          <EditablePointValue
            pt={layout.series[hoveredPt.si][hoveredPt.pi]}
            isDark={isDark} mounted={mounted} baselineY={baseline}
            onValueChange={onDataChange ? handleValueChange : () => {}}
            onHover={handleValueLabelHover}
          />
        )}

        {/* X-axis labels */}
        {layout.xLabels.map((label, i) => (
          <RotatedAxisLabel key={`xlabel-${i}`} label={label} x={layout.xPositions[i]} y={baseline}
            isDark={isDark} textColor={axisColor}
            onLabelChange={(newLabel) => handleLabelChange(i, newLabel)} />
        ))}

        {/* Remove point button on hover */}
        {onDataChange && hoveredPt && (data.series[0]?.data.length || 0) > 2 && (() => {
          const pt = layout.series[hoveredPt.si]?.[hoveredPt.pi];
          if (!pt) return null;
          const cy = mounted ? pt.y : baseline;
          return (
            <ActionButton cx={pt.x} cy={cy - 42} type="remove" color="#ef4444" isDark={isDark}
              onClick={() => handleRemovePoint(hoveredPt.pi)} />
          );
        })()}

        {/* Add point buttons */}
        {onDataChange && (() => {
          const numPts = data.series[0]?.data.length || 0;
          if (numPts === 0) return null;
          const lastX = layout.xPositions[numPts - 1] || layout.chartX;
          return (
            <>
              <ActionButton key="add-end" cx={lastX + 30} cy={baseline - layout.chartH / 2}
                type="add" color={palette[0]} isDark={isDark}
                onClick={() => handleAddPoint(numPts)} />
              <ActionButton key="add-start" cx={layout.chartX - 20} cy={baseline - layout.chartH / 2}
                type="add" color={palette[0]} isDark={isDark}
                onClick={() => handleAddPoint(0)} />
            </>
          );
        })()}

        {/* Legend */}
        {data.series.length > 1 && (() => {
          const legendY = svgHeight + 4;
          const itemWidth = 100;
          const totalLegendW = data.series.length * itemWidth + (onDataChange ? 30 : 0);
          const startX = (containerWidth - totalLegendW) / 2;
          return (
            <g>
              {data.series.map((s, i) => (
                <EditableLegendItem key={`legend-${s.id}`} seriesKey={s.id}
                  color={palette[i % palette.length]} isDark={isDark} textColor={axisColor}
                  x={startX + i * itemWidth} y={legendY}
                  onRename={(n) => handleRenameSeries(i, n)}
                  onRemove={() => handleRemoveSeries(i)}
                  canRemove={!!onDataChange && data.series.length > 1} />
              ))}
              {onDataChange && (
                <ActionButton cx={startX + data.series.length * itemWidth + 12} cy={legendY + 7}
                  type="add" color={palette[data.series.length % palette.length]} isDark={isDark}
                  onClick={handleAddSeries} />
              )}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
