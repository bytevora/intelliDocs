import { MindmapNode } from "@/types";

export interface LayoutNode {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  depth: number;
  children: LayoutNode[];
  side: -1 | 0 | 1;
  path: string;
}

export const NODE_H = 48;
export const NODE_PAD_X = 32;
export const LEVEL_GAP_X = 120;
export const SIBLING_GAP_Y = 20;
export const LEVEL_GAP_Y = 100;
export const SIBLING_GAP_X = 24;
export const FONT_SIZE = 15;
export const ROOT_FONT_SIZE = 18;
export const MAX_NODE_W = 280;
export const MIN_NODE_W = 100;

export function measureText(label: string, isRoot: boolean): number {
  const charW = isRoot ? 10 : 8.5;
  const pad = isRoot ? NODE_PAD_X + 20 : NODE_PAD_X * 2;
  return Math.max(MIN_NODE_W, Math.min(label.length * charW + pad, MAX_NODE_W));
}

export function assignColors(
  node: MindmapNode,
  palette: string[],
  depth: number,
  branchIndex: number
): string {
  if (node.color) return node.color;
  if (depth === 0) return palette[0];
  return palette[(branchIndex % (palette.length - 1)) + 1] || palette[depth % palette.length];
}

export function buildLayout(
  node: MindmapNode,
  depth: number,
  palette: string[],
  branchIndex: number,
  side: -1 | 0 | 1 = 0,
  path: string = "r"
): LayoutNode {
  const color = assignColors(node, palette, depth, branchIndex);
  const width = measureText(node.label, depth === 0);
  const children = (node.children || []).map((child, i) =>
    buildLayout(child, depth + 1, palette, depth === 0 ? i : branchIndex, side || 1, `${path}.${i}`)
  );
  return { label: node.label, x: 0, y: 0, width, height: NODE_H, color, depth, children, side, path };
}

export function computeSubtreeHeight(node: LayoutNode): number {
  if (node.children.length === 0) return node.height;
  const childrenH = node.children.reduce((s, c) => s + computeSubtreeHeight(c), 0);
  return Math.max(node.height, childrenH + SIBLING_GAP_Y * (node.children.length - 1));
}

export function positionNodesRight(node: LayoutNode, x: number, y: number): void {
  node.x = x;
  if (node.children.length === 0) { node.y = y; return; }
  const stH = computeSubtreeHeight(node);
  node.y = y + stH / 2 - node.height / 2;
  let childY = y;
  for (const child of node.children) {
    positionNodesRight(child, x + node.width + LEVEL_GAP_X, childY);
    childY += computeSubtreeHeight(child) + SIBLING_GAP_Y;
  }
}

export function positionNodesLeft(node: LayoutNode, x: number, y: number): void {
  node.x = x;
  if (node.children.length === 0) { node.y = y; return; }
  const stH = computeSubtreeHeight(node);
  node.y = y + stH / 2 - node.height / 2;
  let childY = y;
  for (const child of node.children) {
    positionNodesLeft(child, x - child.width - LEVEL_GAP_X, childY);
    childY += computeSubtreeHeight(child) + SIBLING_GAP_Y;
  }
}

export function computeSubtreeWidth(node: LayoutNode): number {
  if (node.children.length === 0) return node.width;
  const childrenW = node.children.reduce((s, c) => s + computeSubtreeWidth(c), 0);
  return Math.max(node.width, childrenW + SIBLING_GAP_X * (node.children.length - 1));
}

export function positionNodesDown(node: LayoutNode, x: number, y: number): void {
  const stW = computeSubtreeWidth(node);
  node.x = x + stW / 2 - node.width / 2;
  node.y = y;
  if (node.children.length === 0) return;
  let childX = x;
  for (const child of node.children) {
    positionNodesDown(child, childX, y + node.height + LEVEL_GAP_Y);
    childX += computeSubtreeWidth(child) + SIBLING_GAP_X;
  }
}

export function positionNodesUp(node: LayoutNode, x: number, y: number): void {
  const stW = computeSubtreeWidth(node);
  node.x = x + stW / 2 - node.width / 2;
  node.y = y;
  if (node.children.length === 0) return;
  let childX = x;
  for (const child of node.children) {
    positionNodesUp(child, childX, y - child.height - LEVEL_GAP_Y);
    childX += computeSubtreeWidth(child) + SIBLING_GAP_X;
  }
}

export function collectBounds(node: LayoutNode): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = node.x, minY = node.y, maxX = node.x + node.width, maxY = node.y + node.height;
  for (const child of node.children) {
    const cb = collectBounds(child);
    minX = Math.min(minX, cb.minX);
    minY = Math.min(minY, cb.minY);
    maxX = Math.max(maxX, cb.maxX);
    maxY = Math.max(maxY, cb.maxY);
  }
  return { minX, minY, maxX, maxY };
}
