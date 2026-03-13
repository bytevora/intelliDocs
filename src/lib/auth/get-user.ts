import { NextRequest } from "next/server";
import { verifyAccessToken, JWTPayload } from "./jwt";

export async function getAuthUser(
  req: NextRequest
): Promise<JWTPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return await verifyAccessToken(authHeader.substring(7));
  } catch {
    return null;
  }
}
