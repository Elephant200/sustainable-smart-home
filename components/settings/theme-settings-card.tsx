"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ThemeSettingsCard = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const ICON_SIZE = 16;

  const getThemeDisplayName = () => {
    switch (theme) {
      case "light": return "Light";
      case "dark": return "Dark";
      case "system": return "System";
      default: return "System";
    }
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "light": return <Sun size={ICON_SIZE} className="text-muted-foreground" />;
      case "dark": return <Moon size={ICON_SIZE} className="text-muted-foreground" />;
      case "system": return <Laptop size={ICON_SIZE} className="text-muted-foreground" />;
      default: return <Laptop size={ICON_SIZE} className="text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>
          Choose your preferred color theme for the application
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getThemeIcon()}
            <span className="text-sm font-medium">Current: {getThemeDisplayName()}</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                {getThemeIcon()}
                Change Theme
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-content" align="end">
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(e) => setTheme(e)}
              >
                <DropdownMenuRadioItem className="flex gap-2" value="light">
                  <Sun size={ICON_SIZE} className="text-muted-foreground" />
                  <span>Light</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem className="flex gap-2" value="dark">
                  <Moon size={ICON_SIZE} className="text-muted-foreground" />
                  <span>Dark</span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem className="flex gap-2" value="system">
                  <Laptop size={ICON_SIZE} className="text-muted-foreground" />
                  <span>System</span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};

export { ThemeSettingsCard }; 