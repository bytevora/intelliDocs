export interface User {
  id: string;
  username: string;
  email: string;
  role: "admin" | "user";
  isActive?: boolean;
}

export interface AdminUser extends User {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

// Mermaid-rendered types
export type MermaidVisualType = "flowchart" | "timeline" | "sequence" | "pie";
// Custom SVG-rendered types
export type CustomVisualType = "mindmap" | "comparison" | "funnel" | "stats" | "swot" | "orgchart" | "venn";
// Data chart types (rendered via Nivo)
export type DataChartType = "bar" | "line" | "area" | "donut" | "radar" | "scatter" | "heatmap" | "sankey";
export type VisualType = MermaidVisualType | CustomVisualType | DataChartType;
export type RenderMode = "mermaid" | "custom";
export type VisualTheme = "default" | "forest" | "dark" | "neutral" | "ocean" | "sunset" | "monochrome";

export const MERMAID_TYPES: MermaidVisualType[] = ["flowchart", "timeline", "sequence", "pie"];
export const CUSTOM_TYPES: CustomVisualType[] = ["mindmap", "comparison", "funnel", "stats", "swot", "orgchart", "venn"];
export const DATA_CHART_TYPES: DataChartType[] = ["bar", "line", "area", "donut", "radar", "scatter", "heatmap", "sankey"];
export const ALL_VISUAL_TYPES: VisualType[] = [...MERMAID_TYPES, ...CUSTOM_TYPES, ...DATA_CHART_TYPES];

export interface Visual {
  id: string;
  documentId: string;
  sourceText: string;
  visualType: VisualType;
  renderMode: RenderMode;
  mermaidSyntax: string;
  customData: string | null;
  theme: VisualTheme;
  createdAt: string;
  updatedAt: string;
}

// --- Custom visual data structures ---

export interface ComparisonData {
  title: string;
  items: Array<{
    name: string;
    points: string[];
    color?: string;
  }>;
}

export interface FunnelData {
  title: string;
  stages: Array<{
    label: string;
    value: string;
    percentage?: number;
  }>;
}

export interface StatsData {
  title: string;
  metrics: Array<{
    label: string;
    value: string;
    change?: string;
    trend?: "up" | "down" | "neutral";
    icon?: string;
  }>;
}

export interface SwotData {
  title: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface OrgChartData {
  title: string;
  root: OrgNode;
}

export interface OrgNode {
  name: string;
  role?: string;
  children?: OrgNode[];
}

export interface MindmapNode {
  label: string;
  children?: MindmapNode[];
  color?: string;
}

export interface MindmapData {
  title: string;
  root: MindmapNode;
  /** "horizontal" = root centered, branches go left + right. "vertical" = root centered, branches go up + down. "left" = root on right, branches go left. "right" = root on left, branches go right. */
  layout?: "horizontal" | "vertical" | "left" | "right";
  /** Number of root children assigned to the left side in horizontal layout.
   *  Stored explicitly so the split stays stable when children are added/removed. */
  leftCount?: number;
  /** Number of root children assigned to the top side in vertical layout.
   *  Stored explicitly so the split stays stable when children are added/removed. */
  topCount?: number;
  /** Persisted zoom level (default 1). */
  zoom?: number;
  /** Persisted pan offset [x, y]. */
  pan?: [number, number];
}

export interface VennData {
  title: string;
  sets: Array<{
    label: string;
    items: string[];
  }>;
  intersections?: Array<{
    sets: number[];
    items: string[];
  }>;
}

// --- Data chart data structures (Nivo-based) ---

export interface BarChartData {
  title: string;
  layout?: "vertical" | "horizontal" | "grouped" | "stacked";
  keys: string[];
  indexBy: string;
  data: Array<Record<string, string | number>>;
}

export interface LineChartData {
  title: string;
  series: Array<{
    id: string;
    data: Array<{ x: string | number; y: number }>;
  }>;
}

export interface AreaChartData {
  title: string;
  series: Array<{
    id: string;
    data: Array<{ x: string | number; y: number }>;
  }>;
}

export interface DonutChartData {
  title: string;
  variant?: "full" | "half";
  data: Array<{
    id: string;
    label: string;
    value: number;
  }>;
}

export interface RadarChartData {
  title: string;
  keys: string[];
  indexBy: string;
  data: Array<Record<string, string | number>>;
}

export interface ScatterChartData {
  title: string;
  series: Array<{
    id: string;
    data: Array<{ x: number; y: number }>;
  }>;
}

export interface HeatmapChartData {
  title: string;
  data: Array<{
    id: string;
    data: Array<{ x: string; y: number }>;
  }>;
}

export interface SankeyChartData {
  title: string;
  nodes: Array<{ id: string }>;
  links: Array<{ source: string; target: string; value: number }>;
}

export type SharePermission = "viewer" | "editor";

export interface DocumentShare {
  id: string;
  documentId: string;
  sharedWith: string;
  permission: SharePermission;
  createdAt: string;
}

export interface Collaborator {
  id: string;
  username: string;
  email: string;
  permission: SharePermission;
  sharedAt: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isShared?: boolean;
  permission?: SharePermission;
  ownerName?: string;
}

export interface ApiError {
  error: string;
}
