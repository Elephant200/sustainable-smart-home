"use client";

import { useEffect, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfigurationAlert() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  
    useEffect(() => {
    const shouldConfigure = searchParams.get("configure") === "true";
    if (shouldConfigure) {
      setIsOpen(true);
    }
  }, [searchParams]);

  const handleClose = () => {
    setIsOpen(false);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("configure");
    const newUrl = `${pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`;
    window.history.replaceState(null, '', newUrl);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Device Configuration Required</DialogTitle>
          <DialogDescription>
            Please configure your smart home devices to begin using the sustainable smart home dashboard.
            <br />
            <br />
            This will allow our optimization algorithms to work their magic and help you save energy and money. But, without your devices configured, we can&apos;t do that.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button onClick={handleClose}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 