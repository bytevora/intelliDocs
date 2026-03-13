"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

interface WidgetTextToolbarProps {
  containerRef: React.RefObject<HTMLElement | null>;
}

function queryState(cmd: string): boolean {
  try {
    return document.queryCommandState(cmd);
  } catch {
    return false;
  }
}

const FONT_SIZES = [
  { label: "10", value: "10px" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "24", value: "24px" },
  { label: "28", value: "28px" },
  { label: "32", value: "32px" },
];

function getCurrentFontSize(): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const node = sel.anchorNode;
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  if (!el) return "";
  const computed = window.getComputedStyle(el as Element).fontSize;
  return computed ? parseInt(computed, 10) + "px" : "";
}

function applyFontSize(size: string) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

  const anchor = sel.anchorNode;
  const anchorEl = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element);
  const editableRoot = anchorEl?.closest?.("[contenteditable]");
  if (!editableRoot) return;

  document.execCommand("fontSize", false, "7");

  const fonts = editableRoot.querySelectorAll('font[size="7"]');
  for (const font of Array.from(fonts)) {
    font.removeAttribute("size");
    (font as HTMLElement).style.fontSize = size;
  }
}

/** Get the branch/node color from the nearest contentEditable's CSS custom property */
function getSelectionColor(container: HTMLElement): { bg: string; color: string } {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { bg: "rgba(99, 102, 241, 0.35)", color: "#ffffff" };
  }
  const node = sel.anchorNode;
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  if (!el || !container.contains(el as Node)) {
    return { bg: "rgba(99, 102, 241, 0.35)", color: "#ffffff" };
  }
  const editable = (el as HTMLElement).closest?.("[contenteditable]") as HTMLElement | null;
  if (editable) {
    const bg = editable.style.getPropertyValue("--sel-bg");
    const c = editable.style.getPropertyValue("--sel-color");
    if (bg) return { bg, color: c || "#ffffff" };
  }
  return { bg: "rgba(99, 102, 241, 0.35)", color: "#ffffff" };
}

/** Collect all bounding client rects from a Range (one per line of selected text) */
function getSelectionRects(): DOMRect[] {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return [];
  const range = sel.getRangeAt(0);
  const rects = range.getClientRects();
  // Filter out zero-size rects
  return Array.from(rects).filter((r) => r.width > 0 && r.height > 0);
}

export function WidgetTextToolbar({ containerRef }: WidgetTextToolbarProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [strikethrough, setStrikethrough] = useState(false);
  const [currentSize, setCurrentSize] = useState("");
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [highlightRects, setHighlightRects] = useState<{ rects: DOMRect[]; bg: string }>({ rects: [], bg: "" });
  const toolbarRef = useRef<HTMLDivElement>(null);
  const lockedOpen = useRef(false);

  const updateFormattingState = useCallback(() => {
    setBold(queryState("bold"));
    setItalic(queryState("italic"));
    setUnderline(queryState("underline"));
    setStrikethrough(queryState("strikeThrough"));
    setCurrentSize(getCurrentFontSize());
  }, []);

  const updateHighlight = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rects = getSelectionRects();
    const { bg } = getSelectionColor(container);
    setHighlightRects({ rects, bg });
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleSelectionChange = () => {
      if (lockedOpen.current) {
        // Still update highlight rects even when locked (formatting may change selection shape)
        updateHighlight();
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setShow(false);
        setShowSizeMenu(false);
        setHighlightRects({ rects: [], bg: "" });
        return;
      }

      const range = sel.getRangeAt(0);
      const ancestor = range.commonAncestorContainer;
      const node = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : ancestor as Element;
      if (!node || !container.contains(node)) {
        setShow(false);
        setShowSizeMenu(false);
        setHighlightRects({ rects: [], bg: "" });
        return;
      }

      const editableParent = (node as HTMLElement).closest?.("[contenteditable]");
      if (!editableParent) {
        setShow(false);
        setShowSizeMenu(false);
        setHighlightRects({ rects: [], bg: "" });
        return;
      }

      const rect = range.getBoundingClientRect();
      setPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
      updateFormattingState();
      updateHighlight();
      setShow(true);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [containerRef, updateFormattingState, updateHighlight]);

  useEffect(() => {
    if (!show) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) return;
      lockedOpen.current = false;
      setShow(false);
      setShowSizeMenu(false);
      setHighlightRects({ rects: [], bg: "" });
    };

    const id = setTimeout(() => {
      document.addEventListener("mousedown", handleMouseDown);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [show]);

  const exec = useCallback((cmd: string) => {
    lockedOpen.current = true;
    document.execCommand(cmd, false);
    updateFormattingState();
    updateHighlight();
  }, [updateFormattingState, updateHighlight]);

  const handleFontSize = useCallback((size: string) => {
    lockedOpen.current = true;
    applyFontSize(size);
    setCurrentSize(size);
    setShowSizeMenu(false);
    updateFormattingState();
    updateHighlight();
  }, [updateFormattingState, updateHighlight]);

  if (!show) return null;

  const sizeLabel = currentSize ? parseInt(currentSize, 10).toString() : "—";

  return createPortal(
    <>
      {/* Selection highlight overlays — visible colored rects behind the selected text */}
      {highlightRects.rects.map((r, i) => (
        <div
          key={i}
          className="fixed pointer-events-none z-[9990] rounded-sm"
          style={{
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            backgroundColor: highlightRects.bg,
            mixBlendMode: "multiply",
          }}
        />
      ))}

      {/* Toolbar */}
      <div
        ref={toolbarRef}
        className="fixed z-[9999] flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-xl"
        style={{
          left: pos.x,
          top: pos.y,
          transform: "translate(-50%, -100%)",
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <ToolbarBtn
          label="B"
          title="Bold"
          active={bold}
          className="font-bold"
          onClick={() => exec("bold")}
        />
        <ToolbarBtn
          label="I"
          title="Italic"
          active={italic}
          className="italic"
          onClick={() => exec("italic")}
        />
        <ToolbarBtn
          label="U"
          title="Underline"
          active={underline}
          className="underline"
          onClick={() => exec("underline")}
        />
        <ToolbarBtn
          label="S"
          title="Strikethrough"
          active={strikethrough}
          className="line-through"
          onClick={() => exec("strikeThrough")}
        />

        <div className="mx-0.5 h-5 w-px bg-border" />

        {/* Font size dropdown */}
        <div className="relative">
          <button
            type="button"
            title="Font size"
            onClick={() => setShowSizeMenu(!showSizeMenu)}
            className="h-7 min-w-[36px] px-1.5 flex items-center justify-center gap-0.5 rounded text-[11px] font-medium text-foreground hover:bg-accent transition-colors"
          >
            {sizeLabel}
            <svg className="h-2.5 w-2.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showSizeMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-20 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-xl py-0.5">
              {FONT_SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => handleFontSize(s.value)}
                  className={`w-full px-3 py-1 text-left text-[11px] transition-colors hover:bg-accent ${
                    currentSize === s.value ? "bg-accent font-semibold text-primary" : "text-foreground"
                  }`}
                >
                  {s.label}px
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Decrease / Increase font size quick buttons */}
        <ToolbarBtn
          label={
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          }
          title="Decrease font size"
          active={false}
          onClick={() => {
            const cur = parseInt(currentSize, 10) || 16;
            const next = Math.max(8, cur - 2);
            handleFontSize(next + "px");
          }}
        />
        <ToolbarBtn
          label={
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          }
          title="Increase font size"
          active={false}
          onClick={() => {
            const cur = parseInt(currentSize, 10) || 16;
            const next = Math.min(48, cur + 2);
            handleFontSize(next + "px");
          }}
        />
      </div>
    </>,
    document.body
  );
}

function ToolbarBtn({
  label,
  title,
  active,
  className,
  onClick,
}: {
  label: React.ReactNode;
  title: string;
  active: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-7 w-7 flex items-center justify-center rounded text-xs transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-accent"
      } ${className ?? ""}`}
    >
      {label}
    </button>
  );
}
