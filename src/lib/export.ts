import { toPng } from "html-to-image";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function getThemeBackground(): string {
  const style = getComputedStyle(document.documentElement);
  const bg = style.getPropertyValue("--card").trim();
  if (!bg) return "#1a1a2e";
  // Convert oklch/color value to hex by reading the computed background-color
  const temp = document.createElement("div");
  // The CSS variable may already include oklch(...) or be a raw "L C H" triplet
  temp.style.backgroundColor = bg.startsWith("oklch") ? bg : `oklch(${bg})`;
  document.body.appendChild(temp);
  const computed = getComputedStyle(temp).backgroundColor;
  document.body.removeChild(temp);
  // Convert rgb(r, g, b) to hex
  const match = computed.match(/(\d+)/g);
  if (match && match.length >= 3) {
    const [r, g, b] = match.map(Number);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
  return "#1a1a2e";
}

/**
 * Remove all elements marked with data-export-ignore from a cloned DOM tree.
 */
function removeExportIgnored(root: Element): void {
  const ignored = root.querySelectorAll("[data-export-ignore]");
  ignored.forEach((el) => el.remove());
}

/**
 * Filter function for html-to-image: excludes nodes with data-export-ignore.
 * The library passes raw DOM Nodes — check both HTML dataset and SVG getAttribute.
 */
function exportFilter(node: Node): boolean {
  if (!(node instanceof Element)) return true;
  if (node.getAttribute("data-export-ignore") !== null) return false;
  return true;
}

/**
 * Export a container element's inner SVG as an .svg file.
 */
export function exportAsSvg(container: HTMLElement, filename: string) {
  // Prefer the main visual SVG (marked with data-visual-svg) over small icon SVGs
  const svgEl = container.querySelector<SVGElement>("svg[data-visual-svg]")
    || container.querySelector("svg");
  if (!svgEl) throw new Error("No SVG found");

  const clone = svgEl.cloneNode(true) as SVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  // Remove UI-only elements (zoom controls, action buttons, hit areas)
  removeExportIgnored(clone);
  clone.removeAttribute("data-visual-svg");

  // Add black background
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("fill", "#000000");
  clone.insertBefore(rect, clone.firstChild);

  const svgString = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, filename);
}

/**
 * Export a container element as a .png file.
 */
export async function exportAsPng(container: HTMLElement, filename: string) {
  const bg = getThemeBackground();

  // Pre-hide elements marked with data-export-ignore before capturing.
  // The html-to-image filter callback doesn't reliably exclude SVG child elements,
  // so we temporarily hide them via inline style instead.
  const ignored = container.querySelectorAll<HTMLElement | SVGElement>("[data-export-ignore]");
  const previousDisplay: string[] = [];
  ignored.forEach((el) => {
    previousDisplay.push(el.style.display);
    el.style.display = "none";
  });

  try {
    const dataUrl = await toPng(container, {
      backgroundColor: bg,
      pixelRatio: 2,
    });
    downloadDataUrl(dataUrl, filename);
  } finally {
    // Restore visibility
    ignored.forEach((el, i) => {
      el.style.display = previousDisplay[i];
    });
  }
}

/**
 * Export the current document as PDF using browser print.
 * Temporarily applies print-friendly styles.
 */
export function exportAsPdf() {
  window.print();
}
