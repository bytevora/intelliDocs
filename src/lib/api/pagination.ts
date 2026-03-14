const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Parse `?page=` and `?limit=` from a URL's search params. */
export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const rawPage = parseInt(searchParams.get("page") || "", 10);
  const rawLimit = parseInt(searchParams.get("limit") || "", 10);
  const page = Math.max(1, Number.isNaN(rawPage) ? DEFAULT_PAGE : rawPage);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/** Build the pagination metadata for a response. */
export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
