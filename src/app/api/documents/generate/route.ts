import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, stepCountIs } from "ai";
import { db } from "@/lib/db";
import { documents, visuals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, handleApiError } from "@/lib/api/guards";
import { v4 as uuidv4 } from "uuid";
import { validate } from "@/lib/api/validate";
import { generateDocumentSchema } from "@/lib/api/schemas";
import { generateVisual } from "@/lib/ai/gemini";
import { VisualType } from "@/types";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const DOCUMENT_GENERATION_PROMPT = `You are an expert research-driven document writer. Given an idea or topic, you MUST first research it using the google_search tool before writing.

IMPORTANT — Research workflow:
1. ALWAYS use the google_search tool to find up-to-date, accurate information about the topic BEFORE generating the document. Do NOT rely on your training data alone.
2. Make multiple searches if needed — search for the main topic, then for specific subtopics, statistics, or recent developments.
3. Use the search results to ground your document in real, current facts, data, and examples.
4. After gathering enough information from search results, generate the final document.

You MUST output ONLY valid JSON with these fields:
{
  "title": "A concise, compelling title for the document",
  "icon": "A single emoji that best represents the document topic",
  "content": <ProseMirror JSON document>
}

The "content" field must be valid ProseMirror/Tiptap JSON using ONLY these node types:
- doc (root, always required)
- paragraph (with optional text content and marks)
- heading (attrs: { level: 1|2|3 })
- bulletList (contains listItem nodes)
- orderedList (contains listItem nodes)
- listItem (contains paragraph nodes)
- blockquote (contains paragraph nodes)
- horizontalRule

Available marks for text nodes:
- bold
- italic
- strike
- code

Structure rules:
1. Start with an introductory blockquote paragraph summarizing the document
2. Then use numbered heading (level 2) sections like "1. Section Title"
3. Each section should have:
   - An introductory paragraph
   - A bulletList with 2-4 items, where each listItem has a paragraph with a bold label followed by a colon and description
4. End with a "Conclusion" heading (level 2) and a concluding paragraph
5. Add a horizontalRule between sections for visual separation
6. Generate 3-7 sections depending on topic complexity
7. Content should be detailed, informative, and professionally written
8. Total document length: 800-2000 words
9. CRITICAL: All string values must be valid JSON strings. Escape any special characters (newlines as \\\\n, tabs as \\\\t, quotes as \\\\"). Never use raw line breaks inside string values.
10. IMPORTANT: Add 3-4 empty paragraphs ({"type": "paragraph"}) as spacing between the text content and any subsequent sections. Specifically, after the introductory blockquote add 3 empty paragraphs before the first heading, and after each section's content (bullet list or paragraph) add 3 empty paragraphs before the next horizontalRule or heading. This ensures comfortable visual breathing room in the rendered document.

Example structure for a listItem with bold label:
{
  "type": "listItem",
  "content": [{
    "type": "paragraph",
    "content": [
      { "type": "text", "marks": [{"type": "bold"}], "text": "Key Point" },
      { "type": "text", "text": ": Detailed explanation of this point that provides actionable insight." }
    ]
  }]
}

Example heading:
{
  "type": "heading",
  "attrs": { "level": 2 },
  "content": [{ "type": "text", "text": "1. Section Title" }]
}`;

// ── Helpers for extracting text and sections from ProseMirror JSON ──

function extractText(node: any): string {
  if (!node) return "";
  if (node.text) return node.text;
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractText).join(" ");
  }
  return "";
}

interface Section {
  headingIndex: number;
  headingText: string;
  contentText: string;
  insertAfterIndex: number; // index after which to insert the visual block
}

function extractSections(nodes: any[]): Section[] {
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "heading" && node.attrs?.level === 2) {
      // Save previous section
      if (currentSection) {
        currentSection.insertAfterIndex = i - 1;
        sections.push(currentSection);
      }
      currentSection = {
        headingIndex: i,
        headingText: extractText(node),
        contentText: "",
        insertAfterIndex: i,
      };
    } else if (currentSection) {
      // Skip empty paragraphs and horizontal rules when building content text
      if (node.type === "horizontalRule") continue;
      const text = extractText(node).trim();
      if (text) {
        currentSection.contentText += (currentSection.contentText ? " " : "") + text;
      }
    }
  }

  // Push last section
  if (currentSection) {
    // Find the last non-empty paragraph before end or before a horizontalRule
    let lastContentIndex = currentSection.headingIndex;
    for (let i = currentSection.headingIndex + 1; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.type === "heading" && n.attrs?.level === 2) break;
      if (n.type !== "paragraph" || extractText(n).trim()) {
        if (n.type !== "horizontalRule") lastContentIndex = i;
      }
    }
    currentSection.insertAfterIndex = lastContentIndex;
    sections.push(currentSection);
  }

  return sections;
}

// Pick the best visual type based on section content keywords
function suggestVisualType(text: string): VisualType {
  const lower = text.toLowerCase();
  if (/percent|proportion|share|ratio|breakdown|distribut/i.test(lower)) return "donut";
  if (/compar|vs\.?|versus|differ|advantage|disadvantage/i.test(lower)) return "comparison";
  if (/step|stage|process|funnel|pipeline|conversion/i.test(lower)) return "funnel";
  if (/metric|kpi|stat|number|growth|revenue|rate/i.test(lower)) return "stats";
  if (/strength|weakness|opportunit|threat|swot/i.test(lower)) return "swot";
  if (/trend|over time|year|month|quarter|timeline|progress/i.test(lower)) return "line";
  if (/hierarch|organi[sz]|structure|team|department/i.test(lower)) return "orgchart";
  if (/overlap|intersect|shared|common|venn/i.test(lower)) return "venn";
  if (/flow|journey|allocat|transfer|sankey/i.test(lower)) return "sankey";
  if (/concept|idea|topic|brainstorm|overview|map/i.test(lower)) return "mindmap";
  if (/ranking|score|rating|amount|quantity|count/i.test(lower)) return "bar";
  return "mindmap";
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    const { idea } = validate(generateDocumentSchema, await req.json());

    const result = await generateText({
      model: google("gemini-2.0-flash"),
      system: DOCUMENT_GENERATION_PROMPT,
      prompt: `Generate a comprehensive document about the following idea:\n\n${idea}`,
      tools: {
        google_search: google.tools.googleSearch({}),
      },
      stopWhen: stepCountIs(5),
      temperature: 0.7,
      maxOutputTokens: 8000,
    });
    // Use text from the final step only — result.text concatenates all steps
    // which mixes search-related intermediate text into the JSON output
    const lastStep = result.steps[result.steps.length - 1];
    const raw = lastStep?.text || result.text;

    if (!raw) {
      throw new Error("Empty response from Gemini");
    }

    let parsed: { title: string; icon: string; content: object };

    // Sanitize JSON string to fix common LLM output issues
    function sanitizeJson(str: string): string {
      let s = str;
      // Remove trailing commas before ] or }
      s = s.replace(/,\s*([\]}])/g, "$1");
      // Fix unescaped newlines inside JSON string values
      let result = "";
      let inString = false;
      let escaped = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (escaped) {
          result += ch;
          escaped = false;
          continue;
        }
        if (ch === "\\" && inString) {
          result += ch;
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          result += ch;
          continue;
        }
        if (inString) {
          if (ch === "\n") { result += "\\n"; continue; }
          if (ch === "\r") { result += "\\r"; continue; }
          if (ch === "\t") { result += "\\t"; continue; }
        }
        result += ch;
      }
      return result;
    }

    function tryParse(str: string): { title: string; icon: string; content: object } {
      try {
        return JSON.parse(str);
      } catch {
        return JSON.parse(sanitizeJson(str));
      }
    }

    // Try direct parse
    try {
      parsed = tryParse(raw);
    } catch {
      // Try extracting from markdown fences
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        parsed = tryParse(fenceMatch[1].trim());
      } else {
        const braceMatch = raw.match(/(\{[\s\S]*\})/);
        if (braceMatch) {
          parsed = tryParse(braceMatch[1]);
        } else {
          throw new Error("Could not parse Gemini response");
        }
      }
    }

    if (!parsed.title || !parsed.content) {
      throw new Error("Invalid response structure from Gemini");
    }

    const now = new Date().toISOString();
    const docId = uuidv4();
    const content = parsed.content as any;

    // Insert document first so visuals can reference it (FK constraint)
    db.insert(documents)
      .values({
        id: docId,
        title: parsed.title,
        content: JSON.stringify(content),
        ownerId: user.sub,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // ── Auto-insert visuals by analyzing document sections ──
    if (content.content && Array.isArray(content.content)) {
      const sections = extractSections(content.content);
      console.log("[generate] Total content nodes:", content.content.length);
      console.log("[generate] Extracted sections:", sections.map(s => ({
        heading: s.headingText,
        contentLen: s.contentText.length,
        insertAfter: s.insertAfterIndex,
      })));

      // Skip the "Conclusion" section, pick up to 3 content sections for visuals
      const eligibleSections = sections.filter(
        (s) => !s.headingText.toLowerCase().includes("conclusion")
      );
      // Pick every other section, max 3
      const selectedSections: Section[] = [];
      for (let i = 0; i < eligibleSections.length && selectedSections.length < 3; i += 2) {
        if (eligibleSections[i].contentText.length > 30) {
          selectedSections.push(eligibleSections[i]);
        }
      }
      console.log("[generate] Selected sections for visuals:", selectedSections.length);

      // Generate visuals in parallel
      const visualResults = await Promise.allSettled(
        selectedSections.map(async (section) => {
          const visualType = suggestVisualType(section.contentText);
          const hint = `${section.headingText}: ${section.contentText.slice(0, 300)}`;
          console.log("[generate] Generating visual:", visualType, "for:", section.headingText);
          const genResult = await generateVisual(hint, visualType);
          const visualId = uuidv4();
          db.insert(visuals)
            .values({
              id: visualId,
              documentId: docId,
              sourceText: hint,
              visualType: genResult.visualType as typeof visuals.$inferInsert.visualType,
              customData: genResult.customData,
              theme: "default",
              createdAt: now,
              updatedAt: now,
            })
            .run();
          console.log("[generate] Visual created:", visualId, "type:", genResult.visualType);
          return { visualId, insertAfterIndex: section.insertAfterIndex };
        })
      );

      // Insert visual blocks into content (reverse order to preserve indices)
      const successfulVisuals = visualResults
        .map((r, i) => {
          if (r.status === "rejected") {
            console.error("[generate] Visual generation failed:", r.reason);
          }
          return r.status === "fulfilled" ? r.value : null;
        })
        .filter((v): v is { visualId: string; insertAfterIndex: number } => v !== null)
        .sort((a, b) => b.insertAfterIndex - a.insertAfterIndex);

      console.log("[generate] Successfully generated visuals:", successfulVisuals.length);

      for (const { visualId, insertAfterIndex } of successfulVisuals) {
        content.content.splice(insertAfterIndex + 1, 0, {
          type: "visualBlock",
          attrs: { visualId },
        });
      }

      // Verify visualBlocks are in final content
      const visualBlockCount = content.content.filter((n: any) => n.type === "visualBlock").length;
      console.log("[generate] Final content visualBlock count:", visualBlockCount);
    } else {
      console.log("[generate] No content.content array found — skipping visual insertion");
    }

    // Update document content with visual blocks spliced in
    db.update(documents)
      .set({ content: JSON.stringify(content), updatedAt: new Date().toISOString() })
      .where(eq(documents.id, docId))
      .run();

    return NextResponse.json(
      {
        id: docId,
        title: parsed.title,
        icon: parsed.icon || "📄",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
