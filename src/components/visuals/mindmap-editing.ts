import { MindmapNode } from "@/types";

export function updateNodeLabel(root: MindmapNode, path: string, newLabel: string): MindmapNode {
  const parts = path.split(".");
  if (parts.length === 1) return { ...root, label: newLabel };
  function recurse(node: MindmapNode, idx: number): MindmapNode {
    if (idx >= parts.length) return { ...node, label: newLabel };
    const childIndex = parseInt(parts[idx], 10);
    const newChildren = (node.children || []).map((child, i) =>
      i === childIndex ? recurse(child, idx + 1) : child
    );
    return { ...node, children: newChildren };
  }
  return recurse(root, 1);
}

/** Add a child node to the node at `path`.
 *  For root additions, `side` controls where in the children array the node is inserted
 *  so the left/right (or top/bottom) split stays stable. */
export function addChildToNode(
  root: MindmapNode,
  path: string,
  side?: "left" | "right" | "top" | "bottom",
  leftCount?: number,
  topCount?: number,
): { root: MindmapNode; leftCount: number; topCount: number } {
  const newChild: MindmapNode = { label: "New topic" };
  const parts = path.split(".");
  const currentLeft = leftCount ?? Math.ceil((root.children || []).length / 2);
  const currentTop = topCount ?? Math.ceil((root.children || []).length / 2);

  if (parts.length === 1) {
    // Adding to root — insert based on side
    const children = [...(root.children || [])];
    let newLeftCount = currentLeft;
    let newTopCount = currentTop;
    if (side === "left" || side === "top") {
      // Insert at end of left/top section (just before the right/bottom section)
      const splitAt = side === "top" ? currentTop : currentLeft;
      children.splice(splitAt, 0, newChild);
      if (side === "left") newLeftCount = currentLeft + 1;
      if (side === "top") newTopCount = currentTop + 1;
    } else {
      // Append to end (right/bottom section)
      children.push(newChild);
    }
    return { root: { ...root, children }, leftCount: newLeftCount, topCount: newTopCount };
  }

  function recurse(node: MindmapNode, idx: number): MindmapNode {
    if (idx >= parts.length) {
      return { ...node, children: [...(node.children || []), newChild] };
    }
    const childIndex = parseInt(parts[idx], 10);
    const newChildren = (node.children || []).map((child, i) =>
      i === childIndex ? recurse(child, idx + 1) : child
    );
    return { ...node, children: newChildren };
  }
  return { root: recurse(root, 1), leftCount: currentLeft, topCount: currentTop };
}

/** Remove the node at `path` from its parent's children.
 *  Returns updated root, leftCount, and topCount (adjusted if a left/top-side root child was removed). */
export function removeNodeAtPath(
  root: MindmapNode,
  path: string,
  leftCount?: number,
  topCount?: number,
): { root: MindmapNode; leftCount: number; topCount: number } {
  const parts = path.split(".");
  const currentLeft = leftCount ?? Math.ceil((root.children || []).length / 2);
  const currentTop = topCount ?? Math.ceil((root.children || []).length / 2);
  // Can't remove root itself
  if (parts.length <= 1) return { root, leftCount: currentLeft, topCount: currentTop };

  const targetIdx = parseInt(parts[parts.length - 1], 10);
  const parentParts = parts.slice(0, -1);

  // If removing a direct child of root (path = "r.N"), adjust leftCount/topCount
  let newLeftCount = currentLeft;
  let newTopCount = currentTop;
  if (parentParts.length === 1) {
    if (targetIdx < currentLeft) {
      newLeftCount = currentLeft - 1;
    }
    if (targetIdx < currentTop) {
      newTopCount = currentTop - 1;
    }
  }

  function recurse(node: MindmapNode, idx: number): MindmapNode {
    if (idx >= parentParts.length) {
      const newChildren = (node.children || []).filter((_, i) => i !== targetIdx);
      return { ...node, children: newChildren };
    }
    const childIndex = parseInt(parentParts[idx], 10);
    const newChildren = (node.children || []).map((child, i) =>
      i === childIndex ? recurse(child, idx + 1) : child
    );
    return { ...node, children: newChildren };
  }
  return { root: recurse(root, 1), leftCount: newLeftCount, topCount: newTopCount };
}
