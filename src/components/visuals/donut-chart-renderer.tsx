"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { DonutChartData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";
import { hexToRgb, lightenColor, contrastText, formatNumber } from "./chart-utils";

// ── Constants ────────────────────────────────────────────
const ANIM_DURATION = 600;
const INNER_RATIO = 0.55;
const PAD_ANGLE = 0.025; // radians between slices
const CORNER_R = 4;
const LABEL_FONT = 11;
const VALUE_FONT = 12;
const LEGEND_FONT = 11;
const BTN_R = 11;
const LINK_OFFSET = 14;

// ── Arc path helpers ─────────────────────────────────────
function polarToCartesian(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const sweep = endAngle - startAngle;
  const largeArc = sweep > Math.PI ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);

  return [
    `M${outerStart.x},${outerStart.y}`,
    `A${outerR},${outerR},0,${largeArc},1,${outerEnd.x},${outerEnd.y}`,
    `L${innerStart.x},${innerStart.y}`,
    `A${innerR},${innerR},0,${largeArc},0,${innerEnd.x},${innerEnd.y}`,
    "Z",
  ].join(" ");
}

// ── Layout types ─────────────────────────────────────────
interface SliceLayout {
  index: number;
  id: string;
  label: string;
  value: number;
  percentage: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  color: string;
  path: string;
}

interface DonutLayout {
  slices: SliceLayout[];
  cx: number;
  cy: number;
  outerR: number;
  innerR: number;
  total: number;
}

// ── Layout computation ───────────────────────────────────
function computeLayout(
  data: DonutChartData, width: number, height: number, palette: string[]
): DonutLayout {
  const isHalf = data.variant === "half";
  const margin = 80; // for link labels
  const maxR = Math.min(width - margin * 2, height - margin * 2) / 2;
  const outerR = Math.max(maxR, 60);
  const innerR = outerR * INNER_RATIO;
  const cx = width / 2;
  const cy = isHalf ? height / 2 + outerR * 0.2 : height / 2;

  const total = data.data.reduce((sum, d) => sum + d.value, 0);
  const numSlices = data.data.length;
  const totalPad = PAD_ANGLE * numSlices;

  const startOffset = isHalf ? -Math.PI / 2 : -Math.PI / 2;
  const totalAngle = isHalf ? Math.PI : Math.PI * 2;
  const usableAngle = totalAngle - totalPad;

  const slices: SliceLayout[] = [];
  let currentAngle = startOffset;

  for (let i = 0; i < numSlices; i++) {
    const d = data.data[i];
    const percentage = total > 0 ? d.value / total : 1 / numSlices;
    const sweep = usableAngle * percentage;
    const start = currentAngle + PAD_ANGLE / 2;
    const end = start + sweep;
    const mid = (start + end) / 2;
    const color = palette[i % palette.length];

    slices.push({
      index: i,
      id: d.id,
      label: d.label,
      value: d.value,
      percentage,
      startAngle: start,
      endAngle: end,
      midAngle: mid,
      color,
      path: arcPath(cx, cy, outerR, innerR, start, end),
    });

    currentAngle = end + PAD_ANGLE / 2;
  }

  return { slices, cx, cy, outerR, innerR, total };
}

// ── Editable arc label (value) ───────────────────────────
function EditableArcValue({
  slice, cx, cy, outerR, isDark, onValueChange,
}: {
  slice: SliceLayout; cx: number; cy: number; outerR: number; isDark: boolean;
  onValueChange: (index: number, newVal: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Position the label along the arc link line
  const labelR = outerR + LINK_OFFSET + 12;
  const pos = polarToCartesian(cx, cy, labelR, slice.midAngle);
  const isRight = slice.midAngle > -Math.PI / 2 && slice.midAngle < Math.PI / 2;

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    setEditing(true);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
  }, []);

  const commit = useCallback(() => {
    setEditing(false);
    const raw = inputRef.current?.value ?? "";
    const val = parseFloat(raw);
    if (!isNaN(val) && val >= 0 && val !== slice.value) onValueChange(slice.index, val);
  }, [slice, onValueChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") setEditing(false);
  }, [commit]);

  if (editing) {
    return (
      <foreignObject x={pos.x - 32} y={pos.y - 12} width={64} height={24}>
        <input ref={inputRef} type="number" min={0} step="any" defaultValue={slice.value}
          onBlur={commit} onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "100%", height: "100%", fontSize: VALUE_FONT, fontWeight: 700,
            textAlign: "center",
            background: isDark ? "rgba(30,30,50,0.95)" : "rgba(255,255,255,0.95)",
            color: isDark ? "#e2e8f0" : "#1e293b",
            border: `2px solid ${slice.color}`, borderRadius: 4, outline: "none",
            padding: "0 4px", boxShadow: `0 0 0 3px ${slice.color}33`,
          }}
        />
      </foreignObject>
    );
  }

  // Draw link line + label
  const linkStart = polarToCartesian(cx, cy, outerR + 2, slice.midAngle);
  const linkMid = polarToCartesian(cx, cy, outerR + LINK_OFFSET, slice.midAngle);
  const linkEndX = isRight ? linkMid.x + 16 : linkMid.x - 16;

  return (
    <g onClick={startEdit} style={{ cursor: "pointer", pointerEvents: "auto" }}>
      {/* Link line */}
      <polyline
        points={`${linkStart.x},${linkStart.y} ${linkMid.x},${linkMid.y} ${linkEndX},${linkMid.y}`}
        fill="none" stroke={slice.color} strokeWidth={2} strokeOpacity={0.7}
      />
      {/* Label text */}
      <text
        x={linkEndX + (isRight ? 4 : -4)} y={linkMid.y}
        textAnchor={isRight ? "start" : "end"} dominantBaseline="central"
        fontSize={LABEL_FONT} fontFamily="system-ui, -apple-system, sans-serif"
        fill={isDark ? "#e2e8f0" : "#1e293b"}>
        {slice.label}
      </text>
      {/* Value below label */}
      <text
        x={linkEndX + (isRight ? 4 : -4)} y={linkMid.y + 14}
        textAnchor={isRight ? "start" : "end"} dominantBaseline="central"
        fontSize={VALUE_FONT - 1} fontWeight={700} fontFamily="system-ui, -apple-system, sans-serif"
        fill={slice.color}>
        {formatNumber(slice.value)} ({(slice.percentage * 100).toFixed(0)}%)
      </text>
    </g>
  );
}

// ── Editable slice label (name - double click on arc) ────
function EditableSliceLabel({
  slice, cx, cy, r, isDark, onLabelChange,
}: {
  slice: SliceLayout; cx: number; cy: number; r: number; isDark: boolean;
  onLabelChange: (index: number, newLabel: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pos = polarToCartesian(cx, cy, r, slice.midAngle);

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
    const newText = e.currentTarget.textContent?.trim() || slice.label;
    if (newText !== slice.label) onLabelChange(slice.index, newText);
  }, [slice, onLabelChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); }
    if (e.key === "Escape") { if (ref.current) ref.current.textContent = slice.label; (e.target as HTMLElement).blur(); }
  }, [slice.label]);

  if (!editing) return null; // Label editing is triggered by double-click on arc

  return (
    <foreignObject x={pos.x - 50} y={pos.y - 14} width={100} height={28}>
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
        {slice.label}
      </div>
    </foreignObject>
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

// ── Editable legend item ─────────────────────────────────
function EditableLegendItem({
  label, color, isDark, textColor, x, y, onRename, onRemove, canRemove,
}: {
  label: string; color: string; isDark: boolean; textColor: string;
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
    const newText = e.currentTarget.textContent?.trim() || label;
    if (newText !== label) onRename(newText);
  }, [label, onRename]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); }
    if (e.key === "Escape") { if (ref.current) ref.current.textContent = label; (e.target as HTMLElement).blur(); }
  }, [label]);

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
          {label}
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

// ── Main renderer ────────────────────────────────────────
interface DonutChartRendererProps {
  data: DonutChartData;
  theme: VisualTheme;
  onDataChange?: (data: DonutChartData) => void;
}

export function DonutChartRenderer({ data, theme, onDataChange }: DonutChartRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [mounted, setMounted] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState<number | null>(null);

  const colors = THEME_COLORS[theme];
  const palette = colors.palette;
  const isDark = theme === "dark";
  const titleColor = isDark ? "#e2e8f0" : colors.text;
  const axisColor = colors.textMuted;

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

  const isHalf = data.variant === "half";
  const svgHeight = isHalf ? 300 : 380;
  const legendH = 30;
  const totalH = svgHeight + legendH;
  const layout = computeLayout(data, containerWidth, svgHeight, palette);

  // ── Edit handlers ──────────────────────────────────────
  const handleValueChange = useCallback((index: number, newVal: number) => {
    if (!onDataChange) return;
    onDataChange({ ...data, data: data.data.map((d, i) => i !== index ? d : { ...d, value: newVal }) });
  }, [data, onDataChange]);

  const handleLabelChange = useCallback((index: number, newLabel: string) => {
    if (!onDataChange) return;
    onDataChange({ ...data, data: data.data.map((d, i) => i !== index ? d : { ...d, label: newLabel, id: newLabel }) });
    setEditingLabel(null);
  }, [data, onDataChange]);

  const handleAddSlice = useCallback(() => {
    if (!onDataChange) return;
    const newId = `Slice ${data.data.length + 1}`;
    onDataChange({ ...data, data: [...data.data, { id: newId, label: newId, value: 0 }] });
  }, [data, onDataChange]);

  const handleRemoveSlice = useCallback((index: number) => {
    if (!onDataChange || data.data.length <= 1) return;
    onDataChange({ ...data, data: data.data.filter((_, i) => i !== index) });
  }, [data, onDataChange]);

  const handleRenameLegend = useCallback((index: number, newName: string) => {
    if (!onDataChange) return;
    onDataChange({ ...data, data: data.data.map((d, i) => i !== index ? d : { ...d, label: newName, id: newName }) });
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

        {/* Arc slices */}
        {layout.slices.map((slice) => {
          const isHovered = hoveredSlice === slice.index;
          // Scale up on hover
          const scale = isHovered ? 1.04 : 1;
          const translateX = isHovered ? (Math.cos(slice.midAngle) * 4) : 0;
          const translateY = isHovered ? (Math.sin(slice.midAngle) * 4) : 0;

          return (
            <g key={`slice-${slice.index}`}
              onMouseEnter={() => setHoveredSlice(slice.index)}
              onMouseLeave={() => setHoveredSlice(null)}
              onDoubleClick={(e) => {
                if (onDataChange) { e.stopPropagation(); setEditingLabel(slice.index); }
              }}
              style={{ cursor: "pointer" }}>
              <path
                d={mounted ? slice.path : arcPath(layout.cx, layout.cy, layout.outerR, layout.innerR, slice.startAngle, slice.startAngle + 0.001)}
                fill={slice.color}
                opacity={isHovered ? 1 : 0.85}
                stroke={isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.8)"}
                strokeWidth={1}
                transform={`translate(${translateX}, ${translateY})`}
                style={{
                  transition: `d ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 150ms ease, transform 150ms ease`,
                }}
              />
              {/* Arc label (percentage) inside the slice */}
              {mounted && (slice.endAngle - slice.startAngle) > 0.3 && (() => {
                const labelR = (layout.outerR + layout.innerR) / 2;
                const pos = polarToCartesian(layout.cx, layout.cy, labelR, slice.midAngle);
                return (
                  <text x={pos.x + translateX} y={pos.y + translateY}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={VALUE_FONT} fontWeight={700}
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fill={contrastText(slice.color)}
                    style={{ pointerEvents: "none", transition: `x 150ms ease, y 150ms ease` }}>
                    {(slice.percentage * 100).toFixed(0)}%
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* Center total */}
        <text x={layout.cx} y={layout.cy - 8} textAnchor="middle" dominantBaseline="central"
          fontSize={20} fontWeight={800} fontFamily="system-ui, -apple-system, sans-serif"
          fill={isDark ? "#e2e8f0" : colors.text}>
          {formatNumber(layout.total)}
        </text>
        <text x={layout.cx} y={layout.cy + 12} textAnchor="middle" dominantBaseline="central"
          fontSize={11} fontFamily="system-ui, -apple-system, sans-serif" fill={axisColor}>
          Total
        </text>

        {/* Link labels with values */}
        {mounted && layout.slices.map((slice) => (
          <EditableArcValue key={`lbl-${slice.index}`}
            slice={slice} cx={layout.cx} cy={layout.cy} outerR={layout.outerR}
            isDark={isDark}
            onValueChange={onDataChange ? handleValueChange : () => {}} />
        ))}

        {/* Editing label overlay */}
        {editingLabel !== null && layout.slices[editingLabel] && (
          <EditableSliceLabel
            slice={layout.slices[editingLabel]}
            cx={layout.cx} cy={layout.cy}
            r={(layout.outerR + layout.innerR) / 2}
            isDark={isDark}
            onLabelChange={handleLabelChange}
          />
        )}

        {/* Remove slice button on hover */}
        {onDataChange && hoveredSlice !== null && data.data.length > 1 && (() => {
          const slice = layout.slices[hoveredSlice];
          if (!slice) return null;
          const pos = polarToCartesian(layout.cx, layout.cy, layout.outerR + 8, slice.midAngle);
          return (
            <ActionButton cx={pos.x} cy={pos.y} type="remove" color="#ef4444" isDark={isDark}
              onClick={() => handleRemoveSlice(hoveredSlice)} />
          );
        })()}

        {/* Legend + add button */}
        {(() => {
          const legendY = svgHeight + 4;
          const itemWidth = 100;
          const totalLegendW = data.data.length * itemWidth + (onDataChange ? 30 : 0);
          const startX = (containerWidth - totalLegendW) / 2;
          return (
            <g>
              {data.data.map((d, i) => (
                <EditableLegendItem key={`legend-${d.id}`} label={d.label}
                  color={palette[i % palette.length]} isDark={isDark} textColor={axisColor}
                  x={startX + i * itemWidth} y={legendY}
                  onRename={(n) => handleRenameLegend(i, n)}
                  onRemove={() => handleRemoveSlice(i)}
                  canRemove={!!onDataChange && data.data.length > 1} />
              ))}
              {onDataChange && (
                <ActionButton cx={startX + data.data.length * itemWidth + 12} cy={legendY + 7}
                  type="add" color={palette[data.data.length % palette.length]} isDark={isDark}
                  onClick={handleAddSlice} />
              )}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
