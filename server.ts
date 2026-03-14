import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer, Socket } from "socket.io";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { encoding, decoding } from "lib0";
import { yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import { eq, and } from "drizzle-orm";
import { logger } from "./src/lib/logger";

const log = logger.create("server");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface DocRoom {
  ydoc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Map<string, { socketId: string; userId: string; permission: string }>;
  saveTimeout: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
}

const rooms = new Map<string, DocRoom>();

// Lazy imports for modules that read process.env at load time
let verifyAccessToken: typeof import("./src/lib/auth/jwt").verifyAccessToken;
let db: typeof import("./src/lib/db/index").db;
let documents: typeof import("./src/lib/db/schema").documents;
let documentShares: typeof import("./src/lib/db/schema").documentShares;

type JWTPayload = import("./src/lib/auth/jwt").JWTPayload;

function getOrCreateRoom(documentId: string, yjsState: string | null): DocRoom {
  let room = rooms.get(documentId);
  if (room) return room;

  const ydoc = new Y.Doc();

  if (yjsState) {
    try {
      const binaryState = Buffer.from(yjsState, "base64");
      Y.applyUpdate(ydoc, new Uint8Array(binaryState));
    } catch (e) {
      log.error(`Failed to load Yjs state for doc ${documentId}`, e);
    }
  }

  const awareness = new awarenessProtocol.Awareness(ydoc);

  room = { ydoc, awareness, clients: new Map(), saveTimeout: null, dirty: false };
  rooms.set(documentId, room);
  return room;
}

function scheduleSave(documentId: string, room: DocRoom) {
  if (room.saveTimeout) clearTimeout(room.saveTimeout);
  room.saveTimeout = setTimeout(() => persistDoc(documentId, room), 5000);
}

async function persistDoc(documentId: string, room: DocRoom) {
  try {
    const yjsState = Buffer.from(Y.encodeStateAsUpdate(room.ydoc)).toString("base64");

    let content: string | undefined;
    try {
      const xmlFragment = room.ydoc.getXmlFragment("default");
      if (xmlFragment.length > 0) {
        const json = yXmlFragmentToProsemirrorJSON(xmlFragment);
        content = JSON.stringify(json);
      }
    } catch {
      // If conversion fails, just save the Yjs state
    }

    const updateData: Record<string, string> = {
      yjsState,
      updatedAt: new Date().toISOString(),
    };
    if (content) updateData.content = content;

    await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, documentId));

    room.dirty = false;
  } catch (e) {
    log.error(`Failed to persist doc ${documentId}`, e);
  }
}

function cleanupRoom(documentId: string) {
  const room = rooms.get(documentId);
  if (!room) return;
  if (room.clients.size > 0) return;

  if (room.saveTimeout) clearTimeout(room.saveTimeout);
  if (room.dirty) persistDoc(documentId, room);

  room.awareness.destroy();
  room.ydoc.destroy();
  rooms.delete(documentId);
}

async function checkDocPermission(
  userId: string,
  documentId: string
): Promise<string | null> {
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  });

  if (!doc) return null;
  if (doc.ownerId === userId) return "owner";

  const share = await db.query.documentShares.findFirst({
    where: and(
      eq(documentShares.documentId, documentId),
      eq(documentShares.sharedWith, userId)
    ),
  });

  if (!share) return null;
  return share.permission;
}

app.prepare().then(async () => {
  // Now that Next.js has fully initialized (env vars are loaded),
  // dynamically import modules that read process.env at load time
  const jwtModule = await import("./src/lib/auth/jwt");
  verifyAccessToken = jwtModule.verifyAccessToken;

  const dbModule = await import("./src/lib/db/index");
  db = dbModule.db;

  const schemaModule = await import("./src/lib/db/schema");
  documents = schemaModule.documents;
  documentShares = schemaModule.documentShares;

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: dev ? "*" : false,
    },
  });

  // Auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = await verifyAccessToken(token);
      (socket as Socket & { user: JWTPayload }).user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket: Socket & { user?: JWTPayload }) => {
    const documentId = socket.handshake.query.documentId as string;
    const user = socket.user;

    if (!documentId || !user) {
      socket.disconnect();
      return;
    }

    const permission = await checkDocPermission(user.sub, documentId);
    if (!permission) {
      socket.emit("error", { message: "Access denied" });
      socket.disconnect();
      return;
    }

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      socket.emit("error", { message: "Document not found" });
      socket.disconnect();
      return;
    }

    const room = getOrCreateRoom(documentId, doc.yjsState);

    socket.join(documentId);
    room.clients.set(socket.id, {
      socketId: socket.id,
      userId: user.sub,
      permission,
    });

    // Send sync step 1 to client
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, room.ydoc);
    socket.emit("sync-step-1", encoding.toUint8Array(encoder));

    // Send sync step 2 (full state) to bring client up to date
    const encoder2 = encoding.createEncoder();
    syncProtocol.writeSyncStep2(encoder2, room.ydoc);
    socket.emit("sync-step-2", encoding.toUint8Array(encoder2));

    // Send current awareness states
    const awarenessStates = awarenessProtocol.encodeAwarenessUpdate(
      room.awareness,
      Array.from(room.awareness.getStates().keys())
    );
    if (awarenessStates.byteLength > 1) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint8Array(awarenessEncoder, awarenessStates);
      socket.emit("awareness-update", encoding.toUint8Array(awarenessEncoder));
    }

    socket.on("sync-step-1", (data: ArrayBuffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const responseEncoder = encoding.createEncoder();
      syncProtocol.readSyncMessage(decoder, responseEncoder, room.ydoc, null);

      if (encoding.length(responseEncoder) > 1) {
        socket.emit("sync-step-2", encoding.toUint8Array(responseEncoder));
      }
    });

    socket.on("sync-step-2", (data: ArrayBuffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const responseEncoder = encoding.createEncoder();
      syncProtocol.readSyncMessage(decoder, responseEncoder, room.ydoc, null);
    });

    socket.on("sync-update", (data: ArrayBuffer) => {
      const client = room.clients.get(socket.id);
      if (client?.permission === "viewer") return;

      const decoder = decoding.createDecoder(new Uint8Array(data));
      const responseEncoder = encoding.createEncoder();
      syncProtocol.readSyncMessage(decoder, responseEncoder, room.ydoc, null);

      socket.to(documentId).emit("sync-update", data);
      room.dirty = true;
      scheduleSave(documentId, room);
    });

    socket.on("awareness-update", (data: ArrayBuffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      awarenessProtocol.applyAwarenessUpdate(
        room.awareness,
        decoding.readVarUint8Array(decoder),
        socket
      );

      socket.to(documentId).emit("awareness-update", data);
    });

    socket.on("title-update", async (newTitle: string) => {
      const client = room.clients.get(socket.id);
      if (client?.permission === "viewer") return;

      if (typeof newTitle === "string" && newTitle.length <= 500) {
        socket.to(documentId).emit("title-update", newTitle);

        try {
          await db
            .update(documents)
            .set({ title: newTitle, updatedAt: new Date().toISOString() })
            .where(eq(documents.id, documentId));
        } catch (e) {
          log.error("Failed to persist title", e);
        }
      }
    });

    socket.on("disconnect", () => {
      room.clients.delete(socket.id);

      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        [room.ydoc.clientID],
        null
      );

      const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        Array.from(room.awareness.getStates().keys())
      );
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint8Array(awarenessEncoder, awarenessUpdate);
      socket.to(documentId).emit(
        "awareness-update",
        encoding.toUint8Array(awarenessEncoder)
      );

      cleanupRoom(documentId);
    });
  });

  httpServer.listen(port, () => {
    log.info(`Ready on http://${hostname}:${port}`);
  });
});
