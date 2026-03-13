import { db } from "./index";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/passwords";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

export async function seedAdmin() {
  const existingAdmin = db
    .select()
    .from(users)
    .where(eq(users.role, "admin"))
    .get();

  if (existingAdmin) {
    console.log("Admin user already exists, skipping seed.");
    return;
  }

  const password = randomBytes(16).toString("hex");
  const hashedPassword = await hashPassword(password);
  const now = new Date().toISOString();

  db.insert(users)
    .values({
      id: uuidv4(),
      username: "admin",
      email: "admin@intellidocs.local",
      password: hashedPassword,
      role: "admin",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const credentialsPath = path.resolve("./admin-credentials.txt");
  const content = `Admin Credentials (auto-generated)\nUsername: admin\nEmail: admin@intellidocs.local\nPassword: ${password}\n`;
  fs.writeFileSync(credentialsPath, content, { mode: 0o600 });

  console.log(`Admin user created. Credentials saved to ${credentialsPath}`);
}
