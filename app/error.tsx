"use client";

import { ErrorContent } from "@/components/layout/error-content";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    import("@/lib/reporter").then(({ reportError }) => {
      reportError(error, { route: "client-error-boundary" });
    });
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col">
      <ErrorContent error={error} reset={reset} />
    </div>
  );
}
