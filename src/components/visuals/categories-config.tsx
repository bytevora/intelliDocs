import { DataChartType } from "@/types";

export type MindmapDirection = "left" | "right" | "horizontal" | "vertical";

export const CATEGORIES = [
  { id: "mindmap", label: "Mindmap", active: true },
  { id: "process", label: "Process", active: false },
  { id: "data", label: "Data", active: true },
  { id: "timelines", label: "Timelines", active: false },
  { id: "comparison", label: "Comparison", active: false },
  { id: "business", label: "Business Frameworks", active: false },
  { id: "brainstorming", label: "Brainstorming", active: false },
  { id: "parts", label: "Parts of a whole", active: false },
] as const;

export const DATA_CHART_OPTIONS: { id: DataChartType; label: string; icon: React.ReactNode }[] = [
  {
    id: "bar",
    label: "Bar Chart",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="10" width="3" height="8" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="7" y="6" width="3" height="12" rx="1" fill="currentColor" opacity="0.8" />
        <rect x="12" y="3" width="3" height="15" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "line",
    label: "Line Chart",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <polyline points="2,15 6,10 10,12 14,5 18,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="6" cy="10" r="1.5" fill="currentColor" />
        <circle cx="10" cy="12" r="1.5" fill="currentColor" />
        <circle cx="14" cy="5" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "area",
    label: "Area Chart",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2,16 L6,10 L10,12 L14,5 L18,8 L18,18 L2,18 Z" fill="currentColor" opacity="0.2" />
        <polyline points="2,16 6,10 10,12 14,5 18,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "donut",
    label: "Donut Chart",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.3" />
        <path d="M10,3 A7,7 0 0,1 17,10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "radar",
    label: "Radar Chart",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <polygon points="10,2 17,7 15,16 5,16 3,7" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
        <polygon points="10,5 14,8 13,14 7,14 6,8" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
      </svg>
    ),
  },
  {
    id: "scatter",
    label: "Scatter Plot",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="5" cy="13" r="1.5" fill="currentColor" opacity="0.6" />
        <circle cx="8" cy="9" r="1.5" fill="currentColor" opacity="0.8" />
        <circle cx="12" cy="11" r="1.5" fill="currentColor" opacity="0.6" />
        <circle cx="14" cy="6" r="1.5" fill="currentColor" />
        <circle cx="17" cy="4" r="1.5" fill="currentColor" opacity="0.8" />
      </svg>
    ),
  },
  {
    id: "heatmap",
    label: "Heatmap",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.3" />
        <rect x="8" y="2" width="5" height="5" rx="1" fill="currentColor" opacity="0.7" />
        <rect x="14" y="2" width="4" height="5" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="2" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.8" />
        <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="14" y="8" width="4" height="5" rx="1" fill="currentColor" opacity="0.9" />
        <rect x="2" y="14" width="5" height="4" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="8" y="14" width="5" height="4" rx="1" fill="currentColor" opacity="0.6" />
        <rect x="14" y="14" width="4" height="4" rx="1" fill="currentColor" opacity="0.3" />
      </svg>
    ),
  },
  {
    id: "sankey",
    label: "Sankey Flow",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M2,4 C8,4 12,8 18,6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
        <path d="M2,10 C8,10 12,12 18,12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
        <path d="M2,16 C8,16 12,14 18,17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
];

export const MINDMAP_DIRECTIONS: { id: MindmapDirection; label: string; available: boolean }[] = [
  { id: "left", label: "Left", available: true },
  { id: "right", label: "Right", available: true },
  { id: "horizontal", label: "Horizontal", available: true },
  { id: "vertical", label: "Vertical", available: true },
];

export function DirectionIcon({ dir, active }: { dir: MindmapDirection; active: boolean }) {
  const color = active ? "#a78bfa" : "#94a3b8";
  const size = 20;
  switch (dir) {
    case "left":
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <circle cx="14" cy="10" r="3" fill={color} />
          <line x1="11" y1="10" x2="4" y2="5" stroke={color} strokeWidth="1.5" />
          <line x1="11" y1="10" x2="4" y2="10" stroke={color} strokeWidth="1.5" />
          <line x1="11" y1="10" x2="4" y2="15" stroke={color} strokeWidth="1.5" />
          <circle cx="4" cy="5" r="1.5" fill={color} opacity="0.6" />
          <circle cx="4" cy="10" r="1.5" fill={color} opacity="0.6" />
          <circle cx="4" cy="15" r="1.5" fill={color} opacity="0.6" />
        </svg>
      );
    case "right":
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <circle cx="6" cy="10" r="3" fill={color} />
          <line x1="9" y1="10" x2="16" y2="5" stroke={color} strokeWidth="1.5" />
          <line x1="9" y1="10" x2="16" y2="10" stroke={color} strokeWidth="1.5" />
          <line x1="9" y1="10" x2="16" y2="15" stroke={color} strokeWidth="1.5" />
          <circle cx="16" cy="5" r="1.5" fill={color} opacity="0.6" />
          <circle cx="16" cy="10" r="1.5" fill={color} opacity="0.6" />
          <circle cx="16" cy="15" r="1.5" fill={color} opacity="0.6" />
        </svg>
      );
    case "horizontal":
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="3" fill={color} />
          <line x1="7" y1="10" x2="2" y2="5" stroke={color} strokeWidth="1.5" />
          <line x1="7" y1="10" x2="2" y2="15" stroke={color} strokeWidth="1.5" />
          <line x1="13" y1="10" x2="18" y2="5" stroke={color} strokeWidth="1.5" />
          <line x1="13" y1="10" x2="18" y2="15" stroke={color} strokeWidth="1.5" />
          <circle cx="2" cy="5" r="1.5" fill={color} opacity="0.6" />
          <circle cx="2" cy="15" r="1.5" fill={color} opacity="0.6" />
          <circle cx="18" cy="5" r="1.5" fill={color} opacity="0.6" />
          <circle cx="18" cy="15" r="1.5" fill={color} opacity="0.6" />
        </svg>
      );
    case "vertical":
      return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="3" fill={color} />
          <line x1="10" y1="7" x2="5" y2="2" stroke={color} strokeWidth="1.5" />
          <line x1="10" y1="7" x2="15" y2="2" stroke={color} strokeWidth="1.5" />
          <line x1="10" y1="13" x2="5" y2="18" stroke={color} strokeWidth="1.5" />
          <line x1="10" y1="13" x2="15" y2="18" stroke={color} strokeWidth="1.5" />
          <circle cx="5" cy="2" r="1.5" fill={color} opacity="0.6" />
          <circle cx="15" cy="2" r="1.5" fill={color} opacity="0.6" />
          <circle cx="5" cy="18" r="1.5" fill={color} opacity="0.6" />
          <circle cx="15" cy="18" r="1.5" fill={color} opacity="0.6" />
        </svg>
      );
  }
}

export function LoadingSpinner({ size = 5 }: { size?: number }) {
  return (
    <svg className={`h-${size} w-${size} text-violet-400 animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
