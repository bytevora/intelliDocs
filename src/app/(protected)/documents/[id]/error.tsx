"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function DocumentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <h2 className="text-xl font-semibold">Failed to load document</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "The document could not be loaded. It may have been deleted or you may not have access."}
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
          <Button onClick={() => (window.location.href = "/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
