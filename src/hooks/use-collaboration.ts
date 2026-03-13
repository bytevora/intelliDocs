"use client";

import { useState, useEffect, useRef } from "react";
import * as Y from "yjs";
import { useAuth } from "./use-auth";
import { SocketIOProvider } from "@/lib/collaboration/socket-io-provider";
import { getCursorColor } from "@/lib/collaboration/colors";

const COLLAB_TIMEOUT_MS = 5000;

interface CollaborationState {
  ydoc: Y.Doc | null;
  provider: SocketIOProvider | null;
  connected: boolean;
  synced: boolean;
  failed: boolean;
}

export function useCollaboration(
  documentId: string,
  userId: string | null,
  username: string | null
): CollaborationState {
  const { getToken } = useAuth();
  const [connected, setConnected] = useState(false);
  const [synced, setSynced] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<SocketIOProvider | null>(null);
  const destroyedRef = useRef(false);

  useEffect(() => {
    if (!userId || !username) return;

    const token = getToken();
    if (!token) return;

    destroyedRef.current = false;

    const doc = new Y.Doc();
    const cursorColor = getCursorColor(userId);

    let prov: SocketIOProvider;
    try {
      prov = new SocketIOProvider(
        window.location.origin,
        documentId,
        doc,
        {
          token,
          user: {
            id: userId,
            name: username,
            color: cursorColor.color,
          },
        }
      );
    } catch {
      // Socket.IO connection failed to initialize
      doc.destroy();
      setFailed(true);
      return;
    }

    // Timeout: if we don't sync within COLLAB_TIMEOUT_MS, mark as failed
    // so the page falls back to standalone mode
    const timeoutId = setTimeout(() => {
      if (!destroyedRef.current && !prov.synced) {
        setFailed(true);
      }
    }, COLLAB_TIMEOUT_MS);

    prov.on("status", (event: unknown) => {
      if (destroyedRef.current) return;
      const e = event as { status: string };
      setConnected(e.status === "connected");
    });

    prov.on("sync", (isSynced: unknown) => {
      if (destroyedRef.current) return;
      const wasSynced = isSynced as boolean;
      setSynced(wasSynced);
      if (wasSynced) {
        setFailed(false);
        clearTimeout(timeoutId);
      }
    });

    setYdoc(doc);
    setProvider(prov);
    setFailed(false);

    return () => {
      destroyedRef.current = true;
      clearTimeout(timeoutId);
      setSynced(false);
      setConnected(false);
      setYdoc(null);
      setProvider(null);
      prov.destroy();
      doc.destroy();
    };
  }, [documentId, userId, username, getToken]);

  return { ydoc, provider, connected, synced, failed };
}
