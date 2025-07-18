"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { useEffect, useState } from "react";

export function NotFoundContent() {
  const router = useRouter();
  const pathname = usePathname();
  const [fullUrl, setFullUrl] = useState(pathname);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setFullUrl(window.location.origin + pathname);
    }
  }, [pathname]);

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold text-foreground">Page Not Found</h2>
          <div className="space-y-3">
            <p className="text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist:
            </p>
            <div className="bg-muted/50 rounded-md px-3 py-2 border">
              <code className="text-sm font-mono text-foreground break-all">
                {fullUrl}
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              It might have been moved, deleted, or you may have entered the wrong URL.
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          <Button 
            onClick={() => router.back()} 
            variant="default"
            className="w-full"
          >
            Go Back
          </Button>
          
          <Button 
            asChild 
            variant="outline"
            className="w-full"
          >
            <Link href="/">
              Return Home
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
} 