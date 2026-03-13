"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { VisualTheme } from "@/types";

interface MermaidRendererProps {
  syntax: string;
  theme: VisualTheme;
}

const THEME_MAP: Record<VisualTheme, "default" | "forest" | "dark" | "neutral"> = {
  default: "default",
  forest: "forest",
  dark: "dark",
  neutral: "neutral",
  ocean: "default",
  sunset: "neutral",
  monochrome: "neutral",
};

let mermaidId = 0;

/** Clean up common Mermaid syntax issues from AI-generated output */
function sanitizeMermaidSyntax(raw: string): string {
  let s = raw.trim();
  // Strip markdown code fences if present
  s = s.replace(/^```(?:mermaid)?\s*\n?/i, "").replace(/\n?```\s*$/, "");
  return s.trim();
}

export function MermaidRenderer({ syntax, theme }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function render() {
      if (!containerRef.current) return;
      setError(null);

      mermaid.initialize({
        startOnLoad: false,
        theme: THEME_MAP[theme],
        securityLevel: "loose",
      });

      const id = `mermaid-${++mermaidId}`;
      const cleaned = sanitizeMermaidSyntax(syntax);

      try {
        const { svg } = await mermaid.render(id, cleaned);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to render diagram");
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }
      }
    }

    render();
  }, [syntax, theme]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-2">
        <p className="text-sm font-medium text-destructive">Diagram render error</p>
        <pre className="text-xs text-muted-foreground overflow-auto whitespace-pre-wrap">
          {syntax}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center [&>svg]:max-w-full"
    />
  );
}
