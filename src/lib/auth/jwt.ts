import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { refreshTokens } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const accessSecret = new TextEncoder().encode(process.env.JWT_SECRET);
const refreshSecret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);

export interface JWTPayload {
  sub: string;
  username: string;
  email: string;
  role: string;
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(accessSecret);
}

export async function signRefreshToken(userId: string): Promise<string> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(jti)
    .setExpirationTime("7d")
    .sign(refreshSecret);

  db.insert(refreshTokens)
    .values({ id: randomUUID(), userId, jti, expiresAt })
    .run();

  return token;
}

export async function verifyRefreshToken(
  token: string
): Promise<{ sub: string; jti: string }> {
  const { payload } = await jwtVerify(token, refreshSecret);
  const jti = payload.jti;
  if (!jti) throw new Error("Missing jti");

  const record = db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.jti, jti), eq(refreshTokens.revoked, false)))
    .get();

  if (!record) throw new Error("Token revoked or not found");

  return { sub: payload.sub as string, jti };
}

export function revokeRefreshToken(jti: string): void {
  db.update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.jti, jti))
    .run();
}

export function revokeAllUserRefreshTokens(userId: string): void {
  db.update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.userId, userId))
    .run();
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, accessSecret);
  return payload as unknown as JWTPayload;
}
