"use client";

import { createContext, useContext, ReactNode } from "react";

interface DocumentContextType {
  documentId: string;
  authFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
}

const DocumentContext = createContext<DocumentContextType | null>(null);

export function DocumentProvider({
  documentId,
  authFetch,
  children,
}: DocumentContextType & { children: ReactNode }) {
  return (
    <DocumentContext.Provider value={{ documentId, authFetch }}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocument(): DocumentContextType {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error("useDocument must be used within a DocumentProvider");
  }
  return context;
}
