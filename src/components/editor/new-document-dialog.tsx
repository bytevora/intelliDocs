"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, Loader2, FileText, ArrowRight } from "lucide-react";

interface NewDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewDocumentDialog({
  open,
  onOpenChange,
}: NewDocumentDialogProps) {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [generating, setGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setIdea("");
      setGenerating(false);
      setStatusText("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function handleGenerate() {
    const trimmed = idea.trim();
    if (!trimmed) {
      toast.error("Please enter an idea for your document");
      return;
    }

    setGenerating(true);
    setStatusText("Generating your document with AI...");

    try {
      const res = await authFetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate document");
      }

      const doc = await res.json();
      setStatusText("Document created! Redirecting...");
      toast.success(`Created: ${doc.title}`);
      onOpenChange(false);
      router.push(`/documents/${doc.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate document"
      );
      setGenerating(false);
      setStatusText("");
    }
  }

  async function handleBlankDocument() {
    setGenerating(true);
    try {
      const res = await authFetch("/api/documents", { method: "POST" });
      if (!res.ok) throw new Error();
      const doc = await res.json();
      onOpenChange(false);
      router.push(`/documents/${doc.id}`);
    } catch {
      toast.error("Failed to create document");
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={generating ? undefined : onOpenChange}>
      <DialogContent
        showCloseButton={!generating}
        className="rounded-3xl border border-border/50 shadow-2xl overflow-hidden sm:max-w-lg backdrop-blur-xl bg-background/95"
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-extrabold flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            New Document
          </DialogTitle>
          <DialogDescription className="text-sm pt-2 text-muted-foreground font-medium">
            Describe your idea and AI will generate a complete, well-structured
            document for you.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          <div className="relative mt-2">
            <textarea
              ref={inputRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !generating) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="e.g., 5 Best Practices for Hiring Interviews"
              disabled={generating}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all disabled:opacity-50"
            />
          </div>

          {generating && statusText && (
            <div className="flex items-center gap-2.5 mt-3 px-1">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              <span className="text-xs font-medium text-muted-foreground animate-pulse">
                {statusText}
              </span>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex flex-col gap-2">
          <Button
            onClick={handleGenerate}
            disabled={generating || !idea.trim()}
            className="w-full justify-between bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 shadow-lg shadow-primary/20 font-bold"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </span>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </Button>

          <div className="relative flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            variant="outline"
            onClick={handleBlankDocument}
            disabled={generating}
            className="w-full justify-between rounded-xl h-10 border-border bg-transparent hover:bg-secondary font-semibold text-muted-foreground"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Start with blank document
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
