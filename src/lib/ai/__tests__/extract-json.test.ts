import { describe, it, expect } from "vitest";
import { extractJSON } from "../gemini";

describe("extractJSON", () => {
  it("parses plain JSON object", () => {
    const result = extractJSON('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("parses plain JSON array", () => {
    const result = extractJSON('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it("extracts JSON from markdown code fences", () => {
    const input = 'Here is the result:\n```json\n{"visualType": "flowchart"}\n```\nDone.';
    expect(extractJSON(input)).toEqual({ visualType: "flowchart" });
  });

  it("extracts JSON from code fences without language tag", () => {
    const input = '```\n{"a": 1}\n```';
    expect(extractJSON(input)).toEqual({ a: 1 });
  });

  it("extracts JSON object embedded in prose", () => {
    const input = 'The output is: {"title": "Test", "value": 42} as expected.';
    expect(extractJSON(input)).toEqual({ title: "Test", value: 42 });
  });

  it("handles whitespace around JSON", () => {
    const result = extractJSON('  \n  {"key": "value"}  \n  ');
    expect(result).toEqual({ key: "value" });
  });

  it("throws on empty string", () => {
    expect(() => extractJSON("")).toThrow("Empty response");
  });

  it("throws on invalid JSON with no extractable content", () => {
    expect(() => extractJSON("no json here at all")).toThrow("Could not extract valid JSON");
  });

  it("handles nested JSON objects", () => {
    const input = '{"root": {"label": "Topic", "children": [{"label": "A"}]}}';
    const result = extractJSON(input) as Record<string, unknown>;
    expect(result.root).toBeDefined();
  });

  it("prefers direct parse over fence extraction", () => {
    const input = '{"direct": true}';
    expect(extractJSON(input)).toEqual({ direct: true });
  });
});
