"use client";

import { useState, useEffect, useCallback } from "react";
import { Editor } from "@tiptap/react";

interface GenerateVisualMenuProps {
  editor: Editor;
  onOpenPanel: () => void;
}

export function GenerateVisualMenu({ editor, onOpenPanel }: GenerateVisualMenuProps) {
  const [visible, setVisible] = useState(false);
  const [buttonTop, setButtonTop] = useState(0);

  const updatePosition = useCallback(() => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ");

    if (text.length < 20) {
      setVisible(false);
      return;
    }

    const startCoords = editor.view.coordsAtPos(from);
    const endCoords = editor.view.coordsAtPos(to);
    const midY = (startCoords.top + endCoords.bottom) / 2;

    const editorRect = editor.view.dom.getBoundingClientRect();

    setButtonTop(midY - editorRect.top - 20);
    setVisible(true);
  }, [editor]);

  useEffect(() => {
    editor.on("selectionUpdate", updatePosition);

    const handleBlur = () => {
      setTimeout(() => setVisible(false), 200);
    };
    editor.on("blur", handleBlur);

    return () => {
      editor.off("selectionUpdate", updatePosition);
      editor.off("blur", handleBlur);
    };
  }, [editor, updatePosition]);

  return (
    <div
      className="absolute z-20 transition-opacity duration-200 ease-in-out"
      style={{
        top: buttonTop,
        left: "calc(-1.5rem - 0.75rem - 40px)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          onOpenPanel();
        }}
        className="h-10 w-10 rounded-full bg-[#4a9eed] hover:bg-[#3a8edd] text-white shadow-lg shadow-[#4a9eed]/30 flex items-center justify-center transition-transform duration-150 hover:scale-110 active:scale-95"
        title="Generate visual from selection"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
        </svg>
      </button>
    </div>
  );
}
