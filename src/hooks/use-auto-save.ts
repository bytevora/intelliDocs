"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveData {
  title?: string;
  content?: object;
}

export function useAutoSave(
  docId: string,
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  delay: number = 2000
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<SaveData | null>(null);

  const save = useCallback(
    async (data: SaveData) => {
      setStatus("saving");
      try {
        const body: Record<string, string> = {};
        if (data.title !== undefined) body.title = data.title;
        if (data.content !== undefined)
          body.content = JSON.stringify(data.content);

        const res = await authFetch(`/api/documents/${docId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error();
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    },
    [docId, authFetch]
  );

  const debouncedSave = useCallback(
    (data: SaveData) => {
      latestDataRef.current = data;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (latestDataRef.current) {
          save(latestDataRef.current);
          latestDataRef.current = null;
        }
      }, delay);
    },
    [save, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        if (latestDataRef.current) {
          save(latestDataRef.current);
        }
      }
    };
  }, [save]);

  return { debouncedSave, status };
}
