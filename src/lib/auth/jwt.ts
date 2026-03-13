import { SignJWT, jwtVerify } from "jose";

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
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(refreshSecret);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, accessSecret);
  return payload as unknown as JWTPayload;
}

export async function verifyRefreshToken(
  token: string
): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, refreshSecret);
  return payload as unknown as { sub: string };
}
