import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { requireAuth, handleApiError } from "@/lib/api/guards";
import { v4 as uuidv4 } from "uuid";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const DOCUMENT_GENERATION_PROMPT = `You are an expert document writer. Given an idea or topic, generate a comprehensive, well-structured document.

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

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);

    let idea: string;
    try {
      const body = await req.json();
      idea = body.idea?.trim();
      if (!idea) {
        return NextResponse.json(
          { error: "Please provide an idea for the document" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
      },
      systemInstruction: DOCUMENT_GENERATION_PROMPT,
    });

    const result = await model.generateContent(
      `Generate a comprehensive document about the following idea:\n\n${idea}`
    );
    const raw = result.response.text();

    if (!raw) {
      throw new Error("Empty response from Gemini");
    }

    let parsed: { title: string; icon: string; content: object };

    // Try direct parse
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try extracting from markdown fences
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        parsed = JSON.parse(fenceMatch[1].trim());
      } else {
        const braceMatch = raw.match(/(\{[\s\S]*\})/);
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[1]);
        } else {
          throw new Error("Could not parse Gemini response");
        }
      }
    }

    if (!parsed.title || !parsed.content) {
      throw new Error("Invalid response structure from Gemini");
    }

    const now = new Date().toISOString();
    const newDoc = {
      id: uuidv4(),
      title: parsed.title,
      content: JSON.stringify(parsed.content),
      ownerId: user.sub,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(documents).values(newDoc).run();

    return NextResponse.json(
      {
        id: newDoc.id,
        title: parsed.title,
        icon: parsed.icon || "📄",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
