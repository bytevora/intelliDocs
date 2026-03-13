import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  VisualType,
  RenderMode,
  ALL_VISUAL_TYPES,
  MindmapNode,
} from "@/types";

const GEMINI_MODEL = "gemini-2.0-flash";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/** Safely extract JSON from a Gemini response that may contain prose or markdown fences */
export function extractJSON(raw: string): unknown {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    throw new Error("Empty response from Gemini");
  }
  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch {
    // ignore
  }
  // Try extracting from markdown code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // ignore
    }
  }
  // Try finding first { ... } or [ ... ] block
  const braceMatch = trimmed.match(/(\{[\s\S]*\})/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[1]);
    } catch {
      // ignore
    }
  }
  throw new Error(`Could not extract valid JSON from Gemini response: ${trimmed.slice(0, 200)}`);
}

// ── Unified visual generation prompt ─────────────────────

const VISUAL_SYSTEM_PROMPT = `You are a text-to-visualization expert. Given text, generate the best visual representation.

You must output ONLY valid JSON in this format:
{"visualType": "<type>", "customData": {<structured data matching the schema below>}}

═══════════════════════════════════════
MINDMAP
═══════════════════════════════════════

1. "mindmap" — Hierarchical concepts, brainstorming, topic exploration, knowledge maps
customData schema:
{
  "title": "Main Topic",
  "root": {
    "label": "Central Idea",
    "children": [
      {
        "label": "Branch 1",
        "children": [
          { "label": "Sub-topic A" },
          { "label": "Sub-topic B" }
        ]
      }
    ]
  }
}
Rules: 3-6 main branches, 1-4 sub-topics each. Max 3 levels deep. Labels under 30 characters.

═══════════════════════════════════════
DATA CHART TYPES
═══════════════════════════════════════

2. "bar" — Numerical data across categories, rankings, quantities (bar/column charts)
customData schema:
{
  "title": "Chart Title",
  "layout": "vertical",
  "keys": ["value1", "value2"],
  "indexBy": "category",
  "data": [
    { "category": "A", "value1": 10, "value2": 20 },
    { "category": "B", "value1": 15, "value2": 25 }
  ]
}
layout: "vertical", "horizontal", "grouped", or "stacked". Use "grouped" for comparing, "stacked" for part-of-whole, "horizontal" when labels are long. Single series = one key, multi-series = multiple keys.

3. "line" — Trends over time, growth, progression (line charts)
customData schema:
{
  "title": "Chart Title",
  "series": [
    {
      "id": "Series A",
      "data": [
        { "x": "Jan", "y": 10 },
        { "x": "Feb", "y": 20 }
      ]
    }
  ]
}

4. "area" — Cumulative trends, volume over time (filled area charts)
customData schema:
{
  "title": "Chart Title",
  "series": [
    {
      "id": "Series A",
      "data": [
        { "x": "Jan", "y": 10 },
        { "x": "Feb", "y": 20 }
      ]
    }
  ]
}

5. "donut" — Proportions of a whole, percentage breakdowns (donut/pie charts)
customData schema:
{
  "title": "Chart Title",
  "variant": "full",
  "data": [
    { "id": "slice1", "label": "Category A", "value": 30 },
    { "id": "slice2", "label": "Category B", "value": 70 }
  ]
}
variant: "full" (360°) or "half" (180° semicircle gauge).

6. "radar" — Multi-dimensional comparison across axes (spider/radar charts, 3-8 axes)
customData schema:
{
  "title": "Chart Title",
  "keys": ["Product A", "Product B"],
  "indexBy": "metric",
  "data": [
    { "metric": "Speed", "Product A": 80, "Product B": 60 },
    { "metric": "Quality", "Product A": 70, "Product B": 90 }
  ]
}

7. "scatter" — Correlation between two variables, distribution patterns
customData schema:
{
  "title": "Chart Title",
  "series": [
    {
      "id": "Group A",
      "data": [
        { "x": 10, "y": 20 },
        { "x": 30, "y": 40 }
      ]
    }
  ]
}

8. "heatmap" — Matrix data, schedules, intensity across two dimensions
customData schema:
{
  "title": "Chart Title",
  "data": [
    {
      "id": "Row A",
      "data": [
        { "x": "Col 1", "y": 10 },
        { "x": "Col 2", "y": 20 }
      ]
    }
  ]
}

9. "sankey" — Flow between categories, resource allocation, user journeys
customData schema:
{
  "title": "Chart Title",
  "nodes": [
    { "id": "Source A" },
    { "id": "Target B" }
  ],
  "links": [
    { "source": "Source A", "target": "Target B", "value": 100 }
  ]
}
IMPORTANT: Every node id in links must exist in nodes array. source and target must be different.

═══════════════════════════════════════
GENERAL RULES
═══════════════════════════════════════

1. If the user specifies a visual type, use that type. Otherwise, choose the type that MOST naturally represents the information.
2. Only use the visual types listed above — do not use any other type.
3. Extract key information from the text — be concise but comprehensive.
4. Keep titles concise (under 50 characters) and labels short (under 40 characters).
5. Use 3-8 data points for charts, 3-6 branches for mindmaps.
6. Extract REAL numerical data from text. If exact numbers aren't given, INVENT plausible representative numbers — NEVER refuse or say you cannot generate the chart. You MUST always output valid JSON.
7. Ensure all numeric values in data charts are actual numbers (not strings).
8. Even if the text has no obvious numerical data, derive categories and generate reasonable placeholder values. Every request MUST produce a valid JSON visualization — no exceptions, no apologies, no explanations.`;

// ── Template-aware mindmap generation ────────────────────

const TEMPLATE_MINDMAP_PROMPT = `You are a text-to-mindmap expert. You are given a piece of text AND a mindmap template structure (as JSON).

Your task: Fill in the template structure with real content derived from the source text. Keep the EXACT same tree shape (same number of branches, same depth at each branch) but replace all placeholder labels with meaningful content extracted from the text.

Rules:
1. Output ONLY valid JSON matching the MindmapData schema: {"title": "...", "root": { "label": "...", "children": [...] }}
2. Preserve the exact tree structure — same number of children at every level
3. Replace placeholder labels ("Topic", "Branch 1", "Sub-topic A", etc.) with real content from the text
4. Keep labels concise — under 30 characters each
5. The root label should be the central theme/topic
6. Branch labels should be key themes or categories
7. Leaf labels should be specific details or sub-points`;

// ── Types ────────────────────────────────────────────────

interface GenerateResult {
  visualType: VisualType;
  renderMode: RenderMode;
  mermaidSyntax: string;
  customData: string | null;
}

// ── Core generation ──────────────────────────────────────

async function generateFromPrompt(
  sourceText: string,
  visualType?: VisualType
): Promise<GenerateResult> {
  const userPrompt = visualType
    ? `Generate a "${visualType}" visualization from the following text:\n\n${sourceText}`
    : `Analyze the following text and generate the most suitable visualization:\n\n${sourceText}`;

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    tools: [{ googleSearch: {} } as any],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2000,
    },
    systemInstruction: VISUAL_SYSTEM_PROMPT,
  });

  const result = await model.generateContent(userPrompt);
  const content = result.response.text();

  if (!content) throw new Error("No response from Gemini");

  const parsed = extractJSON(content) as Record<string, unknown>;

  if (!parsed.visualType || !(ALL_VISUAL_TYPES as string[]).includes(parsed.visualType as string)) {
    throw new Error(`Invalid visual type in Gemini response: ${parsed.visualType}`);
  }

  const type = parsed.visualType as VisualType;

  if (!parsed.customData) {
    throw new Error("Missing customData in Gemini response for custom type");
  }

  return {
    visualType: type,
    renderMode: "custom",
    mermaidSyntax: "",
    customData: JSON.stringify(parsed.customData),
  };
}

// ── Public API ───────────────────────────────────────────

export async function generateVisual(
  sourceText: string,
  visualType?: VisualType
): Promise<GenerateResult> {
  return generateFromPrompt(sourceText, visualType);
}

export async function generateMindmapForTemplate(
  sourceText: string,
  templateStructure: MindmapNode,
  layout: "horizontal" | "vertical" | "left" | "right" = "horizontal"
): Promise<GenerateResult> {
  const userPrompt = `Source text:\n${sourceText}\n\nTemplate structure (keep this exact shape, replace labels with real content):\n${JSON.stringify(templateStructure, null, 2)}`;

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2000,
      responseMimeType: "application/json",
    },
    systemInstruction: TEMPLATE_MINDMAP_PROMPT,
  });

  const result = await model.generateContent(userPrompt);
  const content = result.response.text();

  if (!content) throw new Error("No response from Gemini");

  const parsed = extractJSON(content) as Record<string, unknown>;

  // Gemini may return either:
  // 1. { title, root: { label, children } }  — wrapped format
  // 2. { label, children }                    — the root node directly
  // 3. { title, label, children }             — hybrid
  let root: MindmapNode;
  let title = "Mindmap";

  if (parsed.root && typeof parsed.root === "object") {
    root = parsed.root as MindmapNode;
    title = (parsed.title as string) || title;
  } else if (parsed.label && typeof parsed.label === "string") {
    // Response IS the root node itself
    root = parsed as unknown as MindmapNode;
    title = (parsed.title as string) || (parsed.label as string) || title;
  } else {
    throw new Error("Invalid template mindmap response — missing root and label");
  }

  const mindmapData = {
    title,
    root,
    layout,
  };

  return {
    visualType: "mindmap",
    renderMode: "custom",
    mermaidSyntax: "",
    customData: JSON.stringify(mindmapData),
  };
}
