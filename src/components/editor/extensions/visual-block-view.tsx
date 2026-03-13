"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { NodeViewWrapper, ReactNodeViewProps } from "@tiptap/react";
import { MermaidRenderer } from "@/components/visuals/mermaid-renderer";
import { CustomVisualRenderer } from "@/components/visuals/custom-visual-renderer";
import { WidgetTextToolbar } from "@/components/visuals/widget-text-toolbar";
import { exportAsPng, exportAsSvg } from "@/lib/export";
import { useDocument } from "@/components/editor/document-context";
import {
  Visual,
  VisualTheme,
  CustomVisualType,
  DataChartType,
  CUSTOM_TYPES,
  DATA_CHART_TYPES,
  MERMAID_TYPES,
} from "@/types";
import { THEME_OPTIONS } from "@/components/visuals/theme-colors";

// ── Constants ──────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  flowchart: "Flowchart",
  mindmap: "Mind Map",
  timeline: "Timeline",
  sequence: "Sequence",
  pie: "Pie Chart",
  comparison: "Comparison",
  funnel: "Funnel",
  stats: "Stats",
  swot: "SWOT",
  orgchart: "Org Chart",
  venn: "Venn",
  bar: "Bar Chart",
  line: "Line Chart",
  area: "Area Chart",
  donut: "Donut Chart",
  radar: "Radar Chart",
  scatter: "Scatter Plot",
  heatmap: "Heatmap",
  sankey: "Sankey",
};

const ASPECT_RATIOS = [
  { label: "Auto", value: "" },
  { label: "16:9", value: "16/9" },
  { label: "4:3", value: "4/3" },
  { label: "1:1", value: "1/1" },
  { label: "3:4", value: "3/4" },
];

// ── Component ──────────────────────────────────────────────

export function VisualBlockView({ node, deleteNode }: ReactNodeViewProps) {
  const { documentId, authFetch } = useDocument();
  const [visual, setVisual] = useState<Visual | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("");
  const visualContentRef = useRef<HTMLDivElement>(null);

  // ── Context menu state ──
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [ctxSub, setCtxSub] = useState<string | null>(null); // which submenu is open
  const ctxRef = useRef<HTMLDivElement>(null);

  // ── Drag state ──
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);

  // ── Info panel ──
  const [showInfo, setShowInfo] = useState(false);

  const visualId = node.attrs.visualId;

  // ── Data fetching ──

  const fetchVisual = useCallback(async () => {
    try {
      const res = await authFetch(
        `/api/documents/${documentId}/visuals/${visualId}`
      );
      if (!res.ok) {
        setError("Visual not found");
        return;
      }
      setVisual(await res.json());
    } catch {
      setError("Failed to load visual");
    } finally {
      setLoading(false);
    }
  }, [documentId, visualId, authFetch]);

  useEffect(() => {
    fetchVisual();
  }, [fetchVisual]);

  // ── Actions ──

  const handleThemeChange = async (theme: VisualTheme) => {
    const res = await authFetch(
      `/api/documents/${documentId}/visuals/${visualId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      }
    );
    if (res.ok) setVisual(await res.json());
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await authFetch(
        `/api/documents/${documentId}/visuals/${visualId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "regenerate" }),
        }
      );
      if (res.ok) setVisual(await res.json());
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async () => {
    await authFetch(`/api/documents/${documentId}/visuals/${visualId}`, {
      method: "DELETE",
    });
    deleteNode();
  };

  const handleCustomDataChange = useCallback(async (newCustomData: string) => {
    if (!visual) return;
    // Optimistic update — reflect change immediately so rapid clicks work
    setVisual((prev) => prev ? { ...prev, customData: newCustomData } : prev);
    try {
      const res = await authFetch(
        `/api/documents/${documentId}/visuals/${visualId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customData: newCustomData }),
        }
      );
      if (!res.ok) {
        // Revert on failure
        setVisual((prev) => prev ? { ...prev, customData: visual.customData } : prev);
      }
    } catch {
      // Revert on error
      setVisual((prev) => prev ? { ...prev, customData: visual.customData } : prev);
    }
  }, [visual, authFetch, documentId, visualId]);

  const handleExport = async (format: "png" | "svg") => {
    if (!visualContentRef.current || !visual) return;
    const filename = `${visual.visualType}-${visual.id.slice(0, 8)}`;
    try {
      if (format === "png") await exportAsPng(visualContentRef.current, filename);
      else await exportAsSvg(visualContentRef.current, filename);
    } catch {
      // Export failed silently
    }
    setCtxMenu(null);
  };

  // ── Context menu ──

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Use viewport coordinates for fixed positioning
    setCtxMenu({ x: e.clientX, y: e.clientY });
    setCtxSub(null);
  };

  // Close ctx menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
        setCtxSub(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ctxMenu]);

  // ── Drag handling ──

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragOffsetRef.current = { x: e.clientX - positionRef.current.x, y: e.clientY - positionRef.current.y };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      const newPos = { x: e.clientX - dragOffsetRef.current.x, y: e.clientY - dragOffsetRef.current.y };
      positionRef.current = newPos;
      setPosition(newPos);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  // ── Renders ──

  if (loading) {
    return (
      <NodeViewWrapper>
        <div className="rounded-xl border bg-muted/20 p-10 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading visual...
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  if (error || !visual) {
    return (
      <NodeViewWrapper>
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 flex items-center justify-between">
          <span className="text-sm text-destructive">{error || "Visual not found"}</span>
          <button onClick={deleteNode} className="text-xs text-muted-foreground hover:text-destructive">
            Remove
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  const isCustom = (CUSTOM_TYPES as string[]).includes(visual.visualType) || (DATA_CHART_TYPES as string[]).includes(visual.visualType);
  const isMermaid = (MERMAID_TYPES as string[]).includes(visual.visualType);

  // Submenu direction: flip left if menu is near right edge
  const subCls = ctxMenu && ctxMenu.x > (typeof window !== "undefined" ? window.innerWidth : 1200) - 450
    ? "absolute right-full mr-1 top-0"
    : "absolute left-full ml-1 top-0";

  return (
    <NodeViewWrapper>
      <div
        ref={dragRef}
        className="relative my-6 group"
        draggable={false}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={handleContextMenu}
      >
        {/* ── Main visual card ── */}
        <div
          className="relative rounded-xl border border-border bg-card shadow-md dark:shadow-lg dark:shadow-black/20 overflow-hidden transition-shadow hover:shadow-xl dark:hover:shadow-black/30"
          style={aspectRatio ? { aspectRatio } : undefined}
        >
          {/* ── Top bar — always visible on hover ── */}
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-background/90 via-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Left: badge + drag handle */}
            <div className="flex items-center gap-2">
              {/* Drag handle */}
              <button
                onMouseDown={handleDragStart}
                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-accent/50 text-muted-foreground"
                title="Drag to reposition"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="4" cy="3" r="1.5" />
                  <circle cx="12" cy="3" r="1.5" />
                  <circle cx="4" cy="8" r="1.5" />
                  <circle cx="12" cy="8" r="1.5" />
                  <circle cx="4" cy="13" r="1.5" />
                  <circle cx="12" cy="13" r="1.5" />
                </svg>
              </button>

              <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary tracking-wide uppercase">
                {TYPE_LABELS[visual.visualType] || visual.visualType}
              </span>
            </div>

            {/* Right: quick actions */}
            <div className="flex items-center gap-0.5">
              {/* Sync / Regenerate */}
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="p-1.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                title="Sync with text"
              >
                <svg className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Delete */}
              <button
                onClick={handleDelete}
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              {/* Context menu trigger */}
              <button
                onClick={(e) => {
                  setCtxMenu({ x: e.clientX, y: e.clientY });
                  setCtxSub(null);
                }}
                className="p-1.5 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                title="More options"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 16 16">
                  <circle cx="8" cy="3" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="8" cy="13" r="1.5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Regenerating overlay */}
          {regenerating && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Regenerating...
              </div>
            </div>
          )}

          {/* ── Visual content ── */}
          <div ref={visualContentRef} className="p-6 pt-12 pb-8">
            {isCustom && visual.customData ? (
              <CustomVisualRenderer
                visualType={visual.visualType as CustomVisualType | DataChartType}
                customData={visual.customData}
                theme={visual.theme}
                onCustomDataChange={handleCustomDataChange}
              />
            ) : (
              <MermaidRenderer syntax={visual.mermaidSyntax} theme={visual.theme} />
            )}
          </div>

          {/* ── Widget text toolbar — appears on text selection inside visual ── */}
          <WidgetTextToolbar containerRef={visualContentRef} />

          {/* ── Bottom grip — shows position is draggable ── */}
          {position.x !== 0 || position.y !== 0 ? (
            <button
              onClick={() => { positionRef.current = { x: 0, y: 0 }; setPosition({ x: 0, y: 0 }); }}
              className="absolute bottom-2 right-2 z-10 text-[10px] text-muted-foreground hover:text-foreground bg-muted/80 backdrop-blur-sm rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Reset position
            </button>
          ) : null}
        </div>

        {/* ── Context Menu (portaled to body to escape transform containing block) ── */}
        {ctxMenu && visual && createPortal(
          <div
            ref={ctxRef}
            className="fixed z-[9999] w-52 rounded-lg border border-border bg-popover/95 backdrop-blur-md shadow-2xl dark:shadow-black/40 py-1 text-sm"
            style={{ left: Math.min(ctxMenu.x, window.innerWidth - 260), top: Math.min(ctxMenu.y, window.innerHeight - 350) }}
          >
            {/* Export Visual */}
            <CtxItem
              icon={<DownloadIcon />}
              label="Export Visual"
              onHover={() => setCtxSub("export")}
              hasSubmenu
            />
            {ctxSub === "export" && (
              <div className={`${subCls} w-36 rounded-lg border border-border bg-popover/95 backdrop-blur-md shadow-xl py-1`}>
                <CtxItem label="Export as PNG" onClick={() => handleExport("png")} />
                <CtxItem label="Export as SVG" onClick={() => handleExport("svg")} />
              </div>
            )}

            <CtxDivider />

            {/* Colors */}
            <CtxItem
              icon={<PaletteIcon />}
              label="Colors"
              onHover={() => setCtxSub("colors")}
              hasSubmenu
            />
            {ctxSub === "colors" && (
              <div className={`${subCls} w-40 rounded-lg border border-border bg-popover/95 backdrop-blur-md shadow-xl py-1`}>
                {THEME_OPTIONS.map((t) => (
                  <CtxItem
                    key={t.value}
                    label={t.label}
                    onClick={() => {
                      handleThemeChange(t.value);
                      setCtxMenu(null);
                    }}
                    active={visual.theme === t.value}
                    icon={<span className={`inline-block w-3 h-3 rounded-full ${t.preview}`} />}
                  />
                ))}
              </div>
            )}

            {/* Aspect Ratio */}
            <CtxItem
              icon={<AspectIcon />}
              label="Aspect Ratio"
              onHover={() => setCtxSub("aspect")}
              hasSubmenu
            />
            {ctxSub === "aspect" && (
              <div className={`${subCls} w-32 rounded-lg border border-border bg-popover/95 backdrop-blur-md shadow-xl py-1`}>
                {ASPECT_RATIOS.map((ar) => (
                  <CtxItem
                    key={ar.label}
                    label={ar.label}
                    onClick={() => {
                      setAspectRatio(ar.value);
                      setCtxMenu(null);
                    }}
                    active={aspectRatio === ar.value}
                  />
                ))}
              </div>
            )}

            <CtxDivider />

            {/* Sync with text */}
            <CtxItem
              icon={<SyncIcon />}
              label="Sync with text"
              onClick={() => {
                handleRegenerate();
                setCtxMenu(null);
              }}
            />

            {/* Info */}
            <CtxItem
              icon={<InfoIcon />}
              label="Info"
              onClick={() => {
                setShowInfo(!showInfo);
                setCtxMenu(null);
              }}
            />

            <CtxDivider />

            {/* Delete */}
            <CtxItem
              icon={<TrashIcon />}
              label="Delete"
              onClick={() => {
                handleDelete();
                setCtxMenu(null);
              }}
              destructive
            />
          </div>,
          document.body
        )}

        {/* ── Info panel ── */}
        {showInfo && visual && (
          <div className="mt-2 rounded-lg border border-border bg-popover/95 backdrop-blur-md p-4 text-xs text-muted-foreground space-y-1.5 shadow-lg">
            <div className="flex justify-between">
              <span className="font-medium text-foreground">Visual Info</span>
              <button onClick={() => setShowInfo(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground">{TYPE_LABELS[visual.visualType]}</span></div>
            <div><span className="text-muted-foreground">Render:</span> <span className="text-foreground">{visual.renderMode}</span></div>
            <div><span className="text-muted-foreground">Theme:</span> <span className="text-foreground">{visual.theme}</span></div>
            <div><span className="text-muted-foreground">Created:</span> <span className="text-foreground">{new Date(visual.createdAt).toLocaleString()}</span></div>
            <div><span className="text-muted-foreground">Updated:</span> <span className="text-foreground">{new Date(visual.updatedAt).toLocaleString()}</span></div>
            <div className="pt-1 border-t border-border">
              <span className="text-muted-foreground">Source text:</span>
              <p className="text-foreground mt-0.5 line-clamp-3">{visual.sourceText}</p>
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ── Context menu primitives ──────────────────────────────

function CtxItem({
  icon,
  label,
  onClick,
  onHover,
  hasSubmenu,
  active,
  destructive,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  onHover?: () => void;
  hasSubmenu?: boolean;
  active?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={`
        flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-[13px] transition-colors
        ${destructive ? "text-destructive hover:bg-destructive/10" : "text-popover-foreground hover:bg-accent"}
        ${active ? "bg-accent/50 font-medium" : ""}
      `}
    >
      {icon && <span className="w-4 h-4 flex items-center justify-center shrink-0 opacity-70">{icon}</span>}
      <span className="flex-1">{label}</span>
      {hasSubmenu && (
        <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}

function CtxDivider() {
  return <div className="my-1 border-t border-border/50" />;
}

// ── Icons ────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
    </svg>
  );
}

function AspectIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
