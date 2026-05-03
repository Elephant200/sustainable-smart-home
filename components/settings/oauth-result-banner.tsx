"use client";

import { useEffect, useState } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const PROVIDER_DISPLAY: Record<string, string> = {
  tesla: "Tesla",
  enphase: "Enphase",
};

/**
 * Inline banner shown on the Settings page after the OAuth callback redirects
 * back with either `?connected=<provider>` (success) or `?oauth_error=<msg>`
 * (failure). Removes the query param from the URL when dismissed so a refresh
 * doesn't re-show the banner.
 */
export function OAuthResultBanner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const connected = searchParams.get("connected");
  const oauthError = searchParams.get("oauth_error");

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [connected, oauthError]);

  if (dismissed || (!connected && !oauthError)) return null;

  const dismiss = () => {
    setDismissed(true);
    const next = new URLSearchParams(searchParams);
    next.delete("connected");
    next.delete("oauth_error");
    next.delete("oauth_provider");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  if (connected) {
    const label = PROVIDER_DISPLAY[connected] ?? connected;
    return (
      <div className="flex items-start gap-3 rounded-md border border-success/30 bg-success/15 p-4 text-sm text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium">Connected to {label}</p>
          <p className="text-success/80 mt-0.5">
            Tokens were saved securely. Live data will appear here once the next
            sync runs.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={dismiss} className="-mt-1 -mr-2 h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium">Connection failed</p>
        <p className="text-destructive/80 mt-0.5 break-all">{oauthError}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={dismiss} className="-mt-1 -mr-2 h-7 w-7 p-0">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
