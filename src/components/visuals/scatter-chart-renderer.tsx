"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ScatterChartData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";
import { hexToRgb, lightenColor, niceScale, formatNumber } from "./chart-utils";

// ── Constants ────────────────────────────────────────────
const CHART_PADDING = { top: 24, right: 32, bottom: 60, left: 56 };
const ANIM_DURATION = 500;
const POINT_R = 6;
const POINT_HOVER_R = 9;
const VALUE_FONT = 11;
const LABEL_FONT = 11;
const LEGEND_FONT = 11;
const BTN_R = 11;

// ── Layout types ─────────────────────────────────────────
interface PlotPoint {
  px: number;
  py: number;
  dataX: number;
  dataY: number;
  seriesIdx: number;
  ptIdx: number;
  color: string;
}

interface AxisTick { value: number; pos: number; label: string }

interface ScatterLayout {
  points: PlotPoint[][];
  xTicks: AxisTick[];
  yTicks: AxisTick[];
  chartX: number;
  chartY: number;
  chartW: number;
  chartH: number;
  xMax: number;
  yMax: number;
}

// ── Layout computation ───────────────────────────────────
function computeLayout(data: ScatterChartData, width: number, height: number, palette: string[]): ScatterLayout {
  const cX = CHART_PADDING.left;
  const cY = CHART_PADDING.top;
  const cW = width - CHART_PADDING.left - CHART_PADDING.right;
  const cH = height - CHART_PADDING.top - CHART_PADDING.bottom;

  // Collect min/max for both axes
  let rawXMax = 0;
  let rawYMax = 0;
  for (const s of data.series) {
    for (const d of s.data) {
      rawXMax = Math.max(rawXMax, d.x);
      rawYMax = Math.max(rawYMax, d.y);
    }
  }

  const xScale = niceScale(rawXMax);
  const yScale = niceScale(rawYMax);

  const xTicks: AxisTick[] = xScale.ticks.map((v) => ({
    value: v,
    pos: xScale.max > 0 ? cX + (v / xScale.max) * cW : cX,
    label: formatNumber(v),
  }));

  const yTicks: AxisTick[] = yScale.ticks.map((v) => ({
    value: v,
    pos: yScale.max > 0 ? cY + cH - (v / yScale.max) * cH : cY + cH,
    label: formatNumber(v),
  }));

  // Plot points per series
  const points: PlotPoint[][] = data.series.map((s, si) => {
    const color = palette[si % palette.length];
    return s.data.map((d, pi) => ({
      px: xScale.max > 0 ? cX + (d.x / xScale.max) * cW : cX + cW / 2,
      py: yScale.max > 0 ? cY + cH - (d.y / yScale.max) * cH : cY + cH,
      dataX: d.x,
      dataY: d.y,
      seriesIdx: si,
      ptIdx: pi,
      color,
    }));
  });

  return { points, xTicks, yTicks, chartX: cX, chartY: cY, chartW: cW, chartH: cH, xMax: xScale.max, yMax: yScale.max };
}

// ── Editable point value (click dot to edit x,y) ─────────
function EditablePointValue({
  pt, isDark, mounted, baselineY, onValueChange,
}: {
  pt: PlotPoint; isDark: boolean; mounted: boolean; baselineY: number;
  onValueChange: (seriesIdx: number, ptIdx: number, newX: number, newY: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const xInputRef = useRef<HTMLInputElement>(null);
  const yInputRef = useRef<HTMLInputElement>(null);
  const displayY = mounted ? pt.py : baselineY;

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    setEditing(true);
    requestAnimationFrame(() => { xInputRef.current?.focus(); xInputRef.current?.select(); });
  }, []);

  const commit = useCallback(() => {
    setEditing(false);
    const rawX = xInputRef.current?.value ?? "";
    const rawY = yInputRef.current?.value ?? "";
    const valX = parseFloat(rawX);
    const valY = parseFloat(rawY);
    if (!isNaN(valX) && !isNaN(valY) && valX >= 0 && valY >= 0 && (valX !== pt.dataX || valY !== pt.dataY)) {
      onValueChange(pt.seriesIdx, pt.ptIdx, valX, valY);
    }
  }, [pt, onValueChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") setEditing(false);
  }, [commit]);

  if (editing) {
    return (
      <foreignObject x={pt.px - 52} y={displayY - 36} width={104} height={28}
        style={{ transition: `y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }}>
        <div style={{ display: "flex", gap: 2, width: "100%", height: "100%" }}>
          <input ref={xInputRef} type="number" min={0} step="any" defaultValue={pt.dataX}
            onBlur={commit} onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "50%", height: "100%", fontSize: VALUE_FONT, fontWeight: 700,
              textAlign: "center",
              background: isDark ? "rgba(30,30,50,0.95)" : "rgba(255,255,255,0.95)",
              color: isDark ? "#e2e8f0" : "#1e293b",
              border: `2px solid ${pt.color}`, borderRadius: 4, outline: "none",
              padding: "0 2px", boxShadow: `0 0 0 3px ${pt.color}33`,
            }}
          />
          <input ref={yInputRef} type="number" min={0} step="any" defaultValue={pt.dataY}
            onBlur={commit} onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "50%", height: "100%", fontSize: VALUE_FONT, fontWeight: 700,
              textAlign: "center",
              background: isDark ? "rgba(30,30,50,0.95)" : "rgba(255,255,255,0.95)",
              color: isDark ? "#e2e8f0" : "#1e293b",
              border: `2px solid ${pt.color}`, borderRadius: 4, outline: "none",
              padding: "0 2px", boxShadow: `0 0 0 3px ${pt.color}33`,
            }}
          />
        </div>
      </foreignObject>
    );
  }

  const displayText = `(${formatNumber(pt.dataX)}, ${formatNumber(pt.dataY)})`;
  return (
    <text x={pt.px} y={displayY - 14} textAnchor="middle" dominantBaseline="auto"
      fontSize={VALUE_FONT} fontWeight={700} fontFamily="system-ui, -apple-system, sans-serif"
      fill={isDark ? "#e2e8f0" : "#1e293b"} opacity={0}
      onClick={startEdit} style={{ cursor: "pointer", transition: `y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }}>
      {displayText}
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
interface ScatterChartRendererProps {
  data: ScatterChartData;
  theme: VisualTheme;
  onDataChange?: (data: ScatterChartData) => void;
}

export function ScatterChartRenderer({ data, theme, onDataChange }: ScatterChartRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [mounted, setMounted] = useState(false);
  const [hoveredPt, setHoveredPt] = useState<{ si: number; pi: number } | null>(null);

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
  const legendH = data.series.length > 1 ? 30 : 0;
  const totalH = svgHeight + legendH;
  const layout = computeLayout(data, containerWidth, svgHeight, palette);
  const baseline = layout.chartY + layout.chartH;

  // ── Edit handlers ──────────────────────────────────────
  const handleValueChange = useCallback((seriesIdx: number, ptIdx: number, newX: number, newY: number) => {
    if (!onDataChange) return;
    const newSeries = data.series.map((s, si) =>
      si !== seriesIdx ? s : { ...s, data: s.data.map((d, pi) => pi !== ptIdx ? d : { x: newX, y: newY }) }
    );
    onDataChange({ ...data, series: newSeries });
  }, [data, onDataChange]);

  const handleAddPoint = useCallback((seriesIdx: number) => {
    if (!onDataChange) return;
    const s = data.series[seriesIdx];
    // Add a point near the average of existing points
    const avgX = s.data.length > 0 ? s.data.reduce((sum, d) => sum + d.x, 0) / s.data.length : 0;
    const avgY = s.data.length > 0 ? s.data.reduce((sum, d) => sum + d.y, 0) / s.data.length : 0;
    const newPt = { x: Math.round(avgX + 1), y: Math.round(avgY + 1) };
    const newSeries = data.series.map((ser, si) =>
      si !== seriesIdx ? ser : { ...ser, data: [...ser.data, newPt] }
    );
    onDataChange({ ...data, series: newSeries });
  }, [data, onDataChange]);

  const handleRemovePoint = useCallback((seriesIdx: number, ptIdx: number) => {
    if (!onDataChange) return;
    const s = data.series[seriesIdx];
    if (s.data.length <= 1) return;
    const newSeries = data.series.map((ser, si) =>
      si !== seriesIdx ? ser : { ...ser, data: ser.data.filter((_, pi) => pi !== ptIdx) }
    );
    onDataChange({ ...data, series: newSeries });
  }, [data, onDataChange]);

  const handleRenameSeries = useCallback((seriesIdx: number, newName: string) => {
    if (!onDataChange) return;
    const newSeries = data.series.map((s, i) => i !== seriesIdx ? s : { ...s, id: newName });
    onDataChange({ ...data, series: newSeries });
  }, [data, onDataChange]);

  const handleAddSeries = useCallback(() => {
    if (!onDataChange) return;
    const newSeries = { id: `Series ${data.series.length + 1}`, data: [{ x: 0, y: 0 }] };
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

        {/* Y-axis grid lines (horizontal, dashed) */}
        {layout.yTicks.map((tick) => (
          <line key={`ygrid-${tick.value}`} x1={layout.chartX} y1={tick.pos} x2={layout.chartX + layout.chartW} y2={tick.pos}
            stroke={gridColor} strokeOpacity={0.3} strokeDasharray="4 3" />
        ))}

        {/* X-axis grid lines (vertical, dashed) */}
        {layout.xTicks.map((tick) => (
          <line key={`xgrid-${tick.value}`} x1={tick.pos} y1={layout.chartY} x2={tick.pos} y2={layout.chartY + layout.chartH}
            stroke={gridColor} strokeOpacity={0.3} strokeDasharray="4 3" />
        ))}

        {/* Y-axis labels */}
        {layout.yTicks.map((tick) => (
          <text key={`ytick-${tick.value}`} x={layout.chartX - 8} y={tick.pos} textAnchor="end" dominantBaseline="middle"
            fontSize={LABEL_FONT} fontFamily="system-ui, -apple-system, sans-serif" fill={axisColor}>
            {tick.label}
          </text>
        ))}

        {/* X-axis labels */}
        {layout.xTicks.map((tick) => (
          <text key={`xtick-${tick.value}`} x={tick.pos} y={baseline + 18} textAnchor="middle" dominantBaseline="auto"
            fontSize={LABEL_FONT} fontFamily="system-ui, -apple-system, sans-serif" fill={axisColor}>
            {tick.label}
          </text>
        ))}

        {/* Baselines */}
        <line x1={layout.chartX} y1={baseline} x2={layout.chartX + layout.chartW} y2={baseline} stroke={gridColor} strokeOpacity={0.5} />
        <line x1={layout.chartX} y1={layout.chartY} x2={layout.chartX} y2={baseline} stroke={gridColor} strokeOpacity={0.5} />

        {/* Scatter points */}
        {layout.points.map((pts) =>
          pts.map((pt) => {
            const isHovered = hoveredPt?.si === pt.seriesIdx && hoveredPt?.pi === pt.ptIdx;
            const cy = mounted ? pt.py : baseline;
            const cx = pt.px;
            const rgb = hexToRgb(pt.color);

            return (
              <g key={`pt-${pt.seriesIdx}-${pt.ptIdx}`}
                onMouseEnter={() => setHoveredPt({ si: pt.seriesIdx, pi: pt.ptIdx })}
                onMouseLeave={() => setHoveredPt(null)}
                style={{ cursor: "pointer" }}>
                {/* Invisible hit target */}
                <circle cx={cx} cy={cy} r={POINT_HOVER_R + 4} fill="transparent" />
                {/* Glow on hover */}
                {isHovered && (
                  <circle cx={cx} cy={cy} r={POINT_HOVER_R + 4}
                    fill={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.25 : 0.15})`}
                    style={{ transition: `cy ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }} />
                )}
                {/* Main dot */}
                <circle cx={cx} cy={cy} r={isHovered ? POINT_HOVER_R : POINT_R}
                  fill={pt.color} opacity={isHovered ? 1 : 0.85}
                  stroke={isDark ? colors.cardBg : "#fff"} strokeWidth={2}
                  style={{
                    transition: `cy ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), r 150ms ease, opacity 150ms ease`,
                  }} />
              </g>
            );
          })
        )}

        {/* Tooltip on hover — show coordinates */}
        {hoveredPt && (() => {
          const pt = layout.points[hoveredPt.si]?.[hoveredPt.pi];
          if (!pt) return null;
          const cy = mounted ? pt.py : baseline;
          const label = `(${formatNumber(pt.dataX)}, ${formatNumber(pt.dataY)})`;
          const textW = label.length * 6.5 + 12;
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect x={pt.px - textW / 2} y={cy - 30} width={textW} height={18} rx={4}
                fill={isDark ? "rgba(30,30,50,0.92)" : "rgba(255,255,255,0.92)"}
                stroke={pt.color} strokeWidth={1} strokeOpacity={0.5}
                style={{ transition: `y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }} />
              <text x={pt.px} y={cy - 18} textAnchor="middle" dominantBaseline="central"
                fontSize={VALUE_FONT} fontWeight={700} fontFamily="system-ui, -apple-system, sans-serif"
                fill={isDark ? "#e2e8f0" : "#1e293b"}
                style={{ transition: `y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)` }}>
                {label}
              </text>
            </g>
          );
        })()}

        {/* Editable point values (hidden, activated on click) */}
        {layout.points.map((pts) =>
          pts.map((pt) => (
            <EditablePointValue
              key={`val-${pt.seriesIdx}-${pt.ptIdx}`}
              pt={pt} isDark={isDark} mounted={mounted} baselineY={baseline}
              onValueChange={onDataChange ? handleValueChange : () => {}}
            />
          ))
        )}

        {/* Remove point button — on hover */}
        {onDataChange && hoveredPt && (() => {
          const s = data.series[hoveredPt.si];
          if (!s || s.data.length <= 1) return null;
          const pt = layout.points[hoveredPt.si]?.[hoveredPt.pi];
          if (!pt) return null;
          const cy = mounted ? pt.py : baseline;
          return (
            <ActionButton cx={pt.px} cy={cy - 54} type="remove" color="#ef4444" isDark={isDark}
              onClick={() => handleRemovePoint(hoveredPt.si, hoveredPt.pi)} />
          );
        })()}

        {/* Add point buttons — one per series, positioned at right edge */}
        {onDataChange && data.series.map((s, si) => {
          const color = palette[si % palette.length];
          const btnY = layout.chartY + (si + 0.5) * (layout.chartH / Math.max(data.series.length, 1));
          return (
            <ActionButton key={`add-pt-${si}`} cx={layout.chartX + layout.chartW + 18} cy={btnY}
              type="add" color={color} isDark={isDark}
              onClick={() => handleAddPoint(si)} />
          );
        })}

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
