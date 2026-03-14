import { describe, it, expect } from "vitest";
import { parsePagination, paginationMeta } from "../pagination";

describe("parsePagination", () => {
  it("returns defaults when no params", () => {
    const params = new URLSearchParams();
    const result = parsePagination(params);
    expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it("parses page and limit", () => {
    const params = new URLSearchParams("page=3&limit=10");
    const result = parsePagination(params);
    expect(result).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it("clamps page to minimum 1", () => {
    const params = new URLSearchParams("page=-5");
    expect(parsePagination(params).page).toBe(1);
  });

  it("clamps limit to minimum 1", () => {
    const params = new URLSearchParams("limit=0");
    expect(parsePagination(params).limit).toBe(1);
  });

  it("clamps limit to maximum 100", () => {
    const params = new URLSearchParams("limit=500");
    expect(parsePagination(params).limit).toBe(100);
  });

  it("handles non-numeric values as defaults", () => {
    const params = new URLSearchParams("page=abc&limit=xyz");
    expect(parsePagination(params)).toEqual({ page: 1, limit: 20, offset: 0 });
  });
});

describe("paginationMeta", () => {
  it("calculates totalPages correctly", () => {
    const meta = paginationMeta(1, 20, 45);
    expect(meta).toEqual({ page: 1, limit: 20, total: 45, totalPages: 3 });
  });

  it("returns 1 page for empty results", () => {
    const meta = paginationMeta(1, 20, 0);
    expect(meta.totalPages).toBe(0);
  });

  it("returns 1 page when total equals limit", () => {
    const meta = paginationMeta(1, 20, 20);
    expect(meta.totalPages).toBe(1);
  });

  it("returns 1 page when total is less than limit", () => {
    const meta = paginationMeta(1, 20, 5);
    expect(meta.totalPages).toBe(1);
  });
});
