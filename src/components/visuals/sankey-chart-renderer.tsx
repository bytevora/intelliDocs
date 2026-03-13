"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { SankeyChartData, VisualTheme } from "@/types";
import { THEME_COLORS } from "./theme-colors";
import { hexToRgb, lightenColor, formatNumber } from "./chart-utils";

// ── Constants ────────────────────────────────────────────

const CHART_PADDING = { top: 20, right: 120, bottom: 20, left: 20 };
const ANIM_DURATION = 500;
const NODE_WIDTH = 16;
const NODE_SPACING = 20;
const NODE_RADIUS = 3;
const VALUE_FONT = 11;
const LABEL_FONT = 11;
const BTN_R = 11;

// ── Layout types ─────────────────────────────────────────

interface SankeyNode {
  id: string;
  column: number;
  x: number;
  y: number;
  height: number;
  color: string;
  totalFlow: number;
  index: number;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  sourceNode: SankeyNode;
  targetNode: SankeyNode;
  sourceY: number;
  targetY: number;
  width: number;
  index: number;
}

interface SankeyLayout {
  nodes: SankeyNode[];
  links: SankeyLink[];
  columns: number;
  chartX: number;
  chartY: number;
  chartW: number;
  chartH: number;
}

// ── Layout computation ───────────────────────────────────

function computeSankeyLayout(
  data: SankeyChartData,
  width: number,
  height: number,
  palette: string[]
): SankeyLayout {
  const cX = CHART_PADDING.left;
  const cY = CHART_PADDING.top;
  const cW = width - CHART_PADDING.left - CHART_PADDING.right;
  const cH = height - CHART_PADDING.top - CHART_PADDING.bottom;

  if (data.nodes.length === 0) {
    return { nodes: [], links: [], columns: 0, chartX: cX, chartY: cY, chartW: cW, chartH: cH };
  }

  // Build adjacency
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of data.nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const link of data.links) {
    outgoing.get(link.source)?.push(link.target);
    incoming.get(link.target)?.push(link.source);
  }

  // Assign columns via BFS from sources
  const columnMap = new Map<string, number>();
  const nodeIds = data.nodes.map((n) => n.id);

  // Sources: nodes with no incoming links
  const sources = nodeIds.filter((id) => (incoming.get(id)?.length ?? 0) === 0);
  // If no sources (cycle), just pick the first node
  const startNodes = sources.length > 0 ? sources : [nodeIds[0]];

  // BFS to assign columns
  const queue: string[] = [...startNodes];
  for (const s of startNodes) columnMap.set(s, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const col = columnMap.get(current)!;
    for (const target of outgoing.get(current) ?? []) {
      const existing = columnMap.get(target);
      if (existing === undefined || existing <= col) {
        columnMap.set(target, col + 1);
        queue.push(target);
      }
    }
  }

  // Nodes not yet assigned (disconnected) go to column 0
  for (const id of nodeIds) {
    if (!columnMap.has(id)) columnMap.set(id, 0);
  }

  // Sinks (no outgoing) go to the last column
  const maxCol = Math.max(...Array.from(columnMap.values()));
  const sinks = nodeIds.filter((id) => (outgoing.get(id)?.length ?? 0) === 0);
  for (const s of sinks) {
    if (maxCol > 0) columnMap.set(s, maxCol);
  }

  const numColumns = Math.max(...Array.from(columnMap.values())) + 1;

  // Compute node flow totals
  const nodeFlowMap = new Map<string, number>();
  for (const id of nodeIds) {
    const outFlow = data.links
      .filter((l) => l.source === id)
      .reduce((sum, l) => sum + l.value, 0);
    const inFlow = data.links
      .filter((l) => l.target === id)
      .reduce((sum, l) => sum + l.value, 0);
    nodeFlowMap.set(id, Math.max(outFlow, inFlow, 1));
  }

  // Group nodes by column
  const columnGroups = new Map<number, string[]>();
  for (let c = 0; c < numColumns; c++) columnGroups.set(c, []);
  for (const id of nodeIds) {
    const col = columnMap.get(id)!;
    columnGroups.get(col)!.push(id);
  }

  // Compute x positions for each column
  const colSpacing = numColumns > 1 ? (cW - NODE_WIDTH) / (numColumns - 1) : 0;

  // Compute total flow per column to scale node heights
  const totalFlowPerColumn = new Map<number, number>();
  for (let c = 0; c < numColumns; c++) {
    const ids = columnGroups.get(c)!;
    const total = ids.reduce((sum, id) => sum + (nodeFlowMap.get(id) ?? 1), 0);
    totalFlowPerColumn.set(c, total);
  }

  // Position nodes
  const nodeMap = new Map<string, SankeyNode>();
  let nodeIndex = 0;

  for (let c = 0; c < numColumns; c++) {
    const ids = columnGroups.get(c)!;
    const totalFlow = totalFlowPerColumn.get(c)!;
    const totalSpacing = Math.max(0, (ids.length - 1) * NODE_SPACING);
    const availableH = cH - totalSpacing;
    const x = cX + c * colSpacing;

    let currentY = cY;
    for (const id of ids) {
      const flow = nodeFlowMap.get(id) ?? 1;
      const nodeH = Math.max(8, (flow / totalFlow) * availableH);
      const color = palette[nodeIndex % palette.length];
      const node: SankeyNode = {
        id,
        column: c,
        x,
        y: currentY,
        height: nodeH,
        color,
        totalFlow: flow,
        index: nodeIndex,
      };
      nodeMap.set(id, node);
      currentY += nodeH + NODE_SPACING;
      nodeIndex++;
    }

    // Center the column vertically
    const totalUsed = currentY - NODE_SPACING - cY;
    const offsetY = (cH - totalUsed) / 2;
    if (offsetY > 0) {
      for (const id of ids) {
        const node = nodeMap.get(id)!;
        node.y += offsetY;
      }
    }
  }

  // Compute link positions
  // Track offset within each node for stacking links
  const sourceOffsets = new Map<string, number>();
  const targetOffsets = new Map<string, number>();
  for (const id of nodeIds) {
    sourceOffsets.set(id, 0);
    targetOffsets.set(id, 0);
  }

  const links: SankeyLink[] = [];

  // Sort links by source then target for consistent ordering
  const sortedLinks = [...data.links].sort((a, b) => {
    const aSource = nodeMap.get(a.source);
    const bSource = nodeMap.get(b.source);
    if (!aSource || !bSource) return 0;
    if (aSource.y !== bSource.y) return aSource.y - bSource.y;
    const aTarget = nodeMap.get(a.target);
    const bTarget = nodeMap.get(b.target);
    if (!aTarget || !bTarget) return 0;
    return aTarget.y - bTarget.y;
  });

  for (let i = 0; i < sortedLinks.length; i++) {
    const link = sortedLinks[i];
    const sourceNode = nodeMap.get(link.source);
    const targetNode = nodeMap.get(link.target);
    if (!sourceNode || !targetNode) continue;

    const linkWidth = (link.value / sourceNode.totalFlow) * sourceNode.height;
    const linkWidthTarget = (link.value / targetNode.totalFlow) * targetNode.height;

    const srcOffset = sourceOffsets.get(link.source) ?? 0;
    const tgtOffset = targetOffsets.get(link.target) ?? 0;

    const sourceY = sourceNode.y + srcOffset + linkWidth / 2;
    const targetY = targetNode.y + tgtOffset + linkWidthTarget / 2;

    sourceOffsets.set(link.source, srcOffset + linkWidth);
    targetOffsets.set(link.target, tgtOffset + linkWidthTarget);

    links.push({
      source: link.source,
      target: link.target,
      value: link.value,
      sourceNode,
      targetNode,
      sourceY,
      targetY,
      width: Math.min(linkWidth, linkWidthTarget),
      index: i,
    });
  }

  return {
    nodes: Array.from(nodeMap.values()),
    links,
    columns: numColumns,
    chartX: cX,
    chartY: cY,
    chartW: cW,
    chartH: cH,
  };
}

// ── Link path generator ──────────────────────────────────

function linkPath(link: SankeyLink): string {
  const x0 = link.sourceNode.x + NODE_WIDTH;
  const x1 = link.targetNode.x;
  const midX = (x0 + x1) / 2;
  const y0 = link.sourceY;
  const y1 = link.targetY;
  const w = link.width / 2;

  return [
    `M ${x0},${y0 - w}`,
    `C ${midX},${y0 - w} ${midX},${y1 - w} ${x1},${y1 - w}`,
    `L ${x1},${y1 + w}`,
    `C ${midX},${y1 + w} ${midX},${y0 + w} ${x0},${y0 + w}`,
    `Z`,
  ].join(" ");
}

// ── Editable value on a link (click to edit) ─────────────

function EditableLinkValue({
  link,
  isDark,
  onValueChange,
}: {
  link: SankeyLink;
  isDark: boolean;
  onValueChange: (linkIndex: number, newVal: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const x0 = link.sourceNode.x + NODE_WIDTH;
  const x1 = link.targetNode.x;
  const midX = (x0 + x1) / 2;
  const midY = (link.sourceY + link.targetY) / 2;

  const startEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setEditing(true);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    },
    []
  );

  const commit = useCallback(() => {
    setEditing(false);
    const raw = inputRef.current?.value ?? "";
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0 && val !== link.value) {
      onValueChange(link.index, val);
    }
  }, [link, onValueChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") setEditing(false);
    },
    [commit]
  );

  if (editing) {
    return (
      <foreignObject x={midX - 32} y={midY - 12} width={64} height={24}>
        <input
          ref={inputRef}
          type="number"
          min={1}
          step="any"
          defaultValue={link.value}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            height: "100%",
            fontSize: VALUE_FONT,
            fontWeight: 700,
            textAlign: "center",
            background: isDark ? "rgba(30,30,50,0.95)" : "rgba(255,255,255,0.95)",
            color: isDark ? "#e2e8f0" : "#1e293b",
            border: `2px solid ${link.sourceNode.color}`,
            borderRadius: 4,
            outline: "none",
            padding: "0 4px",
            boxShadow: `0 0 0 3px ${link.sourceNode.color}33`,
          }}
        />
      </foreignObject>
    );
  }

  const displayText = formatNumber(link.value);

  return (
    <g onClick={startEdit} style={{ cursor: "pointer", pointerEvents: "auto" }}>
      <text
        x={midX}
        y={midY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={VALUE_FONT}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
        fill={isDark ? "#e2e8f0" : "#1e293b"}
        opacity={0.8}
      >
        {displayText}
      </text>
    </g>
  );
}

// ── Editable node label ──────────────────────────────────

function EditableNodeLabel({
  node,
  isDark,
  textColor,
  isLastColumn,
  onRename,
}: {
  node: SankeyNode;
  isDark: boolean;
  textColor: string;
  isLastColumn: boolean;
  onRename: (newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const labelX = isLastColumn ? node.x + NODE_WIDTH + 8 : node.x - 8;
  const labelY = node.y + node.height / 2;
  const anchor = isLastColumn ? "start" : "end";

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      setEditing(false);
      const newText = e.currentTarget.textContent?.trim() || node.id;
      if (newText !== node.id) onRename(newText);
    },
    [node.id, onRename]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
      if (e.key === "Escape") {
        if (ref.current) ref.current.textContent = node.id;
        (e.target as HTMLElement).blur();
      }
    },
    [node.id]
  );

  if (editing) {
    const foX = isLastColumn ? node.x + NODE_WIDTH + 4 : node.x - 104;
    return (
      <foreignObject x={foX} y={labelY - 12} width={100} height={24}>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: isLastColumn ? "flex-start" : "flex-end",
            fontSize: LABEL_FONT,
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: isDark ? "#e2e8f0" : "#1e293b",
            textAlign: isLastColumn ? "left" : "right",
            outline: "none",
            cursor: "text",
            borderRadius: 4,
            background: isDark ? "rgba(30,30,50,0.95)" : "rgba(255,255,255,0.95)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"}`,
            padding: "2px 4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {node.id}
        </div>
      </foreignObject>
    );
  }

  return (
    <text
      x={labelX}
      y={labelY}
      textAnchor={anchor}
      dominantBaseline="central"
      fontSize={LABEL_FONT}
      fontFamily="system-ui, -apple-system, sans-serif"
      fill={textColor}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: "pointer", pointerEvents: "auto" }}
    >
      {node.id}
    </text>
  );
}

// ── Action button ────────────────────────────────────────

function ActionButton({
  cx,
  cy,
  type,
  color,
  isDark,
  onClick,
}: {
  cx: number;
  cy: number;
  type: "add" | "remove";
  color: string;
  isDark: boolean;
  onClick: () => void;
}) {
  const rgb = hexToRgb(color);
  const bgFill =
    type === "add"
      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.35 : 0.2})`
      : `rgba(239, 68, 68, ${isDark ? 0.35 : 0.2})`;
  const strokeCol = type === "add" ? color : "#ef4444";
  const iconColor =
    type === "add"
      ? isDark
        ? lightenColor(color, 0.6)
        : color
      : isDark
        ? "#fca5a5"
        : "#ef4444";

  return (
    <g
      data-export-ignore
      style={{ cursor: "pointer", pointerEvents: "auto" }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <circle cx={cx} cy={cy} r={BTN_R + 4} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={BTN_R}
        fill={bgFill}
        stroke={strokeCol}
        strokeWidth={1.2}
        strokeOpacity={0.6}
      />
      {type === "add" ? (
        <>
          <line
            x1={cx - 4}
            y1={cy}
            x2={cx + 4}
            y2={cy}
            stroke={iconColor}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <line
            x1={cx}
            y1={cy - 4}
            x2={cx}
            y2={cy + 4}
            stroke={iconColor}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      ) : (
        <line
          x1={cx - 4}
          y1={cy}
          x2={cx + 4}
          y2={cy}
          stroke={iconColor}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

// ── Tooltip ──────────────────────────────────────────────

function LinkTooltip({
  link,
  isDark,
  containerWidth,
}: {
  link: SankeyLink;
  isDark: boolean;
  containerWidth: number;
}) {
  const x0 = link.sourceNode.x + NODE_WIDTH;
  const x1 = link.targetNode.x;
  const midX = (x0 + x1) / 2;
  const midY = (link.sourceY + link.targetY) / 2;

  const text = `${link.source} → ${link.target}: ${formatNumber(link.value)}`;
  const tooltipW = Math.min(text.length * 7 + 24, 220);
  let tx = midX - tooltipW / 2;
  if (tx < 0) tx = 4;
  if (tx + tooltipW > containerWidth) tx = containerWidth - tooltipW - 4;

  return (
    <foreignObject x={tx} y={midY - 32} width={tooltipW} height={28}>
      <div
        style={{
          background: isDark ? "rgba(30,30,50,0.95)" : "rgba(255,255,255,0.95)",
          color: isDark ? "#e2e8f0" : "#1e293b",
          fontSize: 11,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 6,
          textAlign: "center",
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
          pointerEvents: "none" as const,
        }}
      >
        {text}
      </div>
    </foreignObject>
  );
}

// ── Main renderer ────────────────────────────────────────

interface SankeyChartRendererProps {
  data: SankeyChartData;
  theme: VisualTheme;
  onDataChange?: (data: SankeyChartData) => void;
}

export function SankeyChartRenderer({
  data,
  theme,
  onDataChange,
}: SankeyChartRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [mounted, setMounted] = useState(false);
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const colors = THEME_COLORS[theme];
  const palette = colors.palette;
  const isDark = theme === "dark";
  const titleColor = isDark ? "#e2e8f0" : colors.text;
  const textColor = colors.textMuted;

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
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

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
  const layout = computeSankeyLayout(data, containerWidth, svgHeight, palette);

  // Determine which links are connected to the hovered node
  const isLinkHighlighted = useCallback(
    (link: SankeyLink) => {
      if (hoveredLink !== null) return link.index === hoveredLink;
      if (hoveredNode !== null)
        return link.source === hoveredNode || link.target === hoveredNode;
      return false;
    },
    [hoveredLink, hoveredNode]
  );

  const isLinkDimmed = useCallback(
    (link: SankeyLink) => {
      if (hoveredLink === null && hoveredNode === null) return false;
      return !isLinkHighlighted(link);
    },
    [hoveredLink, hoveredNode, isLinkHighlighted]
  );

  const isNodeHighlighted = useCallback(
    (node: SankeyNode) => {
      if (hoveredNode !== null) return node.id === hoveredNode;
      if (hoveredLink !== null) {
        const link = layout.links.find((l) => l.index === hoveredLink);
        return link ? link.source === node.id || link.target === node.id : false;
      }
      return false;
    },
    [hoveredNode, hoveredLink, layout.links]
  );

  // ── Edit handlers ──────────────────────────────────────

  const handleTitleBlur = useCallback(
    (e: React.FocusEvent<HTMLHeadingElement>) => {
      const newTitle = e.currentTarget.textContent?.trim() || data.title;
      if (newTitle !== data.title && onDataChange)
        onDataChange({ ...data, title: newTitle });
    },
    [data, onDataChange]
  );

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLHeadingElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
    },
    []
  );

  const handleLinkValueChange = useCallback(
    (linkIndex: number, newVal: number) => {
      if (!onDataChange) return;
      const newLinks = data.links.map((l, i) =>
        i === linkIndex ? { ...l, value: newVal } : l
      );
      onDataChange({ ...data, links: newLinks });
    },
    [data, onDataChange]
  );

  const handleNodeRename = useCallback(
    (oldId: string, newId: string) => {
      if (!onDataChange || !newId || newId === oldId) return;
      // Check for duplicate
      if (data.nodes.some((n) => n.id === newId)) return;
      const newNodes = data.nodes.map((n) =>
        n.id === oldId ? { ...n, id: newId } : n
      );
      const newLinks = data.links.map((l) => ({
        ...l,
        source: l.source === oldId ? newId : l.source,
        target: l.target === oldId ? newId : l.target,
      }));
      onDataChange({ ...data, nodes: newNodes, links: newLinks });
    },
    [data, onDataChange]
  );

  const handleAddNode = useCallback(() => {
    if (!onDataChange) return;
    let idx = data.nodes.length + 1;
    let newId = `Node ${idx}`;
    while (data.nodes.some((n) => n.id === newId)) {
      idx++;
      newId = `Node ${idx}`;
    }
    onDataChange({ ...data, nodes: [...data.nodes, { id: newId }] });
  }, [data, onDataChange]);

  const handleRemoveNode = useCallback(
    (nodeId: string) => {
      if (!onDataChange || data.nodes.length <= 1) return;
      const newNodes = data.nodes.filter((n) => n.id !== nodeId);
      const newLinks = data.links.filter(
        (l) => l.source !== nodeId && l.target !== nodeId
      );
      onDataChange({ ...data, nodes: newNodes, links: newLinks });
    },
    [data, onDataChange]
  );

  const handleAddLink = useCallback(() => {
    if (!onDataChange || data.nodes.length < 2) return;
    // Find two nodes that aren't already linked
    let source = data.nodes[0].id;
    let target = data.nodes[data.nodes.length > 1 ? 1 : 0].id;

    // Try to find an unlinked pair
    for (const s of data.nodes) {
      for (const t of data.nodes) {
        if (s.id !== t.id) {
          const exists = data.links.some(
            (l) => l.source === s.id && l.target === t.id
          );
          if (!exists) {
            source = s.id;
            target = t.id;
            break;
          }
        }
      }
      if (
        !data.links.some((l) => l.source === source && l.target === target)
      )
        break;
    }

    onDataChange({
      ...data,
      links: [...data.links, { source, target, value: 10 }],
    });
  }, [data, onDataChange]);

  const handleRemoveLink = useCallback(
    (linkIndex: number) => {
      if (!onDataChange || data.links.length <= 1) return;
      onDataChange({
        ...data,
        links: data.links.filter((_, i) => i !== linkIndex),
      });
    },
    [data, onDataChange]
  );

  const anyHover = hoveredLink !== null || hoveredNode !== null;

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
        height={svgHeight}
        viewBox={`0 0 ${containerWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: "visible" }}
      >
        {/* Gradient definitions for links */}
        <defs>
          {layout.links.map((link) => (
            <linearGradient
              key={`grad-${link.index}`}
              id={`sankey-grad-${link.index}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor={link.sourceNode.color} />
              <stop offset="100%" stopColor={link.targetNode.color} />
            </linearGradient>
          ))}
        </defs>

        {/* Links */}
        {layout.links.map((link) => {
          const highlighted = isLinkHighlighted(link);
          const dimmed = isLinkDimmed(link);
          const opacity = highlighted ? 0.7 : dimmed ? 0.1 : 0.4;
          const animWidth = mounted ? link.width : 0;

          return (
            <g key={`link-${link.index}`}>
              <path
                d={linkPath({
                  ...link,
                  width: animWidth,
                })}
                fill={`url(#sankey-grad-${link.index})`}
                opacity={opacity}
                style={{
                  transition: `opacity 200ms ease, d ${ANIM_DURATION}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHoveredLink(link.index)}
                onMouseLeave={() => setHoveredLink(null)}
              />
              {/* Invisible wider hit area for thin links */}
              <path
                d={linkPath({
                  ...link,
                  width: Math.max(animWidth, 10),
                })}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredLink(link.index)}
                onMouseLeave={() => setHoveredLink(null)}
              />
            </g>
          );
        })}

        {/* Nodes */}
        {layout.nodes.map((node) => {
          const highlighted = isNodeHighlighted(node);
          const nodeOpacity =
            anyHover ? (highlighted || hoveredNode === node.id ? 1 : 0.4) : 1;
          const rgb = hexToRgb(node.color);

          return (
            <g
              key={`node-${node.id}`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Glow on hover */}
              {(highlighted || hoveredNode === node.id) && (
                <rect
                  x={node.x - 3}
                  y={node.y - 3}
                  width={NODE_WIDTH + 6}
                  height={node.height + 6}
                  rx={NODE_RADIUS + 3}
                  fill={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.25 : 0.15})`}
                />
              )}
              <rect
                x={node.x}
                y={node.y}
                width={NODE_WIDTH}
                height={node.height}
                rx={NODE_RADIUS}
                fill={node.color}
                opacity={nodeOpacity}
                stroke={isDark ? lightenColor(node.color, 0.2) : node.color}
                strokeWidth={1}
                strokeOpacity={0.6}
                style={{ transition: `opacity 200ms ease` }}
              />
            </g>
          );
        })}

        {/* Node labels */}
        {layout.nodes.map((node) => {
          const isLastCol = node.column === layout.columns - 1;
          // For single-column layouts, labels go to the right
          const labelRight = layout.columns <= 1 || isLastCol;
          return (
            <EditableNodeLabel
              key={`label-${node.id}`}
              node={node}
              isDark={isDark}
              textColor={textColor}
              isLastColumn={labelRight}
              onRename={(newName) => handleNodeRename(node.id, newName)}
            />
          );
        })}

        {/* Link value labels */}
        {layout.links.map((link) => (
          <EditableLinkValue
            key={`linkval-${link.index}`}
            link={link}
            isDark={isDark}
            onValueChange={
              onDataChange ? handleLinkValueChange : () => {}
            }
          />
        ))}

        {/* Tooltip on hovered link */}
        {hoveredLink !== null && (() => {
          const link = layout.links.find((l) => l.index === hoveredLink);
          if (!link) return null;
          return (
            <LinkTooltip
              link={link}
              isDark={isDark}
              containerWidth={containerWidth}
            />
          );
        })()}

        {/* Remove node buttons (shown on hover) */}
        {onDataChange &&
          data.nodes.length > 1 &&
          hoveredNode !== null &&
          (() => {
            const node = layout.nodes.find((n) => n.id === hoveredNode);
            if (!node) return null;
            return (
              <ActionButton
                cx={node.x + NODE_WIDTH / 2}
                cy={node.y - 16}
                type="remove"
                color="#ef4444"
                isDark={isDark}
                onClick={() => handleRemoveNode(node.id)}
              />
            );
          })()}

        {/* Remove link button (shown on link hover) */}
        {onDataChange &&
          data.links.length > 1 &&
          hoveredLink !== null &&
          (() => {
            const link = layout.links.find((l) => l.index === hoveredLink);
            if (!link) return null;
            const x0 = link.sourceNode.x + NODE_WIDTH;
            const x1 = link.targetNode.x;
            const midX = (x0 + x1) / 2;
            const midY = (link.sourceY + link.targetY) / 2;
            return (
              <ActionButton
                cx={midX + 40}
                cy={midY}
                type="remove"
                color="#ef4444"
                isDark={isDark}
                onClick={() => handleRemoveLink(link.index)}
              />
            );
          })()}

        {/* Add node button */}
        {onDataChange && (
          <ActionButton
            cx={containerWidth - 20}
            cy={svgHeight / 2}
            type="add"
            color={palette[data.nodes.length % palette.length]}
            isDark={isDark}
            onClick={handleAddNode}
          />
        )}

        {/* Add link button */}
        {onDataChange && data.nodes.length >= 2 && (
          <ActionButton
            cx={containerWidth - 20}
            cy={svgHeight / 2 + 30}
            type="add"
            color={palette[(data.nodes.length + 1) % palette.length]}
            isDark={isDark}
            onClick={handleAddLink}
          />
        )}

        {/* Labels for add buttons */}
        {onDataChange && (
          <>
            <text
              data-export-ignore
              x={containerWidth - 20}
              y={svgHeight / 2 + 18}
              textAnchor="middle"
              fontSize={8}
              fontFamily="system-ui, -apple-system, sans-serif"
              fill={textColor}
              opacity={0.6}
            >
              node
            </text>
            {data.nodes.length >= 2 && (
              <text
                data-export-ignore
                x={containerWidth - 20}
                y={svgHeight / 2 + 48}
                textAnchor="middle"
                fontSize={8}
                fontFamily="system-ui, -apple-system, sans-serif"
                fill={textColor}
                opacity={0.6}
              >
                link
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}
