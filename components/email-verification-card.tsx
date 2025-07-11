"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, AlertCircle, Mail } from "lucide-react";

interface EmailVerificationCardProps {
  userEmail: string;
  isVerified: boolean;
}

export function EmailVerificationCard({ userEmail, isVerified }: EmailVerificationCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendVerificationEmail = async () => {
    setIsLoading(true);
    setMessage(null);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        }
      });
      
      if (error) throw error;
      setMessage("Verification email sent! Please check your inbox.");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to send verification email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isVerified ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          )}
          Email Verification
        </CardTitle>
        <CardDescription>
          {isVerified 
            ? "Your email address has been verified" 
            : "Verify your email to enable all features"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4" />
          <span>{userEmail}</span>
        </div>
        
        {!isVerified && (
          <>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Without email verification, you won't be able to use the forgot password feature.
              </p>
            </div>
            
            <div className="space-y-2">
              <Button 
                onClick={sendVerificationEmail} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Sending..." : "Send Verification Email"}
              </Button>
              
              {message && (
                <p className="text-sm text-green-600">{message}</p>
              )}
              
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
          </>
        )}
        
        {isVerified && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-800">
              ✅ Your email is verified! You can now use all features including password recovery.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 