import { io, Socket } from "socket.io-client";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { encoding, decoding } from "lib0";

export interface SocketIOProviderOptions {
  token: string;
  user: { id: string; name: string; color: string };
}

type EventHandler = (...args: unknown[]) => void;

export class SocketIOProvider {
  doc: Y.Doc;
  awareness: Awareness;
  socket: Socket;
  synced = false;
  connected = false;

  private documentId: string;
  private eventHandlers = new Map<string, Set<EventHandler>>();

  constructor(
    serverUrl: string,
    documentId: string,
    doc: Y.Doc,
    options: SocketIOProviderOptions
  ) {
    this.doc = doc;
    this.documentId = documentId;
    this.awareness = new Awareness(doc);

    this.awareness.setLocalStateField("user", {
      name: options.user.name,
      color: options.user.color,
      id: options.user.id,
    });

    this.socket = io(serverUrl, {
      auth: { token: options.token },
      query: { documentId },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 50,
    });

    this.socket.on("connect", () => {
      this.connected = true;
      this.emit("status", [{ status: "connected" }]);

      // Send initial awareness
      const encoderAwareness = encoding.createEncoder();
      encoding.writeVarUint8Array(
        encoderAwareness,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
          this.doc.clientID,
        ])
      );
      this.socket.emit(
        "awareness-update",
        encoding.toUint8Array(encoderAwareness)
      );
    });

    this.socket.on("disconnect", () => {
      this.connected = false;
      this.synced = false;
      this.emit("status", [{ status: "disconnected" }]);
      this.emit("sync", [false]);
    });

    // Handle sync step 1 from server
    this.socket.on("sync-step-1", (data: ArrayBuffer) => {
      const encoder = encoding.createEncoder();
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const syncMessageType = syncProtocol.readSyncMessage(
        decoder,
        encoder,
        this.doc,
        this
      );

      if (encoding.length(encoder) > 1) {
        this.socket.emit("sync-step-2", encoding.toUint8Array(encoder));
      }

      // After processing sync-step-1, send our own sync-step-1
      if (syncMessageType === 0) {
        const encoderStep1 = encoding.createEncoder();
        syncProtocol.writeSyncStep1(encoderStep1, this.doc);
        this.socket.emit("sync-step-1", encoding.toUint8Array(encoderStep1));
      }
    });

    // Handle sync step 2 from server
    this.socket.on("sync-step-2", (data: ArrayBuffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const encoder = encoding.createEncoder();
      syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);

      if (!this.synced) {
        this.synced = true;
        this.emit("sync", [true]);
      }
    });

    // Handle updates from server
    this.socket.on("sync-update", (data: ArrayBuffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const encoder = encoding.createEncoder();
      syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);

      if (!this.synced) {
        this.synced = true;
        this.emit("sync", [true]);
      }
    });

    // Handle awareness updates from server
    this.socket.on("awareness-update", (data: ArrayBuffer) => {
      awarenessProtocol.applyAwarenessUpdate(
        this.awareness,
        decoding.readVarUint8Array(
          decoding.createDecoder(new Uint8Array(data))
        ),
        this
      );
    });

    // Listen for local doc updates and send to server
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin !== this) {
        const encoder = encoding.createEncoder();
        syncProtocol.writeUpdate(encoder, update);
        this.socket.emit("sync-update", encoding.toUint8Array(encoder));
      }
    });

    // Listen for local awareness changes and send to server
    this.awareness.on(
      "update",
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
        const changedClients = added.concat(updated).concat(removed);
        const encoderAwareness = encoding.createEncoder();
        encoding.writeVarUint8Array(
          encoderAwareness,
          awarenessProtocol.encodeAwarenessUpdate(
            this.awareness,
            changedClients
          )
        );
        this.socket.emit(
          "awareness-update",
          encoding.toUint8Array(encoderAwareness)
        );
      }
    );
  }

  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler) {
    this.eventHandlers.get(event)?.delete(handler);
  }

  emit(event: string, args: unknown[]) {
    this.eventHandlers.get(event)?.forEach((handler) => handler(...args));
  }

  destroy() {
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      this
    );
    this.socket.disconnect();
    this.awareness.destroy();
  }
}
