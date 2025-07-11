"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

export function DeleteAccountCard() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const requiredText = "I want to delete my account";
  const isConfirmationValid = confirmationText === requiredText;

  const handleDeleteAccount = async () => {
    if (!isConfirmationValid) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Call the API route to delete the account
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      // Redirect to account deleted page
      router.push("/auth/account-deleted");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to delete account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <Trash2 className="h-5 w-5" />
          Delete Account
        </CardTitle>
        <CardDescription>
          Permanently delete your account and all associated data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> This action is irreversible.
              </p>
              <p className="text-sm text-red-700 mt-1">
                All your data will be permanently deleted and cannot be recovered.
              </p>
            </div>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              Delete Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete your account 
                and remove all your data from our servers.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="confirmation">
                  To confirm, type: <span className="font-mono text-sm bg-muted px-1 rounded">{requiredText}</span>
                </Label>
                <Input
                  id="confirmation"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Type the confirmation text..."
                  className={`${
                    confirmationText && !isConfirmationValid 
                      ? "border-red-500 focus:border-red-500" 
                      : ""
                  }`}
                />
              </div>
              
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setConfirmationText("");
                  setError(null);
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={!isConfirmationValid || isLoading}
              >
                {isLoading ? "Deleting..." : "Delete Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
} 