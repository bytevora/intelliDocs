import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin, ApiError, handleApiError } from "@/lib/api/guards";
import { hashPassword } from "@/lib/auth/passwords";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ userId: string }> };

/** PATCH /api/admin/users/:userId — update user fields */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireAdmin(req);
    const { userId } = await params;

    const target = db.select().from(users).where(eq(users.id, userId)).get();
    if (!target) throw new ApiError(404, "User not found");

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.username !== undefined) updates.username = body.username;
    if (body.email !== undefined) updates.email = body.email;
    if (body.role !== undefined) {
      if (body.role !== "admin" && body.role !== "user") {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      // Prevent admin from demoting themselves
      if (target.id === admin.sub && body.role !== "admin") {
        return NextResponse.json(
          { error: "Cannot change your own role" },
          { status: 400 }
        );
      }
      updates.role = body.role;
    }

    if (body.isActive !== undefined) {
      // Prevent admin from deactivating themselves
      if (target.id === admin.sub && !body.isActive) {
        return NextResponse.json(
          { error: "Cannot deactivate your own account" },
          { status: 400 }
        );
      }
      updates.isActive = Boolean(body.isActive);
    }

    if (body.password !== undefined) {
      if (body.password.length < PASSWORD_MIN_LENGTH) {
        return NextResponse.json(
          { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` },
          { status: 400 }
        );
      }
      updates.password = await hashPassword(body.password);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.updatedAt = new Date().toISOString();

    db.update(users).set(updates).where(eq(users.id, userId)).run();

    const updated = db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/** DELETE /api/admin/users/:userId — delete a user */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const admin = await requireAdmin(req);
    const { userId } = await params;

    if (userId === admin.sub) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const target = db.select().from(users).where(eq(users.id, userId)).get();
    if (!target) throw new ApiError(404, "User not found");

    db.delete(users).where(eq(users.id, userId)).run();

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
