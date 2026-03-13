"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { BarChartData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";
import { hexToRgb, lightenColor, contrastText, niceScale, formatNumber, wrapLabel } from "./chart-utils";

// ── Constants ────────────────────────────────────────────

const CHART_PADDING = { top: 24, right: 32, bottom: 80, left: 56 };
const BAR_GAP = 0.25;
const GROUP_GAP = 0.15;
const BAR_RADIUS = 5;
const ANIM_DURATION = 420;
const ANIM_STAGGER = 50;
const BTN_R = 11;
const VALUE_FONT = 11;
const LABEL_FONT = 11;
const LEGEND_FONT = 11;
const LABEL_LINE_H = 13;
const MAX_LABEL_CHARS_PER_LINE = 12;
const HOVER_LEAVE_DELAY = 150; // ms before hover clears

// ── Layout types ─────────────────────────────────────────

interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  label: string;
  seriesKey: string;
  color: string;
  rowIndex: number;
  keyIndex: number;
}

interface AxisTick { value: number; pos: number; label: string }

interface ChartLayout {
  bars: BarRect[];
  yTicks: AxisTick[];
  xLabels: { label: string; x: number; rowIndex: number }[];
  chartX: number;
  chartY: number;
  chartW: number;
  chartH: number;
  maxVal: number;
  bandW: number;
}

// ── Layout computation ───────────────────────────────────

function computeLayout(data: BarChartData, width: number, height: number, palette: string[]): ChartLayout {
  const cX = CHART_PADDING.left;
  const cY = CHART_PADDING.top;
  const cW = width - CHART_PADDING.left - CHART_PADDING.right;
  const cH = height - CHART_PADDING.top - CHART_PADDING.bottom;
  const keys = data.keys;
  const rows = data.data;
  const numGroups = rows.length;
  const numKeys = keys.length;

  let rawMax = 0;
  for (const row of rows) {
    if (data.layout === "stacked") {
      let stackTotal = 0;
      for (const k of keys) stackTotal += Number(row[k]) || 0;
      rawMax = Math.max(rawMax, stackTotal);
    } else {
      for (const k of keys) rawMax = Math.max(rawMax, Number(row[k]) || 0);
    }
  }

  const { max, ticks } = niceScale(rawMax);
  const yTicks: AxisTick[] = ticks.map((v) => ({
    value: v,
    pos: cY + cH - (v / max) * cH,
    label: formatNumber(v),
  }));

  const bandW = cW / Math.max(numGroups, 1);
  const groupPad = bandW * BAR_GAP;
  const innerBandW = bandW - groupPad;

  const bars: BarRect[] = [];
  const xLabels: { label: string; x: number; rowIndex: number }[] = [];

  for (let ri = 0; ri < numGroups; ri++) {
    const row = rows[ri];
    const groupX = cX + ri * bandW + groupPad / 2;
    const label = String(row[data.indexBy] ?? `Item ${ri + 1}`);
    xLabels.push({ label, x: groupX + innerBandW / 2, rowIndex: ri });

    if (data.layout === "stacked") {
      let stackY = 0;
      for (let ki = 0; ki < numKeys; ki++) {
        const val = Number(row[keys[ki]]) || 0;
        const barH = max > 0 ? (val / max) * cH : 0;
        bars.push({
          x: groupX, y: cY + cH - stackY - barH,
          width: innerBandW, height: barH,
          value: val, label, seriesKey: keys[ki],
          color: palette[ki % palette.length],
          rowIndex: ri, keyIndex: ki,
        });
        stackY += barH;
      }
    } else {
      const subBarW = numKeys > 1
        ? (innerBandW - (numKeys - 1) * innerBandW * GROUP_GAP) / numKeys
        : innerBandW;
      const subGap = numKeys > 1 ? innerBandW * GROUP_GAP : 0;
      for (let ki = 0; ki < numKeys; ki++) {
        const val = Number(row[keys[ki]]) || 0;
        const barH = max > 0 ? (val / max) * cH : 0;
        const bx = numKeys > 1 ? groupX + ki * (subBarW + subGap) : groupX;
        const barColor = numKeys === 1 ? palette[ri % palette.length] : palette[ki % palette.length];
        bars.push({
          x: bx, y: cY + cH - barH,
          width: subBarW, height: barH,
          value: val, label, seriesKey: keys[ki],
          color: barColor,
          rowIndex: ri, keyIndex: ki,
        });
      }
    }
  }

  return { bars, yTicks, xLabels, chartX: cX, chartY: cY, chartW: cW, chartH: cH, maxVal: max, bandW };
}

// ── Editable value (displayed ON the bar, single-click to edit) ──

function EditableValue({
  bar, isDark, mounted, baseline, staggerIndex, onValueChange,
}: {
  bar: BarRect; isDark: boolean; mounted: boolean; baseline: number; staggerIndex: number;
  onValueChange: (rowIndex: number, keyIndex: number, newVal: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const delay = staggerIndex * ANIM_STAGGER;

  const barY = mounted ? bar.y : baseline;
  const barH = mounted ? bar.height : 0;
  const MIN_BAR_H_FOR_INSIDE = 28;
  // If bar is tall enough, center the value inside it; otherwise place above
  const isInside = barH >= MIN_BAR_H_FOR_INSIDE;
  const textY = isInside ? barY + barH / 2 : barY - 14;
  const textColor = isInside ? contrastText(bar.color) : (isDark ? "#e2e8f0" : "#1e293b");

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const commit = useCallback(() => {
    setEditing(false);
    const raw = inputRef.current?.value ?? "";
    const val = parseFloat(raw);
    if (!isNaN(val) && val >= 0 && val !== bar.value) {
      onValueChange(bar.rowIndex, bar.keyIndex, val);
    }
  }, [bar, onValueChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setEditing(false); }
  }, [commit]);

  if (editing) {
    const inputW = Math.max(bar.width + 16, 64);
    const inputY = isInside ? barY + barH / 2 - 12 : barY - 26;
    return (
      <foreignObject
        x={bar.x + bar.width / 2 - inputW / 2}
        y={inputY}
        width={inputW}
        height={24}
        style={{ transition: `y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms` }}
      >
        <input
          ref={inputRef}
          type="number"
          min={0}
          step="any"
          defaultValue={bar.value}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "100%", height: "100%",
            fontSize: VALUE_FONT, fontWeight: 700,
            textAlign: "center",
            background: isDark ? "rgba(30,30,50,0.95)" : "rgba(255,255,255,0.95)",
            color: isDark ? "#e2e8f0" : "#1e293b",
            border: `2px solid ${bar.color}`,
            borderRadius: 4, outline: "none",
            padding: "0 4px",
            boxShadow: `0 0 0 3px ${bar.color}33`,
          }}
        />
      </foreignObject>
    );
  }

  const displayText = formatNumber(bar.value);
  const textW = displayText.length * 7 + 8;

  return (
    <g
      onClick={startEdit}
      style={{ cursor: "pointer", pointerEvents: "auto" }}
    >
      {/* Background pill for short bars so the value is always readable */}
      {!isInside && (
        <rect
          x={bar.x + bar.width / 2 - textW / 2}
          y={textY - 9}
          width={textW}
          height={18}
          rx={4}
          fill={bar.color}
          opacity={0.85}
          style={{
            transition: `y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
          }}
        />
      )}
      <text
        x={bar.x + bar.width / 2}
        y={textY}
        textAnchor="middle"
        dominantBaseline={isInside ? "central" : "central"}
        fontSize={VALUE_FONT}
        fontWeight={700}
        fontFamily="system-ui, -apple-system, sans-serif"
        fill={isInside ? textColor : contrastText(bar.color)}
        style={{
          transition: `y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
        }}
      >
        {displayText}
      </text>
    </g>
  );
}

// ── 45-degree rotated x-axis label with word wrap ────────

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
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
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
    if (e.key === "Escape") {
      if (ref.current) ref.current.textContent = label;
      (e.target as HTMLElement).blur();
    }
  }, [label]);

  if (editing) {
    return (
      <foreignObject x={x - 50} y={y + 4} width={100} height={28}>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: LABEL_FONT, fontFamily: "system-ui, -apple-system, sans-serif",
            color: isDark ? "#e2e8f0" : "#1e293b",
            textAlign: "center", outline: "none", cursor: "text",
            borderRadius: 4,
            background: isDark ? "rgba(30,30,50,0.95)" : "rgba(255,255,255,0.95)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"}`,
            padding: "2px 4px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {label}
        </div>
      </foreignObject>
    );
  }

  return (
    <g
      transform={`translate(${x}, ${y + 16}) rotate(-45)`}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: "pointer", pointerEvents: "auto" }}
    >
      <text
        textAnchor="end"
        fontSize={LABEL_FONT}
        fontFamily="system-ui, -apple-system, sans-serif"
        fill={textColor}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 0 : LABEL_LINE_H}>{line}</tspan>
        ))}
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
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
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
    if (e.key === "Escape") {
      if (ref.current) ref.current.textContent = seriesKey;
      (e.target as HTMLElement).blur();
    }
  }, [seriesKey]);

  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <circle cx={x} cy={y + 7} r={5} fill={color} />
      <foreignObject x={x + 10} y={y - 2} width={70} height={18}>
        <div
          ref={ref}
          contentEditable={editing}
          suppressContentEditableWarning
          onDoubleClick={handleDoubleClick}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            fontSize: LEGEND_FONT, fontFamily: "system-ui, -apple-system, sans-serif",
            color: textColor, outline: "none",
            cursor: editing ? "text" : "default",
            userSelect: editing ? "text" : "none",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            lineHeight: "18px",
            background: editing ? (isDark ? "rgba(30,30,50,0.9)" : "rgba(255,255,255,0.9)") : "transparent",
            borderRadius: 3, padding: "0 2px",
          }}
        >
          {seriesKey}
        </div>
      </foreignObject>
      {canRemove && hovered && !editing && (
        <g
          data-export-ignore style={{ cursor: "pointer" }}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <circle cx={x + 86} cy={y + 7} r={7} fill={isDark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.15)"} stroke="#ef4444" strokeWidth={1} strokeOpacity={0.6} />
          <line x1={x + 83} y1={y + 7} x2={x + 89} y2={y + 7} stroke={isDark ? "#fca5a5" : "#ef4444"} strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

// ── Action buttons (add/remove bar) ──────────────────────

function ActionButton({
  cx, cy, type, color, isDark, onClick, onMouseEnter, onMouseLeave,
}: {
  cx: number; cy: number; type: "add" | "remove"; color: string; isDark: boolean;
  onClick: () => void; onMouseEnter?: () => void; onMouseLeave?: () => void;
}) {
  const rgb = hexToRgb(color);
  const bgFill = type === "add"
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.35 : 0.2})`
    : `rgba(239, 68, 68, ${isDark ? 0.35 : 0.2})`;
  const strokeCol = type === "add" ? color : "#ef4444";
  const iconColor = type === "add"
    ? (isDark ? lightenColor(color, 0.6) : color)
    : (isDark ? "#fca5a5" : "#ef4444");

  return (
    <g
      data-export-ignore
      style={{ cursor: "pointer", pointerEvents: "auto" }}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Larger invisible hit target */}
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

// ── Animated bar rect ────────────────────────────────────

function AnimatedBar({
  bar, baseline, staggerIndex, mounted, hovered, isDark,
}: {
  bar: BarRect; baseline: number; staggerIndex: number;
  mounted: boolean; hovered: boolean; isDark: boolean;
}) {
  const rgb = hexToRgb(bar.color);
  const glowOpacity = hovered ? (isDark ? 0.25 : 0.15) : 0;
  const delay = staggerIndex * ANIM_STAGGER;

  return (
    <g style={{ pointerEvents: "none" }}>
      {hovered && (
        <rect
          x={bar.x - 3}
          y={(mounted ? bar.y : baseline) - 3}
          width={bar.width + 6}
          height={(mounted ? bar.height : 0) + 6}
          rx={BAR_RADIUS + 3}
          fill={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${glowOpacity})`}
          style={{ transition: `y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms, height ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms` }}
        />
      )}
      <rect
        x={bar.x}
        y={mounted ? bar.y : baseline}
        width={bar.width}
        height={mounted ? bar.height : 0}
        rx={BAR_RADIUS}
        fill={bar.color}
        opacity={hovered ? 1 : 0.85}
        style={{ transition: `y ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms, height ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms, opacity 150ms ease, x 300ms ease, width 300ms ease` }}
      />
    </g>
  );
}

// ── Main renderer ────────────────────────────────────────

interface BarChartRendererProps {
  data: BarChartData;
  theme: VisualTheme;
  onDataChange?: (data: BarChartData) => void;
}

export function BarChartRenderer({ data, theme, onDataChange }: BarChartRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [mounted, setMounted] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null);
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colors = THEME_COLORS[theme];
  const palette = colors.palette;
  const isDark = theme === "dark";
  const titleColor = isDark ? "#e2e8f0" : colors.text;
  const axisColor = colors.textMuted;
  const gridColor = colors.border;

  // Delayed hover leave — so the cursor can travel from bar to remove button
  const enterGroup = useCallback((idx: number) => {
    if (hoverLeaveTimer.current) { clearTimeout(hoverLeaveTimer.current); hoverLeaveTimer.current = null; }
    setHoveredGroup(idx);
  }, []);

  const leaveGroup = useCallback(() => {
    hoverLeaveTimer.current = setTimeout(() => setHoveredGroup(null), HOVER_LEAVE_DELAY);
  }, []);

  useEffect(() => { return () => { if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current); }; }, []);

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
  const baseline = layout.chartY + layout.chartH;

  // ── Edit handlers ──────────────────────────────────────

  const handleValueChange = useCallback((rowIndex: number, keyIndex: number, newVal: number) => {
    if (!onDataChange) return;
    onDataChange({ ...data, data: data.data.map((row, i) => i !== rowIndex ? row : { ...row, [data.keys[keyIndex]]: newVal }) });
  }, [data, onDataChange]);

  const handleLabelChange = useCallback((rowIndex: number, newLabel: string) => {
    if (!onDataChange) return;
    onDataChange({ ...data, data: data.data.map((row, i) => i !== rowIndex ? row : { ...row, [data.indexBy]: newLabel }) });
  }, [data, onDataChange]);

  const handleAddBar = useCallback((atIndex?: number) => {
    if (!onDataChange) return;
    const newRow: Record<string, string | number> = { [data.indexBy]: `Item ${data.data.length + 1}` };
    for (const k of data.keys) newRow[k] = 0;
    if (atIndex !== undefined && atIndex >= 0 && atIndex <= data.data.length) {
      const newArr = [...data.data]; newArr.splice(atIndex, 0, newRow);
      onDataChange({ ...data, data: newArr });
    } else {
      onDataChange({ ...data, data: [...data.data, newRow] });
    }
  }, [data, onDataChange]);

  const handleRemoveBar = useCallback((rowIndex: number) => {
    if (!onDataChange || data.data.length <= 1) return;
    onDataChange({ ...data, data: data.data.filter((_, i) => i !== rowIndex) });
  }, [data, onDataChange]);

  const handleRenameSeries = useCallback((keyIndex: number, newName: string) => {
    if (!onDataChange) return;
    const oldKey = data.keys[keyIndex];
    if (newName === oldKey || !newName) return;
    const newKeys = data.keys.map((k, i) => i === keyIndex ? newName : k);
    const newRows = data.data.map((row) => { const r = { ...row }; r[newName] = r[oldKey]; delete r[oldKey]; return r; });
    onDataChange({ ...data, keys: newKeys, data: newRows });
  }, [data, onDataChange]);

  const handleAddSeries = useCallback(() => {
    if (!onDataChange) return;
    const newKey = `Series ${data.keys.length + 1}`;
    onDataChange({ ...data, keys: [...data.keys, newKey], data: data.data.map((row) => ({ ...row, [newKey]: 0 })) });
  }, [data, onDataChange]);

  const handleRemoveSeries = useCallback((keyIndex: number) => {
    if (!onDataChange || data.keys.length <= 1) return;
    const removeKey = data.keys[keyIndex];
    const newKeys = data.keys.filter((_, i) => i !== keyIndex);
    onDataChange({ ...data, keys: newKeys, data: data.data.map((row) => { const r = { ...row }; delete r[removeKey]; return r; }) });
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

        {/* Per-group hover zones — invisible rects that span the full group column including button area above */}
        {layout.xLabels.map((xl) => {
          const gx = layout.chartX + xl.rowIndex * layout.bandW;
          return (
            <rect
              key={`hitzone-${xl.rowIndex}`}
              x={gx}
              y={layout.chartY - 50}
              width={layout.bandW}
              height={baseline - layout.chartY + 50 + CHART_PADDING.bottom}
              fill="transparent"
              pointerEvents="fill"
              onMouseEnter={() => enterGroup(xl.rowIndex)}
              onMouseLeave={leaveGroup}
            />
          );
        })}

        {/* Bars */}
        {layout.bars.map((bar, i) => (
          <AnimatedBar key={`bar-${bar.rowIndex}-${bar.keyIndex}`} bar={bar} baseline={baseline} staggerIndex={i} mounted={mounted} hovered={hoveredGroup === bar.rowIndex} isDark={isDark} />
        ))}

        {/* Value labels ON the bars (single-click to edit) */}
        {layout.bars.map((bar, i) => (
          <EditableValue key={`val-${bar.rowIndex}-${bar.keyIndex}`} bar={bar} isDark={isDark} mounted={mounted} baseline={baseline} staggerIndex={i} onValueChange={onDataChange ? handleValueChange : () => {}} />
        ))}

        {/* X-axis labels — 45 degree rotation */}
        {layout.xLabels.map((xl) => (
          <RotatedAxisLabel key={`xlabel-${xl.rowIndex}`} label={xl.label} x={xl.x} y={baseline} isDark={isDark} textColor={axisColor} onLabelChange={(newLabel) => handleLabelChange(xl.rowIndex, newLabel)} />
        ))}

        {/* Remove bar button (on hover) — rendered with onMouseEnter/Leave to keep hover alive */}
        {onDataChange && data.data.length > 1 && layout.xLabels.map((xl) => {
          if (hoveredGroup !== xl.rowIndex) return null;
          const groupBars = layout.bars.filter((b) => b.rowIndex === xl.rowIndex);
          const topY = Math.min(...groupBars.map((b) => mounted ? b.y : baseline));
          const topBarH = Math.max(...groupBars.map((b) => mounted ? b.height : 0));
          // If bar is short, the value pill sits above the bar — push remove button above the pill
          const hasValuePill = topBarH < 28;
          const btnY = hasValuePill ? topY - 38 : topY - 22;
          return (
            <ActionButton
              key={`remove-bar-${xl.rowIndex}`}
              cx={xl.x}
              cy={btnY}
              type="remove"
              color="#ef4444"
              isDark={isDark}
              onClick={() => handleRemoveBar(xl.rowIndex)}
              onMouseEnter={() => enterGroup(xl.rowIndex)}
              onMouseLeave={leaveGroup}
            />
          );
        })}

        {/* Add bar buttons — at each gap */}
        {onDataChange && (() => {
          const numGroups = data.data.length;
          const btns: React.ReactNode[] = [];
          for (let i = 0; i <= numGroups; i++) {
            let cx: number;
            if (i === 0) cx = layout.chartX - 2;
            else if (i === numGroups) cx = layout.chartX + layout.chartW + 16;
            else {
              const prevCenter = layout.xLabels[i - 1].x;
              const nextCenter = layout.xLabels[i].x;
              cx = (prevCenter + nextCenter) / 2;
            }
            btns.push(
              <ActionButton key={`add-bar-${i}`} cx={cx} cy={baseline - layout.chartH / 2} type="add" color={palette[i % palette.length]} isDark={isDark} onClick={() => handleAddBar(i)} />
            );
          }
          return btns;
        })()}

        {/* Legend (multi-series) */}
        {data.keys.length > 1 && (() => {
          const legendY = svgHeight + 4;
          const itemWidth = 100;
          const totalLegendW = data.keys.length * itemWidth + (onDataChange ? 30 : 0);
          const startX = (containerWidth - totalLegendW) / 2;
          return (
            <g>
              {data.keys.map((k, i) => (
                <EditableLegendItem key={`legend-${k}`} seriesKey={k} color={palette[i % palette.length]} isDark={isDark} textColor={axisColor} x={startX + i * itemWidth} y={legendY} onRename={(n) => handleRenameSeries(i, n)} onRemove={() => handleRemoveSeries(i)} canRemove={!!onDataChange && data.keys.length > 1} />
              ))}
              {onDataChange && (
                <ActionButton cx={startX + data.keys.length * itemWidth + 12} cy={legendY + 7} type="add" color={palette[data.keys.length % palette.length]} isDark={isDark} onClick={handleAddSeries} />
              )}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
