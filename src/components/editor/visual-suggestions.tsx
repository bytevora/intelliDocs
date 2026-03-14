"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Editor } from "@tiptap/react";
import { useDocument } from "./document-context";
import { VisualType } from "@/types";

/** Debounce delay (ms) before analyzing the current paragraph for suggestions */
const SUGGEST_DEBOUNCE_MS = 1500;

// Pattern detection for suggesting visual types
const PATTERNS: { type: VisualType; keywords: RegExp; label: string; icon: string }[] = [
  {
    type: "comparison",
    keywords: /\b(vs\.?|versus|compare|comparison|differ|advantage|disadvantage|pros?\b.*cons?|better|worse)\b/i,
    label: "Comparison",
    icon: "columns",
  },
  {
    type: "funnel",
    keywords: /\b(funnel|pipeline|conversion|stage|phase|filter|narrow|lead|prospect|customer journey)\b/i,
    label: "Funnel",
    icon: "filter",
  },
  {
    type: "stats",
    keywords: /\b(\d+%|\$[\d,.]+|revenue|growth|metric|kpi|performance|increase|decrease|rate|ratio)\b/i,
    label: "Stats Dashboard",
    icon: "bar-chart",
  },
  {
    type: "swot",
    keywords: /\b(swot|strength|weakness|opportunit|threat|strategic|analysis|assessment)\b/i,
    label: "SWOT Analysis",
    icon: "grid",
  },
  {
    type: "orgchart",
    keywords: /\b(team|report|manager|ceo|cto|hierarchy|organization|department|director|head of)\b/i,
    label: "Org Chart",
    icon: "users",
  },
  {
    type: "venn",
    keywords: /\b(overlap|shared|common|intersect|both|mutual|venn|union|differ.*similar)\b/i,
    label: "Venn Diagram",
    icon: "circle",
  },
  {
    type: "donut",
    keywords: /\b(percent|proportion|distribution|share|breakdown|allocation|split|ratio|portion)\b/i,
    label: "Donut Chart",
    icon: "pie-chart",
  },
  {
    type: "bar",
    keywords: /\b(chart|rank|top\s+\d|bar\s+chart|column|quantity|amount|count|total|score|rating)\b/i,
    label: "Bar Chart",
    icon: "bar-chart-2",
  },
  {
    type: "line",
    keywords: /\b(trend|growth|over\s+time|monthly|weekly|daily|yearly|quarter|forecast|projection)\b/i,
    label: "Line Chart",
    icon: "trending-up",
  },
  {
    type: "radar",
    keywords: /\b(radar|spider|multi.*dimension|skill|proficiency|capability|assessment|evaluation)\b/i,
    label: "Radar Chart",
    icon: "target",
  },
  {
    type: "scatter",
    keywords: /\b(scatter|correlation|relationship|plot|regression|xy|versus.*data)\b/i,
    label: "Scatter Plot",
    icon: "scatter-chart",
  },
  {
    type: "heatmap",
    keywords: /\b(heatmap|heat\s+map|matrix|intensity|schedule|availability|grid.*data)\b/i,
    label: "Heatmap",
    icon: "grid",
  },
  {
    type: "sankey",
    keywords: /\b(sankey|flow|alluvial|transfer|journey|source.*target|allocation.*flow)\b/i,
    label: "Sankey Flow",
    icon: "git-merge",
  },
];

interface VisualSuggestionsProps {
  editor: Editor;
}

export function VisualSuggestions({ editor }: VisualSuggestionsProps) {
  const { documentId, authFetch } = useDocument();
  const [suggestion, setSuggestion] = useState<{
    type: VisualType;
    label: string;
    text: string;
    paragraphPos: { from: number; to: number };
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  const analyzeParagraph = useCallback(() => {
    if (!editor || editor.isDestroyed || !editor.state) return;

    const { $from } = editor.state.selection;
    // Get the current paragraph/block
    const start = $from.start();
    const end = $from.end();
    const text = editor.state.doc.textBetween(start, end, " ");

    // Need at least 50 chars for a meaningful suggestion
    if (text.length < 50) {
      setSuggestion(null);
      return;
    }

    // Check if this paragraph was already dismissed
    const paragraphKey = text.slice(0, 60);
    if (dismissed.has(paragraphKey)) {
      setSuggestion(null);
      return;
    }

    // Find matching pattern
    for (const pattern of PATTERNS) {
      if (pattern.keywords.test(text)) {
        setSuggestion({
          type: pattern.type,
          label: pattern.label,
          text,
          paragraphPos: { from: start, to: end },
        });
        return;
      }
    }

    setSuggestion(null);
  }, [editor, dismissed]);

  useEffect(() => {
    const handleUpdate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(analyzeParagraph, SUGGEST_DEBOUNCE_MS);
    };

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editor, analyzeParagraph]);

  const handleGenerate = async () => {
    if (!suggestion) return;
    setGenerating(true);

    try {
      const res = await authFetch(`/api/documents/${documentId}/visuals/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText: suggestion.text,
          visualType: suggestion.type,
        }),
      });

      if (!res.ok) {
        console.error(`Failed to generate visual (${res.status}): ${res.statusText}`);
        return;
      }

      const visual = await res.json();

      editor
        .chain()
        .focus()
        .setTextSelection(suggestion.paragraphPos.to)
        .insertContent({
          type: "visualBlock",
          attrs: { visualId: visual.id },
        })
        .run();

      // Dismiss this paragraph
      setDismissed((prev) => new Set(prev).add(suggestion.text.slice(0, 60)));
      setSuggestion(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleDismiss = () => {
    if (suggestion) {
      setDismissed((prev) => new Set(prev).add(suggestion.text.slice(0, 60)));
    }
    setSuggestion(null);
  };

  if (!suggestion || generating) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 rounded-xl border bg-background/95 backdrop-blur-sm px-4 py-3 shadow-lg max-w-sm">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Visual suggestion</p>
          <p className="text-sm font-medium truncate">
            Generate a <span className="text-primary">{suggestion.label}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Generate
          </button>
          <button
            onClick={handleDismiss}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
            title="Dismiss"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
