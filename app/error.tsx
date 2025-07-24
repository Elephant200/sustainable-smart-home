"use client";

import { ErrorContent } from "@/components/layout/error-content";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <ErrorContent error={error} reset={reset} />
    </div>
  );
}
