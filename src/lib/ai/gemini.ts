import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  VisualType,
  RenderMode,
  MERMAID_TYPES,
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

You must output ONLY valid JSON. The output format depends on the visual type chosen:

For MERMAID types (flowchart, timeline, sequence, pie), output:
{"visualType": "<type>", "mermaidSyntax": "<valid Mermaid.js syntax string>"}

For ALL OTHER types, output:
{"visualType": "<type>", "customData": {<structured data matching the schema below>}}

═══════════════════════════════════════
MERMAID TYPES
═══════════════════════════════════════

1. "flowchart" — Process flows, decision trees, algorithms, step-by-step procedures
   mermaidSyntax: "flowchart TD\\n  A[Start] --> B{Decision}\\n  B -->|Yes| C[Action 1]\\n  B -->|No| D[Action 2]"
   Use "flowchart TD" (top-down) or "flowchart LR" (left-right). Max 15 nodes.

2. "timeline" — Chronological events, milestones, history, project phases
   mermaidSyntax: "timeline\\n  title Title\\n  section Phase\\n    Event 1 : Detail"
   IMPORTANT: NEVER use colons inside event names or time values (write "9.15am" NOT "9:15am"). Each section must have at least one event. Indent events with 4 spaces.

3. "sequence" — Interactions between entities, API calls, message flows
   mermaidSyntax: "sequenceDiagram\\n  Alice->>Bob: Hello\\n  Bob-->>Alice: Hi"

4. "pie" — Simple proportions, distributions, market share, budget breakdown
   mermaidSyntax: "pie title Title\\n  \\"Slice A\\" : 30\\n  \\"Slice B\\" : 70"

Mermaid rules:
- Do NOT wrap mermaid syntax in code fences or backticks
- Avoid special characters (colons, semicolons, quotes, brackets) inside labels — they break Mermaid parsing. Replace with safe alternatives.
- Keep diagrams clear and concise with descriptive but short labels

═══════════════════════════════════════
CUSTOM INFOGRAPHIC TYPES
═══════════════════════════════════════

5. "mindmap" — Hierarchical concepts, brainstorming, topic exploration, knowledge maps
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

6. "comparison" — Side-by-side comparison of products, options, technologies (2-4 items)
customData schema:
{
  "title": "Title",
  "items": [
    { "name": "Item A", "points": ["Point 1", "Point 2", "Point 3"], "color": "#3b82f6" },
    { "name": "Item B", "points": ["Point 1", "Point 2", "Point 3"], "color": "#ef4444" }
  ]
}
Colors: use from #3b82f6, #ef4444, #10b981, #f59e0b, #8b5cf6, #ec4899.

7. "funnel" — Sales funnels, conversion pipelines, filtering processes
customData schema:
{
  "title": "Title",
  "stages": [
    { "label": "Stage 1", "value": "1000", "percentage": 100 },
    { "label": "Stage 2", "value": "750", "percentage": 75 },
    { "label": "Stage 3", "value": "300", "percentage": 30 }
  ]
}
Percentages should decrease from top to bottom.

8. "stats" — Key metrics, KPIs, statistics, performance numbers (3-6 metrics)
customData schema:
{
  "title": "Title",
  "metrics": [
    { "label": "Metric", "value": "42%", "change": "+5%", "trend": "up" },
    { "label": "Metric 2", "value": "$1.2M", "change": "-2%", "trend": "down" }
  ]
}
Trend: "up", "down", or "neutral". Determine from context.

9. "swot" — SWOT analysis, strategic assessment, pros/cons evaluation
customData schema:
{
  "title": "Title",
  "strengths": ["Point 1", "Point 2"],
  "weaknesses": ["Point 1", "Point 2"],
  "opportunities": ["Point 1", "Point 2"],
  "threats": ["Point 1", "Point 2"]
}
Provide 2-5 items per quadrant.

10. "orgchart" — Organizational hierarchies, team structures, taxonomies
customData schema:
{
  "title": "Title",
  "root": {
    "name": "CEO",
    "role": "Chief Executive",
    "children": [
      { "name": "CTO", "role": "Technology", "children": [] },
      { "name": "CFO", "role": "Finance", "children": [] }
    ]
  }
}
Max 3 levels deep.

11. "venn" — Overlapping concepts, shared characteristics, set relationships (2-3 sets)
customData schema:
{
  "title": "Title",
  "sets": [
    { "label": "Set A", "items": ["Item 1", "Item 2"] },
    { "label": "Set B", "items": ["Item 3", "Item 4"] }
  ],
  "intersections": [
    { "sets": [0, 1], "items": ["Shared item"] }
  ]
}

═══════════════════════════════════════
DATA CHART TYPES
═══════════════════════════════════════

12. "bar" — Numerical data across categories, rankings, quantities (bar/column charts)
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

13. "line" — Trends over time, growth, progression (line charts)
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

14. "area" — Cumulative trends, volume over time (filled area charts)
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

15. "donut" — Proportions of a whole, percentage breakdowns (donut/pie charts)
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

16. "radar" — Multi-dimensional comparison across axes (spider/radar charts, 3-8 axes)
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

17. "scatter" — Correlation between two variables, distribution patterns
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

18. "heatmap" — Matrix data, schedules, intensity across two dimensions
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

19. "sankey" — Flow between categories, resource allocation, user journeys
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
2. Extract key information from the text — be concise but comprehensive.
3. Keep titles concise (under 50 characters) and labels short (under 40 characters).
4. Use 3-8 data points for charts, 2-6 items for infographics.
5. Extract REAL numerical data from text. If exact numbers aren't given, make reasonable estimates.
6. Ensure all numeric values in data charts are actual numbers (not strings).`;

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

function getRenderMode(type: string): RenderMode {
  return (MERMAID_TYPES as string[]).includes(type) ? "mermaid" : "custom";
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
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2000,
      responseMimeType: "application/json",
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
  const renderMode = getRenderMode(type);

  if (renderMode === "mermaid") {
    if (!parsed.mermaidSyntax) {
      throw new Error("Missing mermaidSyntax in Gemini response for mermaid type");
    }
    return {
      visualType: type,
      renderMode: "mermaid",
      mermaidSyntax: parsed.mermaidSyntax as string,
      customData: null,
    };
  }

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
