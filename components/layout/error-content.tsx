"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorContentProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorContent({ error, reset }: ErrorContentProps) {
  const router = useRouter();
  const [errorDetails, setErrorDetails] = useState<string>("");

  useEffect(() => {
    // Log error details for debugging
    console.error("Application error:", error);
    
    // Set user-friendly error message
    if (typeof window !== "undefined") {
      const isDevelopment = process.env.NODE_ENV === "development";
      setErrorDetails(isDevelopment ? error.message : "An unexpected error occurred");
    }
  }, [error]);

  const handleTryAgain = () => {
    reset();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Simple branding header */}
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
          <Image 
            src="/favicon.ico" 
            alt="Sustainable Smart Home" 
            width={24} 
            height={24}
            className="rounded-sm"
          />
          <span className="font-semibold">Sustainable Smart Home</span>
        </Link>
      </div>
      
      <Card className="w-full max-w-md p-8 text-center space-y-6">
        <div className="space-y-4">
          <div className="flex justify-center">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
            <div className="space-y-3">
              <p className="text-muted-foreground">
                We apologize for the inconvenience. An error occurred while processing your request.
              </p>
              
              {errorDetails && (
                <div className="bg-muted/50 rounded-md px-3 py-2 border">
                  <code className="text-sm font-mono text-foreground break-words">
                    {errorDetails}
                  </code>
                </div>
              )}
              
              {error.digest && (
                <div className="text-xs text-muted-foreground">
                  Error ID: {error.digest}
                </div>
              )}
              
              <p className="text-sm text-muted-foreground">
                You can try refreshing the page or go back to continue using the application.
              </p>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <Button 
            onClick={handleTryAgain}
            variant="default"
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          
          <Button 
            onClick={() => router.back()} 
            variant="outline"
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