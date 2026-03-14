import { z } from "zod";
import { ApiError } from "./guards";

/**
 * Parse and validate data against a zod schema.
 * Throws ApiError(400) with the first validation message on failure.
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request body";
    throw new ApiError(400, message);
  }
  return result.data;
}
