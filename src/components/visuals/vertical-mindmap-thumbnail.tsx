"use client";

import { MindmapNode } from "@/types";

interface ThumbnailNode {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  colorIndex: number;
  children: ThumbnailNode[];
  side: -1 | 0 | 1;
  path: string;
}

const THUMB_NODE_H = 14;
const THUMB_PAD_X = 6;
const THUMB_LEVEL_GAP = 44;
const THUMB_SIBLING_GAP = 5;

const THUMB_PALETTE = [
  "#6366f1",
  "#f38ba8",
  "#a6e3a1",
  "#f9e2af",
  "#89b4fa",
  "#cba6f7",
  "#f5c2e7",
];

function thumbMeasure(label: string): number {
  return Math.min(label.length * 3.5 + THUMB_PAD_X * 2, 70);
}

function buildBranch(
  node: MindmapNode,
  depth: number,
  branchIndex: number,
  side: -1 | 1,
  path: string
): ThumbnailNode {
  const width = thumbMeasure(node.label);
  const colorIndex = (branchIndex % (THUMB_PALETTE.length - 1)) + 1;
  const children = (node.children || []).map((child, i) =>
    buildBranch(child, depth + 1, branchIndex, side, `${path}.${i}`)
  );
  return {
    label: node.label, x: 0, y: 0, width, height: THUMB_NODE_H,
    depth, colorIndex, children, side, path,
  };
}

function subtreeWidth(node: ThumbnailNode): number {
  if (node.children.length === 0) return node.width;
  const childW = node.children.reduce((s, c) => s + subtreeWidth(c), 0);
  return Math.max(node.width, childW + THUMB_SIBLING_GAP * (node.children.length - 1));
}

function positionDown(node: ThumbnailNode, x: number, y: number): void {
  const stW = subtreeWidth(node);
  node.x = x + stW / 2 - node.width / 2;
  node.y = y;
  if (node.children.length === 0) return;
  let childX = x;
  for (const child of node.children) {
    const cw = subtreeWidth(child);
    positionDown(child, childX, y + node.height + THUMB_LEVEL_GAP);
    childX += cw + THUMB_SIBLING_GAP;
  }
}

function positionUp(node: ThumbnailNode, x: number, y: number): void {
  const stW = subtreeWidth(node);
  node.x = x + stW / 2 - node.width / 2;
  node.y = y;
  if (node.children.length === 0) return;
  let childX = x;
  for (const child of node.children) {
    const cw = subtreeWidth(child);
    positionUp(child, childX, y - child.height - THUMB_LEVEL_GAP);
    childX += cw + THUMB_SIBLING_GAP;
  }
}

function collectBounds(node: ThumbnailNode): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = node.x, minY = node.y, maxX = node.x + node.width, maxY = node.y + node.height;
  for (const c of node.children) {
    const b = collectBounds(c);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
}

function renderConnectors(node: ThumbnailNode): React.ReactNode[] {
  const els: React.ReactNode[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const goesUp = child.side === -1;
    const sx = node.x + node.width / 2;
    const sy = goesUp ? node.y : node.y + node.height;
    const ex = child.x + child.width / 2;
    const ey = goesUp ? child.y + child.height : child.y;
    const cp = (ey - sy) * 0.5;
    els.push(
      <path
        key={`c-${child.path}`}
        d={`M ${sx} ${sy} C ${sx} ${sy + cp}, ${ex} ${ey - cp}, ${ex} ${ey}`}
        fill="none"
        stroke={THUMB_PALETTE[child.colorIndex]}
        strokeWidth={1.2}
        strokeOpacity={0.4}
      />
    );
    els.push(...renderConnectors(child));
  }
  return els;
}

function renderNodes(node: ThumbnailNode): React.ReactNode[] {
  const els: React.ReactNode[] = [];
  const color = THUMB_PALETTE[node.colorIndex];
  const isRoot = node.depth === 0;

  els.push(
    <g key={`n-${node.path}`}>
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={isRoot ? 7 : 4}
        fill={isRoot ? color : `${color}20`}
        stroke={isRoot ? "none" : color}
        strokeWidth={0.8}
      />
      <text
        x={node.x + node.width / 2}
        y={node.y + node.height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={isRoot ? "#ffffff" : "#cbd5e1"}
        fontSize={5.5}
        fontWeight={isRoot ? 700 : 400}
        fontFamily="system-ui, sans-serif"
      >
        {node.label.length > 12 ? node.label.slice(0, 10) + ".." : node.label}
      </text>
    </g>
  );

  for (const child of node.children) {
    els.push(...renderNodes(child));
  }
  return els;
}

interface VerticalMindmapThumbnailProps {
  structure: MindmapNode;
  className?: string;
}

export function VerticalMindmapThumbnail({ structure, className }: VerticalMindmapThumbnailProps) {
  const rootChildren = structure.children || [];
  const mid = Math.ceil(rootChildren.length / 2);
  const topChildren = rootChildren.slice(0, mid);
  const bottomChildren = rootChildren.slice(mid);

  const topBranches = topChildren.map((child, i) => buildBranch(child, 1, i, -1, `T${i}`));
  const bottomBranches = bottomChildren.map((child, i) => buildBranch(child, 1, mid + i, 1, `B${i}`));

  const rootWidth = thumbMeasure(structure.label);
  const root: ThumbnailNode = {
    label: structure.label,
    x: 0, y: 0,
    width: rootWidth,
    height: THUMB_NODE_H,
    depth: 0, colorIndex: 0,
    children: [...topBranches, ...bottomBranches],
    side: 0, path: "root",
  };

  const topTotalW = topBranches.reduce((s, b) => s + subtreeWidth(b), 0)
    + Math.max(0, topBranches.length - 1) * THUMB_SIBLING_GAP;
  const bottomTotalW = bottomBranches.reduce((s, b) => s + subtreeWidth(b), 0)
    + Math.max(0, bottomBranches.length - 1) * THUMB_SIBLING_GAP;
  const maxSideW = Math.max(topTotalW, bottomTotalW, rootWidth);

  root.x = maxSideW / 2 - root.width / 2;
  root.y = 0;

  let bottomX = maxSideW / 2 - bottomTotalW / 2;
  for (const branch of bottomBranches) {
    const bw = subtreeWidth(branch);
    positionDown(branch, bottomX, root.y + root.height + THUMB_LEVEL_GAP);
    bottomX += bw + THUMB_SIBLING_GAP;
  }

  let topX = maxSideW / 2 - topTotalW / 2;
  for (const branch of topBranches) {
    const bw = subtreeWidth(branch);
    positionUp(branch, topX, root.y - branch.height - THUMB_LEVEL_GAP);
    topX += bw + THUMB_SIBLING_GAP;
  }

  const allNodes = [root, ...topBranches, ...bottomBranches];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of allNodes) {
    const b = collectBounds(n);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  const pad = 8;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const ox = -minX + pad;
  const oy = -minY + pad;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%" }}
    >
      <g transform={`translate(${ox}, ${oy})`}>
        {renderConnectors(root)}
        {renderNodes(root)}
      </g>
    </svg>
  );
}
