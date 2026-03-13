"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Editor } from "@tiptap/react";
import { useDocument } from "@/components/editor/document-context";
import { HORIZONTAL_MINDMAP_TEMPLATES, VERTICAL_MINDMAP_TEMPLATES, LEFT_MINDMAP_TEMPLATES, RIGHT_MINDMAP_TEMPLATES } from "./mindmap-templates";
import { HorizontalMindmapThumbnail } from "./horizontal-mindmap-thumbnail";
import { VerticalMindmapThumbnail } from "./vertical-mindmap-thumbnail";
import { LeftMindmapThumbnail } from "./left-mindmap-thumbnail";
import { RightMindmapThumbnail } from "./right-mindmap-thumbnail";
import { Visual, DataChartType } from "@/types";
import {
  MindmapDirection,
  CATEGORIES,
  DATA_CHART_OPTIONS,
  MINDMAP_DIRECTIONS,
  DirectionIcon,
  LoadingSpinner,
} from "./categories-config";

interface GeneratedTemplate {
  templateId: string;
  visual: Visual | null;
  loading: boolean;
  error: boolean;
}

interface CategoriesPanelProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}

export function CategoriesPanel({ editor, open, onClose }: CategoriesPanelProps) {
  const { documentId, authFetch } = useDocument();
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string>("mindmap");
  const [selectedDirection, setSelectedDirection] = useState<MindmapDirection | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [generatedTemplates, setGeneratedTemplates] = useState<GeneratedTemplate[]>([]);
  const [inserting, setInserting] = useState<string | null>(null);
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  const hoverInsertedVisualId = useRef<string | null>(null);
  const generationKey = useRef(0);
  const selectionInsertPos = useRef<number | null>(null);
  // Client-side cache: direction → generated templates (survives direction switches)
  const templateCacheRef = useRef<Record<string, GeneratedTemplate[]>>({});
  // Data chart generation state
  const [dataChartGenerating, setDataChartGenerating] = useState<DataChartType | null>(null);

  // Drag state
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 80, y: 80 });
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({
    dragging: false, startX: 0, startY: 0, origX: 0, origY: 0,
  });

  const onDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input")) return;
    dragState.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
  }, [position]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current.dragging) return;
      setPosition({
        x: dragState.current.origX + (e.clientX - dragState.current.startX),
        y: dragState.current.origY + (e.clientY - dragState.current.startY),
      });
    };
    const onUp = () => { dragState.current.dragging = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Pre-generate all 6 templates when a direction is clicked
  const generateAllTemplates = useCallback(async (forceRefresh = false, direction: MindmapDirection = "horizontal") => {
    if (!editor) return;

    const templates = direction === "vertical" ? VERTICAL_MINDMAP_TEMPLATES
      : direction === "left" ? LEFT_MINDMAP_TEMPLATES
      : direction === "right" ? RIGHT_MINDMAP_TEMPLATES
      : HORIZONTAL_MINDMAP_TEMPLATES;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    const fullText = editor.state.doc.textContent;
    const sourceText = selectedText.length >= 20 ? selectedText : fullText;

    if (sourceText.length < 10) return;

    // Capture the insert position: end of the block node containing the selection end
    const $to = editor.state.doc.resolve(to);
    const afterBlock = $to.after($to.depth > 0 ? 1 : $to.depth);
    selectionInsertPos.current = afterBlock;

    const key = ++generationKey.current;

    // Clear client-side cache for this direction if force-refreshing
    if (forceRefresh) {
      delete templateCacheRef.current[direction];
    }

    // Initialize all as loading
    setGeneratedTemplates(
      templates.map((t) => ({
        templateId: t.id,
        visual: null,
        loading: true,
        error: false,
      }))
    );

    // Generate one at a time sequentially with retry
    for (const template of templates) {
      if (generationKey.current !== key) return;

      let success = false;
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
        try {
          const res = await authFetch(`/api/documents/${documentId}/visuals/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceText, visualType: "mindmap", templateId: template.id, forceRefresh }),
          });

          if (generationKey.current !== key) return;

          if (res.ok) {
            const visual = await res.json();
            if (generationKey.current !== key) return;
            setGeneratedTemplates((prev) => {
              const updated = prev.map((g) => g.templateId === template.id ? { ...g, visual, loading: false } : g);
              templateCacheRef.current[direction] = updated;
              return updated;
            });
            success = true;
          } else if (attempt === 2) {
            setGeneratedTemplates((prev) => {
              const updated = prev.map((g) => g.templateId === template.id ? { ...g, loading: false, error: true } : g);
              templateCacheRef.current[direction] = updated;
              return updated;
            });
          }
        } catch {
          if (generationKey.current !== key) return;
          if (attempt === 2) {
            setGeneratedTemplates((prev) => {
              const updated = prev.map((g) => g.templateId === template.id ? { ...g, loading: false, error: true } : g);
              templateCacheRef.current[direction] = updated;
              return updated;
            });
          }
        }
      }
    }
  }, [editor, authFetch, documentId]);

  // When user clicks a direction, restore from cache or trigger generation
  const handleDirectionSelect = useCallback((dir: MindmapDirection) => {
    if (selectedDirection === dir) {
      setSelectedDirection(null);
      return;
    }
    setSelectedDirection(dir);
    // Restore from client-side cache if available
    const cached = templateCacheRef.current[dir];
    if (cached && cached.length > 0 && cached.some((g) => g.visual !== null)) {
      setGeneratedTemplates(cached);
    } else {
      setGeneratedTemplates([]);
      generateAllTemplates(false, dir);
    }
  }, [selectedDirection, generateAllTemplates]);

  // Insert position: right after the selected text's paragraph (before any existing visuals)
  const getInsertPosition = useCallback(() => {
    if (!editor) return null;
    return selectionInsertPos.current ?? editor.state.doc.content.size - 1;
  }, [editor]);

  // Replace a hover preview visual in the editor (tracked by visualId), or insert new
  const insertOrReplaceHoverVisual = useCallback((visualId: string, trackRef: React.RefObject<string | null>) => {
    if (!editor) return;

    // Try replacing existing hover visual
    if (trackRef.current !== null) {
      let replaced = false;
      editor.state.doc.descendants((node, pos) => {
        if (replaced) return false;
        if (node.type.name === "visualBlock" && node.attrs.visualId === trackRef.current) {
          const tr = editor.state.tr;
          tr.replaceWith(pos, pos + node.nodeSize, editor.schema.nodes.visualBlock.create({ visualId }));
          editor.view.dispatch(tr);
          trackRef.current = visualId;
          replaced = true;
          return false;
        }
      });
      if (replaced) return;
    }

    // Insert after all existing visual blocks below the selected text
    const insertAt = getInsertPosition() ?? editor.state.doc.content.size - 1;
    const tr = editor.state.tr;
    tr.insert(insertAt, editor.schema.nodes.visualBlock.create({ visualId }));
    editor.view.dispatch(tr);

    trackRef.current = visualId;
  }, [editor, getInsertPosition]);

  // Helper: remove the hover preview block from the editor
  const removeHoverPreview = useCallback(() => {
    if (!editor || hoverInsertedVisualId.current === null) return;
    const hoverVisualId = hoverInsertedVisualId.current;
    hoverInsertedVisualId.current = null;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "visualBlock" && node.attrs.visualId === hoverVisualId) {
        const tr = editor.state.tr;
        tr.delete(pos, pos + node.nodeSize);
        editor.view.dispatch(tr);
        return false;
      }
    });
  }, [editor]);

  // Click = permanent insert (always appends, never replaces) and close panel
  const handleCardClick = useCallback((gen: GeneratedTemplate) => {
    if (!editor || !gen.visual || inserting) return;
    setInserting(gen.templateId);
    try {
      // Remove hover preview — the click will do a fresh permanent insert
      removeHoverPreview();

      // Always insert as a new visual block (append after existing visuals)
      const insertAt = getInsertPosition() ?? editor.state.doc.content.size - 1;
      editor
        .chain()
        .focus()
        .setTextSelection(insertAt)
        .insertContent({ type: "visualBlock", attrs: { visualId: gen.visual.id } })
        .run();
    } finally {
      setInserting(null);
      // Close the panel after inserting
      onClose();
    }
  }, [editor, inserting, removeHoverPreview, getInsertPosition, onClose]);

  // Hover = temporary preview (insert on enter, replace on change, remove on leave)
  const handleCardHover = useCallback((gen: GeneratedTemplate | null) => {
    if (!editor) return;
    if (!gen || !gen.visual) {
      // Mouse left — remove hover preview
      removeHoverPreview();
      setHoveredTemplate(null);
      return;
    }
    setHoveredTemplate(gen.templateId);
    // Always use hover ref — never touch permanent visuals
    insertOrReplaceHoverVisual(gen.visual.id, hoverInsertedVisualId);
  }, [editor, insertOrReplaceHoverVisual, removeHoverPreview]);

  // Generate a data chart from selected text
  const handleDataChartGenerate = useCallback(async (chartType: DataChartType) => {
    if (!editor || dataChartGenerating) return;
    setDataChartGenerating(chartType);

    try {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, " ");
      const fullText = editor.state.doc.textContent;
      const sourceText = selectedText.length >= 20 ? selectedText : fullText;

      if (sourceText.length < 10) return;

      const $to = editor.state.doc.resolve(to);
      const afterBlock = $to.after($to.depth > 0 ? 1 : $to.depth);

      const res = await authFetch(`/api/documents/${documentId}/visuals/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText, visualType: chartType }),
      });

      if (res.ok) {
        const visual = await res.json();
        editor
          .chain()
          .focus()
          .setTextSelection(afterBlock)
          .insertContent({ type: "visualBlock", attrs: { visualId: visual.id } })
          .run();
        onClose();
      }
    } finally {
      setDataChartGenerating(null);
    }
  }, [editor, dataChartGenerating, authFetch, documentId, onClose]);

  const filteredCategories = CATEGORIES.filter((c) => {
    if (!c.active) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    if (c.label.toLowerCase().includes(q)) return true;
    // Also match sub-items: chart types under "data", direction labels under "mindmap"
    if (c.id === "data") return DATA_CHART_OPTIONS.some((opt) => opt.label.toLowerCase().includes(q));
    if (c.id === "mindmap") return MINDMAP_DIRECTIONS.some((dir) => dir.label.toLowerCase().includes(q));
    return false;
  });

  // Auto-expand a category when the search matches one of its sub-items (not the category name itself)
  const searchAutoExpand = (() => {
    if (!search) return null;
    const q = search.toLowerCase();
    for (const cat of filteredCategories) {
      if (cat.label.toLowerCase().includes(q)) continue; // matched by name, no need to force expand
      // matched by sub-item → auto-expand
      return cat.id;
    }
    return null;
  })();

  // Effective expanded state: manual selection OR search-driven auto-expand
  const isExpanded = (catId: string) => expandedCategory === catId || searchAutoExpand === catId;

  if (!open) return null;

  // Match generated templates with template definitions for display
  const activeTemplates = selectedDirection === "vertical" ? VERTICAL_MINDMAP_TEMPLATES
    : selectedDirection === "left" ? LEFT_MINDMAP_TEMPLATES
    : selectedDirection === "right" ? RIGHT_MINDMAP_TEMPLATES
    : HORIZONTAL_MINDMAP_TEMPLATES;
  const templateCards = activeTemplates.map((tmpl) => {
    const gen = generatedTemplates.find((g) => g.templateId === tmpl.id);
    return { template: tmpl, gen };
  });

  const filteredCards = search
    ? templateCards.filter(
        ({ template: t }) => t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
      )
    : templateCards;

  return (
    <div
      ref={panelRef}
      className="fixed z-[100] w-[340px] max-h-[80vh] flex flex-col rounded-xl border border-white/10 bg-[#1a1b2e]/95 backdrop-blur-xl shadow-2xl shadow-black/40"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header — draggable */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-move select-none border-b border-white/[0.06]"
        onMouseDown={onDragStart}
      >
        <h2 className="text-sm font-semibold text-white/90 tracking-wide">Categories</h2>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs text-white/80 placeholder:text-white/25 bg-white/[0.06] border border-white/[0.08] rounded-lg outline-none focus:border-white/20 transition-colors"
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {filteredCategories.map((cat) => (
          <div key={cat.id}>
            <button
              onClick={() => {
                if (!cat.active) {
                  setTooltip(cat.label);
                  setTimeout(() => setTooltip(null), 1500);
                  return;
                }
                setExpandedCategory(expandedCategory === cat.id ? "" : cat.id);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                cat.active
                  ? isExpanded(cat.id)
                    ? "bg-white/[0.08] text-white/90"
                    : "text-white/60 hover:text-white/80 hover:bg-white/[0.04]"
                  : "text-white/25 cursor-default"
              }`}
            >
              <span className="flex items-center gap-2">
                {cat.active && (
                  <svg
                    className={`h-3 w-3 transition-transform ${isExpanded(cat.id) ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
                {cat.label}
              </span>
              {!cat.active && <span className="text-[10px] text-white/20">Soon</span>}
              {tooltip === cat.label && <span className="text-[10px] text-amber-400/80 ml-1">Coming soon</span>}
            </button>

            {/* Data charts expanded content */}
            {cat.id === "data" && isExpanded("data") && (
              <div className="mt-1 ml-2 space-y-2">
                <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider px-1">
                  Select a chart type
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {DATA_CHART_OPTIONS
                    .filter((chart) => !searchAutoExpand || chart.label.toLowerCase().includes(search.toLowerCase()))
                    .map((chart) => {
                    const isGenerating = dataChartGenerating === chart.id;
                    const q = search?.toLowerCase() ?? "";
                    const matchIdx = q ? chart.label.toLowerCase().indexOf(q) : -1;
                    return (
                      <button
                        key={chart.id}
                        onClick={() => handleDataChartGenerate(chart.id)}
                        disabled={!!dataChartGenerating}
                        className={`group flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all ${
                          isGenerating
                            ? "bg-violet-500/20 ring-1 ring-violet-500/40"
                            : matchIdx >= 0
                              ? "bg-violet-500/10 ring-1 ring-violet-500/30 text-white/80"
                              : "hover:bg-white/[0.06] text-white/50 hover:text-white/80"
                        } ${dataChartGenerating && !isGenerating ? "opacity-40 cursor-not-allowed" : ""}`}
                        title={chart.label}
                      >
                        <span className={`${isGenerating ? "text-violet-400 animate-pulse" : ""}`}>
                          {isGenerating ? <LoadingSpinner size={4} /> : chart.icon}
                        </span>
                        <span className={`text-[8px] font-medium leading-tight text-center ${
                          isGenerating ? "text-violet-300" : ""
                        }`}>
                          {matchIdx >= 0 ? (
                            <>{chart.label.slice(0, matchIdx)}<span className="text-violet-300">{chart.label.slice(matchIdx, matchIdx + q.length)}</span>{chart.label.slice(matchIdx + q.length)}</>
                          ) : chart.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] text-white/25 px-1">
                  Select text in the editor, then click a chart type to generate.
                </p>
              </div>
            )}

            {/* Mindmap expanded content */}
            {cat.id === "mindmap" && isExpanded("mindmap") && (
              <div className="mt-1 ml-2 space-y-3">
                {/* Direction icons */}
                <div className="flex items-center gap-1.5 px-1">
                  {MINDMAP_DIRECTIONS
                    .filter((dir) => !searchAutoExpand || dir.label.toLowerCase().includes(search.toLowerCase()))
                    .map((dir) => {
                    const q = search?.toLowerCase() ?? "";
                    const matchIdx = q ? dir.label.toLowerCase().indexOf(q) : -1;
                    return (
                    <div key={dir.id} className="relative">
                      <button
                        onClick={() => {
                          if (!dir.available) {
                            setTooltip(dir.id);
                            setTimeout(() => setTooltip(null), 1500);
                            return;
                          }
                          handleDirectionSelect(dir.id);
                        }}
                        className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-colors ${
                          dir.available
                            ? selectedDirection === dir.id
                              ? "bg-violet-500/20 ring-1 ring-violet-500/40"
                              : matchIdx >= 0
                                ? "bg-violet-500/10 ring-1 ring-violet-500/30"
                                : "hover:bg-white/[0.06]"
                            : "opacity-40 cursor-default"
                        }`}
                        title={dir.available ? dir.label : `${dir.label} — Coming soon`}
                      >
                        <DirectionIcon dir={dir.id} active={selectedDirection === dir.id} />
                        <span className={`text-[9px] ${selectedDirection === dir.id ? "text-violet-300" : "text-white/40"}`}>
                          {matchIdx >= 0 ? (
                            <>{dir.label.slice(0, matchIdx)}<span className="text-violet-300">{dir.label.slice(matchIdx, matchIdx + q.length)}</span>{dir.label.slice(matchIdx + q.length)}</>
                          ) : dir.label}
                        </span>
                      </button>
                      {tooltip === dir.id && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/90 text-amber-400/80 text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-10">
                          Coming soon
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>

                {/* Template grid — shown when horizontal or vertical is selected */}
                {selectedDirection !== null && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                        Top picks for {selectedDirection === "vertical" ? "Vertical" : selectedDirection === "left" ? "Left" : selectedDirection === "right" ? "Right" : "Horizontal"} mindmaps
                      </p>
                      <button
                        onClick={() => generateAllTemplates(true, selectedDirection)}
                        disabled={generatedTemplates.some((g) => g.loading)}
                        title="Refresh — regenerate all templates"
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <svg
                          className={`h-3 w-3 ${generatedTemplates.some((g) => g.loading) ? "animate-spin" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {filteredCards.map(({ template, gen }) => {
                        const isLoading = gen?.loading ?? false;
                        const isReady = !!gen?.visual;
                        const isError = gen?.error ?? false;
                        const isActive = inserting === template.id;

                        return (
                          <button
                            key={template.id}
                            onClick={() => gen && isReady ? handleCardClick(gen) : undefined}
                            onMouseEnter={() => gen && isReady ? handleCardHover(gen) : undefined}
                            onMouseLeave={() => handleCardHover(null)}
                            disabled={!isReady || !!inserting}
                            className={`group relative flex flex-col rounded-lg border transition-all ${
                              isActive
                                ? "border-violet-500/60 bg-violet-500/15 ring-1 ring-violet-500/30"
                                : isReady
                                  ? "border-white/[0.08] bg-white/[0.03] hover:border-violet-400/40 hover:bg-white/[0.06] cursor-pointer"
                                  : isError
                                    ? "border-red-500/20 bg-red-500/5"
                                    : "border-white/[0.06] bg-white/[0.02]"
                            }`}
                          >
                            {/* Thumbnail area */}
                            <div className="aspect-[3/2] w-full p-1.5 flex items-center justify-center">
                              {isLoading ? (
                                <div className="flex flex-col items-center gap-1">
                                  <LoadingSpinner />
                                  <span className="text-[8px] text-white/30">Generating...</span>
                                </div>
                              ) : isError ? (
                                <span className="text-[9px] text-red-400/60">Failed</span>
                              ) : selectedDirection === "vertical" ? (
                                <VerticalMindmapThumbnail
                                  structure={template.structure}
                                  className={`transition-opacity ${isReady ? "opacity-80 group-hover:opacity-100" : "opacity-40"}`}
                                />
                              ) : selectedDirection === "left" ? (
                                <LeftMindmapThumbnail
                                  structure={template.structure}
                                  className={`transition-opacity ${isReady ? "opacity-80 group-hover:opacity-100" : "opacity-40"}`}
                                />
                              ) : selectedDirection === "right" ? (
                                <RightMindmapThumbnail
                                  structure={template.structure}
                                  className={`transition-opacity ${isReady ? "opacity-80 group-hover:opacity-100" : "opacity-40"}`}
                                />
                              ) : (
                                <HorizontalMindmapThumbnail
                                  structure={template.structure}
                                  className={`transition-opacity ${isReady ? "opacity-80 group-hover:opacity-100" : "opacity-40"}`}
                                />
                              )}
                            </div>
                            {/* Label + ready indicator */}
                            <div className="px-2 pb-1.5 flex items-center justify-between">
                              <p className={`text-[10px] font-medium truncate ${
                                isReady ? "text-white/70 group-hover:text-white/90" : "text-white/30"
                              }`}>
                                {template.name}
                              </p>
                              {isReady && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              )}
                              {isLoading && (
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
