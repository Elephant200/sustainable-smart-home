"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export function NotFoundContent() {
  const router = useRouter();

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold text-foreground">Page Not Found</h2>
          <p className="text-muted-foreground">
            Sorry, we couldn't find the page you're looking for. It might have been moved, deleted, or you may have entered the wrong URL.
          </p>
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