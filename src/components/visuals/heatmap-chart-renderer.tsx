"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { HeatmapChartData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";
import { hexToRgb, lightenColor, contrastText, formatNumber } from "./chart-utils";

// ── Constants ────────────────────────────────────────────

const CHART_PADDING = { top: 40, right: 20, bottom: 60, left: 80 };
const ANIM_DURATION = 400;
const ANIM_STAGGER = 30;
const CELL_GAP = 2;
const CELL_RADIUS = 3;
const VALUE_FONT = 11;
const LABEL_FONT = 11;
const BTN_R = 11;
const LEGEND_BAR_H = 12;
const LEGEND_BAR_W = 160;

// ── Color interpolation ─────────────────────────────────

function interpolateColor(t: number, theme: VisualTheme): string {
  const tc = THEME_COLORS[theme];
  const primary = hexToRgb(tc.primary);
  // Light tint: blend primary towards white (or towards cardBg for dark themes)
  const bgBase = theme === "dark" ? hexToRgb(tc.cardBg) : { r: 245, g: 248, b: 255 };
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(bgBase.r + (primary.r - bgBase.r) * clamped);
  const g = Math.round(bgBase.g + (primary.g - bgBase.g) * clamped);
  const b = Math.round(bgBase.b + (primary.b - bgBase.b) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

function interpolateColorHex(t: number, theme: VisualTheme): string {
  const tc = THEME_COLORS[theme];
  const primary = hexToRgb(tc.primary);
  const bgBase = theme === "dark" ? hexToRgb(tc.cardBg) : { r: 245, g: 248, b: 255 };
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(bgBase.r + (primary.r - bgBase.r) * clamped);
  const g = Math.round(bgBase.g + (primary.g - bgBase.g) * clamped);
  const b = Math.round(bgBase.b + (primary.b - bgBase.b) * clamped);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ── Layout types ─────────────────────────────────────────

interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  color: string;
  rowIndex: number;
  colIndex: number;
  rowLabel: string;
  colLabel: string;
}

interface HeatmapLayout {
  cells: CellRect[];
  rowLabels: { label: string; y: number; rowIndex: number }[];
  colLabels: { label: string; x: number; colIndex: number }[];
  chartX: number;
  chartY: number;
  chartW: number;
  chartH: number;
  cellW: number;
  cellH: number;
  minVal: number;
  maxVal: number;
}

// ── Layout computation ───────────────────────────────────

function computeLayout(
  data: HeatmapChartData,
  width: number,
  theme: VisualTheme
): HeatmapLayout {
  const rows = data.data;
  const numRows = rows.length;
  const cols = numRows > 0 ? rows[0].data.map((d) => d.x) : [];
  const numCols = cols.length;

  const cX = CHART_PADDING.left;
  const cY = CHART_PADDING.top;
  const cW = width - CHART_PADDING.left - CHART_PADDING.right;
  const totalH = numRows > 0 ? Math.max(numRows * 36, 120) : 120;
  const cH = totalH;

  const cellW = numCols > 0 ? (cW - (numCols - 1) * CELL_GAP) / numCols : cW;
  const cellH = numRows > 0 ? (cH - (numRows - 1) * CELL_GAP) / numRows : cH;

  // Find min/max values
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (const row of rows) {
    for (const d of row.data) {
      if (d.y < minVal) minVal = d.y;
      if (d.y > maxVal) maxVal = d.y;
    }
  }
  if (minVal === Infinity) { minVal = 0; maxVal = 1; }
  if (minVal === maxVal) { minVal = maxVal - 1; }

  const cells: CellRect[] = [];
  const rowLabels: { label: string; y: number; rowIndex: number }[] = [];
  const colLabels: { label: string; x: number; colIndex: number }[] = [];

  for (let ci = 0; ci < numCols; ci++) {
    const x = cX + ci * (cellW + CELL_GAP);
    colLabels.push({ label: cols[ci], x: x + cellW / 2, colIndex: ci });
  }

  for (let ri = 0; ri < numRows; ri++) {
    const row = rows[ri];
    const y = cY + ri * (cellH + CELL_GAP);
    rowLabels.push({ label: row.id, y: y + cellH / 2, rowIndex: ri });

    for (let ci = 0; ci < row.data.length; ci++) {
      const d = row.data[ci];
      const t = (d.y - minVal) / (maxVal - minVal);
      const color = interpolateColorHex(t, theme);
      const x = cX + ci * (cellW + CELL_GAP);
      cells.push({
        x, y, width: cellW, height: cellH,
        value: d.y, color,
        rowIndex: ri, colIndex: ci,
        rowLabel: row.id, colLabel: d.x,
      });
    }
  }

  return { cells, rowLabels, colLabels, chartX: cX, chartY: cY, chartW: cW, chartH: cH, cellW, cellH, minVal, maxVal };
}

// ── Editable cell value ──────────────────────────────────

function EditableCellValue({
  cell, isDark, mounted, staggerIndex, onValueChange,
}: {
  cell: CellRect; isDark: boolean; mounted: boolean; staggerIndex: number;
  onValueChange: (rowIndex: number, colIndex: number, newVal: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const delay = staggerIndex * ANIM_STAGGER;

  const textColor = contrastText(cell.color);

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
    if (!isNaN(val) && val !== cell.value) {
      onValueChange(cell.rowIndex, cell.colIndex, val);
    }
  }, [cell, onValueChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setEditing(false); }
  }, [commit]);

  if (editing) {
    const inputW = Math.max(cell.width - 4, 40);
    const inputH = Math.min(cell.height - 4, 24);
    return (
      <foreignObject
        x={cell.x + cell.width / 2 - inputW / 2}
        y={cell.y + cell.height / 2 - inputH / 2}
        width={inputW}
        height={inputH}
        style={{ opacity: mounted ? 1 : 0, transition: `opacity ${ANIM_DURATION}ms ease ${delay}ms` }}
      >
        <input
          ref={inputRef}
          type="number"
          step="any"
          defaultValue={cell.value}
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
            border: `2px solid ${cell.color}`,
            borderRadius: 4, outline: "none",
            padding: "0 2px",
            boxShadow: `0 0 0 3px ${cell.color}33`,
          }}
        />
      </foreignObject>
    );
  }

  return (
    <text
      x={cell.x + cell.width / 2}
      y={cell.y + cell.height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={VALUE_FONT}
      fontWeight={700}
      fontFamily="system-ui, -apple-system, sans-serif"
      fill={textColor}
      onClick={startEdit}
      style={{
        cursor: "pointer", pointerEvents: "auto",
        opacity: mounted ? 1 : 0,
        transition: `opacity ${ANIM_DURATION}ms ease ${delay}ms`,
      }}
    >
      {formatNumber(cell.value)}
    </text>
  );
}

// ── Editable row label (double-click to edit) ────────────

function EditableRowLabel({
  label, y, isDark, textColor, onLabelChange,
}: {
  label: string; y: number; isDark: boolean; textColor: string;
  onLabelChange: (newLabel: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
      <foreignObject x={0} y={y - 12} width={CHART_PADDING.left - 8} height={24}>
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
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            fontSize: LABEL_FONT, fontFamily: "system-ui, -apple-system, sans-serif",
            color: isDark ? "#e2e8f0" : "#1e293b",
            textAlign: "right", outline: "none", cursor: "text",
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
    <text
      x={CHART_PADDING.left - 8}
      y={y}
      textAnchor="end"
      dominantBaseline="central"
      fontSize={LABEL_FONT}
      fontFamily="system-ui, -apple-system, sans-serif"
      fill={textColor}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: "pointer", pointerEvents: "auto" }}
    >
      {label}
    </text>
  );
}

// ── Editable column label (double-click to edit) ─────────

function EditableColLabel({
  label, x, chartY, isDark, textColor, onLabelChange,
}: {
  label: string; x: number; chartY: number; isDark: boolean; textColor: string;
  onLabelChange: (newLabel: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
      <foreignObject x={x - 40} y={chartY - 30} width={80} height={24}>
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
    <text
      x={x}
      y={chartY - 10}
      textAnchor="middle"
      dominantBaseline="auto"
      fontSize={LABEL_FONT}
      fontFamily="system-ui, -apple-system, sans-serif"
      fill={textColor}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: "pointer", pointerEvents: "auto" }}
    >
      {label}
    </text>
  );
}

// ── Action buttons (add/remove) ──────────────────────────

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
  const iconColor = type === "add"
    ? (isDark ? lightenColor(color, 0.6) : color)
    : (isDark ? "#fca5a5" : "#ef4444");

  return (
    <g
      data-export-ignore
      style={{ cursor: "pointer", pointerEvents: "auto" }}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      onMouseDown={(e) => e.stopPropagation()}
    >
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

// ── Animated heatmap cell ────────────────────────────────

function AnimatedCell({
  cell, staggerIndex, mounted, hovered, isDark,
}: {
  cell: CellRect; staggerIndex: number; mounted: boolean;
  hovered: boolean; isDark: boolean;
}) {
  const rgb = hexToRgb(cell.color);
  const delay = staggerIndex * ANIM_STAGGER;

  return (
    <g style={{ pointerEvents: "none" }}>
      {hovered && (
        <rect
          x={cell.x - 2}
          y={cell.y - 2}
          width={cell.width + 4}
          height={cell.height + 4}
          rx={CELL_RADIUS + 2}
          fill="none"
          stroke={isDark ? `rgba(255,255,255,0.5)` : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`}
          strokeWidth={2}
          filter={`drop-shadow(0 0 4px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4))`}
        />
      )}
      <rect
        x={cell.x}
        y={cell.y}
        width={cell.width}
        height={cell.height}
        rx={CELL_RADIUS}
        fill={cell.color}
        opacity={mounted ? (hovered ? 1 : 0.9) : 0}
        style={{
          transition: `opacity ${ANIM_DURATION}ms ease ${delay}ms`,
        }}
      />
    </g>
  );
}

// ── Color legend bar ─────────────────────────────────────

function ColorLegend({
  minVal, maxVal, theme, x, y, width,
}: {
  minVal: number; maxVal: number; theme: VisualTheme; x: number; y: number; width: number;
}) {
  const tc = THEME_COLORS[theme];
  const isDark = theme === "dark";
  const textColor = tc.textMuted;
  const gradientId = `heatmap-legend-grad-${theme}`;

  // Generate gradient stops
  const stops = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    return { offset: `${t * 100}%`, color: interpolateColor(t, theme) };
  });

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {stops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={x}
        y={y}
        width={width}
        height={LEGEND_BAR_H}
        rx={3}
        fill={`url(#${gradientId})`}
        stroke={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}
        strokeWidth={0.5}
      />
      <text
        x={x}
        y={y + LEGEND_BAR_H + 14}
        textAnchor="middle"
        fontSize={10}
        fontFamily="system-ui, -apple-system, sans-serif"
        fill={textColor}
      >
        {formatNumber(minVal)}
      </text>
      <text
        x={x + width}
        y={y + LEGEND_BAR_H + 14}
        textAnchor="middle"
        fontSize={10}
        fontFamily="system-ui, -apple-system, sans-serif"
        fill={textColor}
      >
        {formatNumber(maxVal)}
      </text>
    </g>
  );
}

// ── Main renderer ────────────────────────────────────────

interface HeatmapChartRendererProps {
  data: HeatmapChartData;
  theme: VisualTheme;
  onDataChange?: (data: HeatmapChartData) => void;
}

export function HeatmapChartRenderer({ data, theme, onDataChange }: HeatmapChartRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [mounted, setMounted] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const colors = THEME_COLORS[theme];
  const isDark = theme === "dark";
  const titleColor = isDark ? "#e2e8f0" : colors.text;
  const axisColor = colors.textMuted;

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

  const layout = computeLayout(data, containerWidth, theme);
  const legendY = CHART_PADDING.top + layout.chartH + 20;
  const totalH = legendY + LEGEND_BAR_H + 30;

  // ── Edit handlers ──────────────────────────────────────

  const handleValueChange = useCallback((rowIndex: number, colIndex: number, newVal: number) => {
    if (!onDataChange) return;
    const newData = data.data.map((row, ri) => {
      if (ri !== rowIndex) return row;
      return {
        ...row,
        data: row.data.map((d, ci) => ci !== colIndex ? d : { ...d, y: newVal }),
      };
    });
    onDataChange({ ...data, data: newData });
  }, [data, onDataChange]);

  const handleRowLabelChange = useCallback((rowIndex: number, newLabel: string) => {
    if (!onDataChange) return;
    const newData = data.data.map((row, ri) => ri !== rowIndex ? row : { ...row, id: newLabel });
    onDataChange({ ...data, data: newData });
  }, [data, onDataChange]);

  const handleColLabelChange = useCallback((colIndex: number, newLabel: string) => {
    if (!onDataChange) return;
    const newData = data.data.map((row) => ({
      ...row,
      data: row.data.map((d, ci) => ci !== colIndex ? d : { ...d, x: newLabel }),
    }));
    onDataChange({ ...data, data: newData });
  }, [data, onDataChange]);

  const handleAddRow = useCallback(() => {
    if (!onDataChange) return;
    const cols = data.data.length > 0 ? data.data[0].data.map((d) => d.x) : ["Col 1"];
    const newRow = {
      id: `Row ${data.data.length + 1}`,
      data: cols.map((x) => ({ x, y: 0 })),
    };
    onDataChange({ ...data, data: [...data.data, newRow] });
  }, [data, onDataChange]);

  const handleRemoveRow = useCallback((rowIndex: number) => {
    if (!onDataChange || data.data.length <= 1) return;
    onDataChange({ ...data, data: data.data.filter((_, i) => i !== rowIndex) });
  }, [data, onDataChange]);

  const handleAddCol = useCallback(() => {
    if (!onDataChange) return;
    const colName = `Col ${(data.data[0]?.data.length ?? 0) + 1}`;
    const newData = data.data.map((row) => ({
      ...row,
      data: [...row.data, { x: colName, y: 0 }],
    }));
    onDataChange({ ...data, data: newData });
  }, [data, onDataChange]);

  const handleRemoveCol = useCallback((colIndex: number) => {
    if (!onDataChange) return;
    const numCols = data.data[0]?.data.length ?? 0;
    if (numCols <= 1) return;
    const newData = data.data.map((row) => ({
      ...row,
      data: row.data.filter((_, ci) => ci !== colIndex),
    }));
    onDataChange({ ...data, data: newData });
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
        {/* Column labels */}
        {layout.colLabels.map((cl) => (
          <EditableColLabel
            key={`col-${cl.colIndex}`}
            label={cl.label}
            x={cl.x}
            chartY={layout.chartY}
            isDark={isDark}
            textColor={axisColor}
            onLabelChange={(newLabel) => handleColLabelChange(cl.colIndex, newLabel)}
          />
        ))}

        {/* Row labels */}
        {layout.rowLabels.map((rl) => (
          <EditableRowLabel
            key={`row-${rl.rowIndex}`}
            label={rl.label}
            y={rl.y}
            isDark={isDark}
            textColor={axisColor}
            onLabelChange={(newLabel) => handleRowLabelChange(rl.rowIndex, newLabel)}
          />
        ))}

        {/* Cell hover zones */}
        {layout.cells.map((cell) => {
          const key = `${cell.rowIndex}-${cell.colIndex}`;
          return (
            <rect
              key={`hitzone-${key}`}
              x={cell.x - 1}
              y={cell.y - 1}
              width={cell.width + 2}
              height={cell.height + 2}
              fill="transparent"
              pointerEvents="fill"
              onMouseEnter={() => setHoveredCell(key)}
              onMouseLeave={() => setHoveredCell(null)}
            />
          );
        })}

        {/* Animated cells */}
        {layout.cells.map((cell, i) => {
          const key = `${cell.rowIndex}-${cell.colIndex}`;
          return (
            <AnimatedCell
              key={`cell-${key}`}
              cell={cell}
              staggerIndex={i}
              mounted={mounted}
              hovered={hoveredCell === key}
              isDark={isDark}
            />
          );
        })}

        {/* Cell values (click to edit) */}
        {layout.cells.map((cell, i) => {
          const key = `${cell.rowIndex}-${cell.colIndex}`;
          return (
            <EditableCellValue
              key={`val-${key}`}
              cell={cell}
              isDark={isDark}
              mounted={mounted}
              staggerIndex={i}
              onValueChange={onDataChange ? handleValueChange : () => {}}
            />
          );
        })}

        {/* Remove row buttons (right side of each row) */}
        {onDataChange && data.data.length > 1 && layout.rowLabels.map((rl) => (
          <ActionButton
            key={`remove-row-${rl.rowIndex}`}
            cx={layout.chartX + layout.chartW + 14}
            cy={rl.y}
            type="remove"
            color="#ef4444"
            isDark={isDark}
            onClick={() => handleRemoveRow(rl.rowIndex)}
          />
        ))}

        {/* Add row button (below the grid) */}
        {onDataChange && (
          <ActionButton
            cx={layout.chartX + layout.chartW / 2}
            cy={layout.chartY + layout.chartH + 4 + BTN_R}
            type="add"
            color={colors.primary}
            isDark={isDark}
            onClick={handleAddRow}
          />
        )}

        {/* Remove column buttons (below each column label area, above the grid) */}
        {onDataChange && (data.data[0]?.data.length ?? 0) > 1 && layout.colLabels.map((cl) => (
          <ActionButton
            key={`remove-col-${cl.colIndex}`}
            cx={cl.x}
            cy={layout.chartY - 30}
            type="remove"
            color="#ef4444"
            isDark={isDark}
            onClick={() => handleRemoveCol(cl.colIndex)}
          />
        ))}

        {/* Add column button (right side of column labels) */}
        {onDataChange && (
          <ActionButton
            cx={layout.chartX + layout.chartW + 14}
            cy={layout.chartY - 10}
            type="add"
            color={colors.primary}
            isDark={isDark}
            onClick={handleAddCol}
          />
        )}

        {/* Color legend */}
        <ColorLegend
          minVal={layout.minVal}
          maxVal={layout.maxVal}
          theme={theme}
          x={(containerWidth - LEGEND_BAR_W) / 2}
          y={legendY}
          width={LEGEND_BAR_W}
        />
      </svg>
    </div>
  );
}
