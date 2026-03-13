/** Shared chart utility functions used by mindmap-renderer and bar-chart-renderer */

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 100, g: 100, b: 200 };
}

export function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  const r = Math.min(255, rgb.r + Math.round((255 - rgb.r) * amount));
  const g = Math.min(255, rgb.g + Math.round((255 - rgb.g) * amount));
  const b = Math.min(255, rgb.b + Math.round((255 - rgb.b) * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

export function contrastText(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.95)";
}

export function niceScale(maxVal: number, targetTicks = 5): { max: number; step: number; ticks: number[] } {
  if (maxVal <= 0) return { max: 10, step: 2, ticks: [0, 2, 4, 6, 8, 10] };
  const rawStep = maxVal / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const nice = rawStep / mag;
  const step = nice <= 1 ? mag : nice <= 2 ? 2 * mag : nice <= 5 ? 5 * mag : 10 * mag;
  const max = Math.ceil(maxVal / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { max, step, ticks };
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function wrapLabel(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && (current.length + 1 + word.length) > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  if (lines.length === 0) lines.push(text);
  return lines;
}
