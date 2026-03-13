"use client";

import { MindmapData, MindmapNode, VisualTheme } from "@/types";
import { THEME_COLORS, ThemeColors } from "./theme-colors";
import { useEffect, useRef, useState, useCallback } from "react";
import { hexToRgb, lightenColor } from "./chart-utils";
import {
  LayoutNode,
  NODE_H, LEVEL_GAP_X, SIBLING_GAP_Y, LEVEL_GAP_Y, SIBLING_GAP_X,
  FONT_SIZE, ROOT_FONT_SIZE,
  measureText, assignColors, buildLayout,
  computeSubtreeHeight, computeSubtreeWidth,
  positionNodesRight, positionNodesLeft, positionNodesDown, positionNodesUp,
  collectBounds,
} from "./mindmap-layout";
import { updateNodeLabel, addChildToNode, removeNodeAtPath } from "./mindmap-editing";

interface MindmapRendererProps {
  data: MindmapData;
  theme: VisualTheme;
  onDataChange?: (data: MindmapData) => void;
}

// --- SVG Rendering ---

function EditableNodeElement({
  node,
  isDark,
  onLabelChange,
}: {
  node: LayoutNode;
  isDark: boolean;
  onLabelChange: (path: string, newLabel: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const rgb = hexToRgb(node.color);
  const isRoot = node.depth === 0;
  const rx = isRoot ? 24 : 14;

  // Fill: root = solid color, children = translucent with branch color
  const fill = isRoot
    ? node.color
    : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.18 : 0.12})`;
  const strokeColor = node.color;
  const strokeWidth = isRoot ? 0 : 1.8;
  const strokeOpacity = isDark ? 0.7 : 0.5;

  // Text color: always high contrast
  // Root: white. Children on dark bg: lightened version of branch color. Light bg: darkened.
  const textColor = isRoot
    ? "#ffffff"
    : isDark
      ? lightenColor(node.color, 0.65)
      : `rgba(${Math.max(0, rgb.r - 40)}, ${Math.max(0, rgb.g - 40)}, ${Math.max(0, rgb.b - 40)}, 1)`;

  const fontSize = isRoot ? ROOT_FONT_SIZE : FONT_SIZE;
  const fontWeight = isRoot ? 700 : 500;

  // Selection highlight: contrasting bg from the branch color
  const selectionBg = isRoot
    ? `rgba(255, 255, 255, 0.35)`
    : isDark
      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55)`
      : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
  const selectionColor = isRoot
    ? "#ffffff"
    : isDark ? "#ffffff" : "#000000";

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.textContent?.trim() || node.label;
    setEditing(false);
    if (newText !== node.label) {
      onLabelChange(node.path, newText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
    if (e.key === "Escape") {
      // Revert to original label on Escape
      if (editRef.current) editRef.current.textContent = node.label;
      (e.target as HTMLElement).blur();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setEditing(true);
    // After state update, focus and select all text
    requestAnimationFrame(() => {
      if (editRef.current) {
        editRef.current.focus();
        const range = document.createRange();
        range.selectNodeContents(editRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  };

  const displayLabel = node.label.length > 28 ? node.label.slice(0, 26) + "\u2026" : node.label;

  return (
    <g>
      {isRoot && (
        <rect
          x={node.x - 6}
          y={node.y - 4}
          width={node.width + 12}
          height={node.height + 8}
          rx={rx + 6}
          fill={node.color}
          opacity={0.12}
          filter="url(#mmGlow)"
        />
      )}
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={rx}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={isRoot ? 0 : strokeOpacity}
      />
      <foreignObject
        x={node.x + 6}
        y={node.y + 4}
        width={node.width - 12}
        height={node.height - 8}
      >
        <div
          ref={editRef}
          contentEditable={editing}
          suppressContentEditableWarning
          className="mm-editable-text"
          onDoubleClick={handleDoubleClick}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: textColor,
            fontSize: `${fontSize}px`,
            fontWeight,
            fontFamily: "system-ui, -apple-system, sans-serif",
            textAlign: "center",
            outline: "none",
            cursor: editing ? "text" : "default",
            lineHeight: 1.25,
            overflow: "hidden",
            padding: "0 6px",
            wordBreak: "break-word",
            ["--sel-bg" as string]: selectionBg,
            ["--sel-color" as string]: selectionColor,
          }}
        >
          {editing ? node.label : displayLabel}
        </div>
      </foreignObject>
    </g>
  );
}

// --- Action buttons (+/-) ---

const BTN_R = 10;

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
  const bgFill = type === "add"
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.35 : 0.2})`
    : `rgba(239, 68, 68, ${isDark ? 0.35 : 0.2})`;
  const strokeCol = type === "add" ? color : "#ef4444";
  const iconColor = type === "add"
    ? (isDark ? lightenColor(color, 0.6) : color)
    : (isDark ? "#fca5a5" : "#ef4444");

  return (
    <g className="mm-btn" data-export-ignore style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onClick(); }}>
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
          <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke={iconColor} strokeWidth={1.8} strokeLinecap="round" />
          <line x1={cx} y1={cy - 4} x2={cx} y2={cy + 4} stroke={iconColor} strokeWidth={1.8} strokeLinecap="round" />
        </>
      ) : (
        <line x1={cx - 4} y1={cy} x2={cx + 4} y2={cy} stroke={iconColor} strokeWidth={1.8} strokeLinecap="round" />
      )}
    </g>
  );
}

function Connector({ parent, child }: { parent: LayoutNode; child: LayoutNode }) {
  const goesLeft = child.side === -1;
  const startX = goesLeft ? parent.x : parent.x + parent.width;
  const startY = parent.y + parent.height / 2;
  const endX = goesLeft ? child.x + child.width : child.x;
  const endY = child.y + child.height / 2;
  const cpOffset = (endX - startX) * 0.45;

  return (
    <path
      d={`M ${startX} ${startY} C ${startX + cpOffset} ${startY}, ${endX - cpOffset} ${endY}, ${endX} ${endY}`}
      fill="none"
      stroke={child.color}
      strokeWidth={2.5}
      strokeOpacity={0.4}
    />
  );
}

function VerticalConnector({ parent, child }: { parent: LayoutNode; child: LayoutNode }) {
  const goesUp = child.side === -1;
  const startX = parent.x + parent.width / 2;
  const startY = goesUp ? parent.y : parent.y + parent.height;
  const endX = child.x + child.width / 2;
  const endY = goesUp ? child.y + child.height : child.y;
  const cpOffset = (endY - startY) * 0.45;

  return (
    <path
      d={`M ${startX} ${startY} C ${startX} ${startY + cpOffset}, ${endX} ${endY - cpOffset}, ${endX} ${endY}`}
      fill="none"
      stroke={child.color}
      strokeWidth={2.5}
      strokeOpacity={0.4}
    />
  );
}

function renderConnectors(node: LayoutNode, layout?: string): React.ReactNode[] {
  const els: React.ReactNode[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (layout === "vertical") {
      els.push(<VerticalConnector key={`conn-${child.path}`} parent={node} child={child} />);
    } else {
      els.push(<Connector key={`conn-${child.path}`} parent={node} child={child} />);
    }
    els.push(...renderConnectors(child, layout));
  }
  return els;
}

function renderNodes(
  node: LayoutNode,
  isDark: boolean,
  onLabelChange: (path: string, newLabel: string) => void,
  onAddChild: (path: string, side?: "left" | "right" | "top" | "bottom") => void,
  onRemoveNode: (path: string) => void,
  layout?: string,
): React.ReactNode[] {
  const els: React.ReactNode[] = [];
  const isRoot = node.depth === 0;
  const isVertical = layout === "vertical";

  // Invisible hit area that spans from button edge to button edge,
  // bridging the gap between node rect and action buttons so hover isn't lost.
  // We use separate rects for each extension zone so the node area itself is
  // NOT covered — allowing the foreignObject contentEditable to receive events.
  const hitPad = BTN_R * 2 + 8;

  els.push(
    <g key={`nodegroup-${node.path}`} className="mm-node-group">
      {isVertical ? (
        /* Vertical: no extension zones — buttons sit on left/right edges of non-root
           nodes (or top/bottom of root). The node rect itself triggers hover. Extension
           rects would overlap with tightly-spaced siblings and cause all buttons to show. */
        <rect data-export-ignore x={node.x} y={node.y} width={node.width} height={node.height} fill="transparent" pointerEvents="none" />
      ) : (
        <>
          {/* Left extension zone */}
          <rect data-export-ignore x={node.x - hitPad} y={node.y} width={hitPad} height={node.height} fill="transparent" pointerEvents="fill" />
          {/* Right extension zone */}
          <rect data-export-ignore x={node.x + node.width} y={node.y} width={hitPad} height={node.height} fill="transparent" pointerEvents="fill" />
          <rect data-export-ignore x={node.x} y={node.y} width={node.width} height={node.height} fill="transparent" pointerEvents="none" />
        </>
      )}
      <EditableNodeElement key={`node-${node.path}`} node={node} isDark={isDark} onLabelChange={onLabelChange} />

      {isVertical ? (
        isRoot ? (
          <>
            {/* Root: + on bottom edge → add to bottom side */}
            <ActionButton
              cx={node.x + node.width / 2}
              cy={node.y + node.height + BTN_R + 4}
              type="add"
              color={node.color}
              isDark={isDark}
              onClick={() => onAddChild(node.path, "bottom")}
            />
            {/* Root: + on top edge → add to top side */}
            <ActionButton
              cx={node.x + node.width / 2}
              cy={node.y - BTN_R - 4}
              type="add"
              color={node.color}
              isDark={isDark}
              onClick={() => onAddChild(node.path, "top")}
            />
          </>
        ) : (
          <>
            {/* Non-root: + on outward vertical edge (add child) */}
            <ActionButton
              cx={node.side === -1
                ? node.x + node.width + BTN_R + 4
                : node.x + node.width + BTN_R + 4}
              cy={node.y + node.height / 2}
              type="add"
              color={node.color}
              isDark={isDark}
              onClick={() => onAddChild(node.path)}
            />
            {/* Non-root: - on left edge (remove this node) */}
            <ActionButton
              cx={node.x - BTN_R - 4}
              cy={node.y + node.height / 2}
              type="remove"
              color={node.color}
              isDark={isDark}
              onClick={() => onRemoveNode(node.path)}
            />
          </>
        )
      ) : (
        isRoot ? (
          <>
            {/* Root: + on right edge → add to right side (shown for horizontal and right layouts) */}
            {layout !== "left" && (
              <ActionButton
                cx={node.x + node.width + BTN_R + 4}
                cy={node.y + node.height / 2}
                type="add"
                color={node.color}
                isDark={isDark}
                onClick={() => onAddChild(node.path, "right")}
              />
            )}
            {/* Root: + on left edge → add to left side (shown for horizontal and left layouts) */}
            {layout !== "right" && (
              <ActionButton
                cx={node.x - BTN_R - 4}
                cy={node.y + node.height / 2}
                type="add"
                color={node.color}
                isDark={isDark}
                onClick={() => onAddChild(node.path, "left")}
              />
            )}
          </>
        ) : (
          <>
            {/* Non-root: + on outward edge (add child to this node) */}
            <ActionButton
              cx={node.side === -1
                ? node.x - BTN_R - 4
                : node.x + node.width + BTN_R + 4}
              cy={node.y + node.height / 2}
              type="add"
              color={node.color}
              isDark={isDark}
              onClick={() => onAddChild(node.path)}
            />
            {/* Non-root: - on inward edge (remove this node) */}
            <ActionButton
              cx={node.side === -1
                ? node.x + node.width + BTN_R + 4
                : node.x - BTN_R - 4}
              cy={node.y + node.height / 2}
              type="remove"
              color={node.color}
              isDark={isDark}
              onClick={() => onRemoveNode(node.path)}
            />
          </>
        )
      )}
    </g>
  );

  for (const child of node.children) {
    els.push(...renderNodes(child, isDark, onLabelChange, onAddChild, onRemoveNode, layout));
  }
  return els;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

export function MindmapRenderer({ data, theme, onDataChange }: MindmapRendererProps) {
  const colors = THEME_COLORS[theme];
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);
  const [isDark, setIsDark] = useState(false);
  const [zoom, setZoom] = useState(data.zoom ?? 1);
  const [pan, setPan] = useState<[number, number]>(data.pan ?? [0, 0]);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  // Persist zoom + pan (debounced)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const persistView = useCallback((z: number, p: [number, number]) => {
    if (!onDataChange) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      onDataChange({ ...data, zoom: z, pan: p });
    }, 400);
  }, [data, onDataChange]);

  const applyZoom = useCallback((newZoom: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(newZoom * 100) / 100));
    setZoom(clamped);
    persistView(clamped, panRef.current);
  }, [persistView]);

  /** Zoom towards a specific point (mouse position relative to the wrapper element). */
  const applyZoomAtPoint = useCallback((newZoom: number, mouseRelX: number, mouseRelY: number, rectW: number, rectH: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(newZoom * 100) / 100));
    const oldZoom = zoomRef.current;
    if (clamped === oldZoom) return;

    // Fraction of mouse position within the wrapper (0–1)
    const fracX = mouseRelX / rectW;
    const fracY = mouseRelY / rectH;

    // Adjust pan so the SVG point under the cursor stays fixed.
    // Derived from: svgPt = vbOrigin + frac * vbSize, keeping svgPt constant across zoom change.
    const curPan = panRef.current;
    const dInvZ = 1 / oldZoom - 1 / clamped;
    const newPan: [number, number] = [
      curPan[0] + svgWidthRef.current * dInvZ * (0.5 - fracX),
      curPan[1] + svgHeightRef.current * dInvZ * (0.5 - fracY),
    ];

    setPan(newPan);
    setZoom(clamped);
    persistView(clamped, newPan);
  }, [persistView]);

  // Ctrl+scroll zoom
  useEffect(() => {
    const el = svgWrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const rect = el.getBoundingClientRect();
      const mouseRelX = e.clientX - rect.left;
      const mouseRelY = e.clientY - rect.top;
      applyZoomAtPoint(zoomRef.current + delta, mouseRelX, mouseRelY, rect.width, rect.height);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [applyZoomAtPoint]);

  // Drag to pan
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    const el = svgWrapRef.current;
    if (!el) return;

    const onSelectStart = (e: Event) => {
      // Allow text selection inside editable mindmap nodes
      const target = e.target as Element;
      if (target.closest?.("[contenteditable]")) return;
      e.preventDefault();
    };
    el.addEventListener("selectstart", onSelectStart);

    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (target.closest(".mm-btn") || target.closest("[contenteditable]") || target.closest(".mm-editable-text")) return;
      if (e.button !== 0 && e.button !== 1) return;

      e.preventDefault();
      setDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: panRef.current[0],
        panY: panRef.current[1],
      };
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      e.preventDefault();
      // Convert screen pixel drag to SVG coordinate units
      const screenDx = e.clientX - dragStart.current.x;
      const screenDy = e.clientY - dragStart.current.y;
      const rect = el.getBoundingClientRect();
      const svgDx = screenDx * (svgWidthRef.current / (zoomRef.current * rect.width));
      const svgDy = screenDy * (svgHeightRef.current / (zoomRef.current * rect.height));
      const newPan: [number, number] = [dragStart.current.panX + svgDx, dragStart.current.panY + svgDy];
      setPan(newPan);
    };

    const onUp = (e: PointerEvent) => {
      if (el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
        persistView(zoomRef.current, panRef.current);
      }
      setDragging(false);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("selectstart", onSelectStart);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [persistView]);

  useEffect(() => {
    // Detect dark mode from the document
    const check = () => {
      setIsDark(document.documentElement.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    };
    check();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", check);
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => { mq.removeEventListener("change", check); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLabelChange = useCallback((path: string, newLabel: string) => {
    if (!onDataChange) return;
    onDataChange({ ...data, root: updateNodeLabel(data.root, path, newLabel) });
  }, [data, onDataChange]);

  const handleAddChild = useCallback((path: string, side?: "left" | "right" | "top" | "bottom") => {
    if (!onDataChange) return;
    const result = addChildToNode(data.root, path, side, data.leftCount, data.topCount);
    onDataChange({ ...data, root: result.root, leftCount: result.leftCount, topCount: result.topCount });
  }, [data, onDataChange]);

  const handleRemoveNode = useCallback((path: string) => {
    if (!onDataChange) return;
    const result = removeNodeAtPath(data.root, path, data.leftCount, data.topCount);
    onDataChange({ ...data, root: result.root, leftCount: result.leftCount, topCount: result.topCount });
  }, [data, onDataChange]);

  const isHorizontal = data.layout === "horizontal";
  const isVertical = data.layout === "vertical";
  const isRight = data.layout === "right";
  const isLeft = data.layout === "left";
  let layoutRoot: LayoutNode;

  if (isRight) {
    const rootChildren = data.root.children || [];
    const allChildren = rootChildren.map((child, i) =>
      buildLayout(child, 1, colors.palette, i, 1, `r.${i}`)
    );

    const rootColor = assignColors(data.root, colors.palette, 0, 0);
    const rootWidth = measureText(data.root.label, true);
    layoutRoot = {
      label: data.root.label, x: 0, y: 0,
      width: rootWidth, height: NODE_H,
      color: rootColor, depth: 0,
      children: allChildren,
      side: 0, path: "r",
    };

    const totalH = allChildren.reduce((s, c) => s + computeSubtreeHeight(c), 0)
      + Math.max(0, allChildren.length - 1) * SIBLING_GAP_Y;
    const maxH = Math.max(totalH, NODE_H);

    layoutRoot.x = 0;
    layoutRoot.y = maxH / 2 - layoutRoot.height / 2;

    let childY = maxH / 2 - totalH / 2;
    for (const branch of allChildren) {
      positionNodesRight(branch, layoutRoot.x + layoutRoot.width + LEVEL_GAP_X, childY);
      childY += computeSubtreeHeight(branch) + SIBLING_GAP_Y;
    }
  } else if (isLeft) {
    const rootChildren = data.root.children || [];
    const allChildren = rootChildren.map((child, i) =>
      buildLayout(child, 1, colors.palette, i, -1, `r.${i}`)
    );

    const rootColor = assignColors(data.root, colors.palette, 0, 0);
    const rootWidth = measureText(data.root.label, true);
    layoutRoot = {
      label: data.root.label, x: 0, y: 0,
      width: rootWidth, height: NODE_H,
      color: rootColor, depth: 0,
      children: allChildren,
      side: 0, path: "r",
    };

    const totalH = allChildren.reduce((s, c) => s + computeSubtreeHeight(c), 0)
      + Math.max(0, allChildren.length - 1) * SIBLING_GAP_Y;
    const maxH = Math.max(totalH, NODE_H);

    layoutRoot.x = 0;
    layoutRoot.y = maxH / 2 - layoutRoot.height / 2;

    let childY = maxH / 2 - totalH / 2;
    for (const branch of allChildren) {
      positionNodesLeft(branch, layoutRoot.x - branch.width - LEVEL_GAP_X, childY);
      childY += computeSubtreeHeight(branch) + SIBLING_GAP_Y;
    }
  } else if (isVertical) {
    const rootChildren = data.root.children || [];
    const mid = data.topCount ?? Math.ceil(rootChildren.length / 2);
    const topChildrenData = rootChildren.slice(0, mid);
    const bottomChildrenData = rootChildren.slice(mid);

    const topChildren = topChildrenData.map((child, i) =>
      buildLayout(child, 1, colors.palette, i, -1, `r.${i}`)
    );
    const bottomChildren = bottomChildrenData.map((child, i) =>
      buildLayout(child, 1, colors.palette, mid + i, 1, `r.${mid + i}`)
    );

    const rootColor = assignColors(data.root, colors.palette, 0, 0);
    const rootWidth = measureText(data.root.label, true);
    layoutRoot = {
      label: data.root.label, x: 0, y: 0,
      width: rootWidth, height: NODE_H,
      color: rootColor, depth: 0,
      children: [...topChildren, ...bottomChildren],
      side: 0, path: "r",
    };

    const topTotalW = topChildren.reduce((s, c) => s + computeSubtreeWidth(c), 0)
      + Math.max(0, topChildren.length - 1) * SIBLING_GAP_X;
    const bottomTotalW = bottomChildren.reduce((s, c) => s + computeSubtreeWidth(c), 0)
      + Math.max(0, bottomChildren.length - 1) * SIBLING_GAP_X;
    const maxSideW = Math.max(topTotalW, bottomTotalW, rootWidth);

    layoutRoot.x = maxSideW / 2 - layoutRoot.width / 2;
    layoutRoot.y = 0;

    let bottomX = maxSideW / 2 - bottomTotalW / 2;
    for (const branch of bottomChildren) {
      positionNodesDown(branch, bottomX, layoutRoot.y + layoutRoot.height + LEVEL_GAP_Y);
      bottomX += computeSubtreeWidth(branch) + SIBLING_GAP_X;
    }
    let topX = maxSideW / 2 - topTotalW / 2;
    for (const branch of topChildren) {
      positionNodesUp(branch, topX, layoutRoot.y - NODE_H - LEVEL_GAP_Y);
      topX += computeSubtreeWidth(branch) + SIBLING_GAP_X;
    }
  } else if (isHorizontal) {
    const rootChildren = data.root.children || [];
    const mid = data.leftCount ?? Math.ceil(rootChildren.length / 2);
    const leftChildrenData = rootChildren.slice(0, mid);
    const rightChildrenData = rootChildren.slice(mid);

    const leftChildren = leftChildrenData.map((child, i) =>
      buildLayout(child, 1, colors.palette, i, -1, `r.${i}`)
    );
    const rightChildren = rightChildrenData.map((child, i) =>
      buildLayout(child, 1, colors.palette, mid + i, 1, `r.${mid + i}`)
    );

    const rootColor = assignColors(data.root, colors.palette, 0, 0);
    const rootWidth = measureText(data.root.label, true);
    layoutRoot = {
      label: data.root.label, x: 0, y: 0,
      width: rootWidth, height: NODE_H,
      color: rootColor, depth: 0,
      children: [...leftChildren, ...rightChildren],
      side: 0, path: "r",
    };

    const leftTotalH = leftChildren.reduce((s, c) => s + computeSubtreeHeight(c), 0)
      + Math.max(0, leftChildren.length - 1) * SIBLING_GAP_Y;
    const rightTotalH = rightChildren.reduce((s, c) => s + computeSubtreeHeight(c), 0)
      + Math.max(0, rightChildren.length - 1) * SIBLING_GAP_Y;
    const maxSideH = Math.max(leftTotalH, rightTotalH, NODE_H);

    layoutRoot.x = 0;
    layoutRoot.y = maxSideH / 2 - layoutRoot.height / 2;

    let rightY = maxSideH / 2 - rightTotalH / 2;
    for (const branch of rightChildren) {
      positionNodesRight(branch, layoutRoot.x + layoutRoot.width + LEVEL_GAP_X, rightY);
      rightY += computeSubtreeHeight(branch) + SIBLING_GAP_Y;
    }
    let leftY = maxSideH / 2 - leftTotalH / 2;
    for (const branch of leftChildren) {
      positionNodesLeft(branch, layoutRoot.x - branch.width - LEVEL_GAP_X, leftY);
      leftY += computeSubtreeHeight(branch) + SIBLING_GAP_Y;
    }
  } else {
    layoutRoot = buildLayout(data.root, 0, colors.palette, 0, 0, "r");
    positionNodesRight(layoutRoot, 60, 60);
  }

  const bounds = collectBounds(layoutRoot);
  // Extra padding to accommodate the +/- action buttons at node edges
  const padding = 80;
  const svgWidth = bounds.maxX - bounds.minX + padding * 2;
  const svgHeight = bounds.maxY - bounds.minY + padding * 2;
  const offsetX = -bounds.minX + padding;
  const offsetY = -bounds.minY + padding;

  // Keep refs for drag handler (runs inside effect, needs current values)
  const svgWidthRef = useRef(svgWidth);
  const svgHeightRef = useRef(svgHeight);
  svgWidthRef.current = svgWidth;
  svgHeightRef.current = svgHeight;

  const scale = Math.min(1, containerWidth / svgWidth);
  const displayHeight = svgHeight * scale;

  // Title color — high contrast for dark/light
  const titleColor = isDark ? "#e2e8f0" : colors.text;

  const handleTitleBlur = useCallback((e: React.FocusEvent<HTMLHeadingElement>) => {
    const newTitle = e.currentTarget.textContent?.trim() || data.title;
    if (newTitle !== data.title && onDataChange) {
      onDataChange({ ...data, title: newTitle });
    }
  }, [data, onDataChange]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }, []);

  const zoomPct = Math.round(zoom * 100);

  // Compute viewBox: zoom shrinks the visible area, pan shifts it.
  // Pan is stored in SVG coordinate units so it's zoom-independent.
  const vbW = svgWidth / zoom;
  const vbH = svgHeight / zoom;
  const vbX = (svgWidth - vbW) / 2 - pan[0];
  const vbY = (svgHeight - vbH) / 2 - pan[1];

  return (
    <div ref={containerRef} className="w-full relative">
      {data.title && (
        <h3
          contentEditable
          suppressContentEditableWarning
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          className="mm-editable-text text-center text-xl font-bold mb-6 tracking-tight outline-none cursor-text focus:ring-1 focus:ring-primary/30 focus:rounded px-2"
          style={{
            color: titleColor,
            ["--sel-bg" as string]: isDark ? "rgba(139, 92, 246, 0.45)" : "rgba(99, 102, 241, 0.3)",
            ["--sel-color" as string]: isDark ? "#ffffff" : "#000000",
          }}
        >
          {data.title}
        </h3>
      )}

      {/* Zoom controls */}
      <div data-export-ignore className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-lg border bg-background/90 backdrop-blur-sm px-1.5 py-1 shadow-sm">
        <button
          onClick={() => applyZoom(zoom - ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30 text-muted-foreground"
          title="Zoom out"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={() => { setZoom(1); setPan([0, 0]); persistView(1, [0, 0]); }}
          className="min-w-[3rem] text-center text-[11px] font-medium text-muted-foreground hover:text-foreground rounded px-1 py-0.5 hover:bg-accent"
          title="Reset view"
        >
          {zoomPct}%
        </button>
        <button
          onClick={() => applyZoom(zoom + ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30 text-muted-foreground"
          title="Zoom in"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
            <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div
        ref={svgWrapRef}
        style={{
          height: Math.max(displayHeight, 350),
          cursor: dragging ? "grabbing" : "grab",
          userSelect: "none",
          WebkitUserSelect: "none",
          touchAction: "none",
          overflow: "hidden",
        }}
      >
        <svg
          data-visual-svg
          width="100%"
          height="100%"
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="mmGlow">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g transform={`translate(${offsetX}, ${offsetY})`}>
            {renderConnectors(layoutRoot, data.layout)}
            {renderNodes(layoutRoot, isDark, handleLabelChange, handleAddChild, handleRemoveNode, data.layout)}
          </g>
        </svg>
      </div>
    </div>
  );
}
