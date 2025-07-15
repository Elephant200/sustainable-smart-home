"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SettingsSection {
  id: string;
  title: string;
  subsections?: { id: string; title: string }[];
}

const settingsSections: SettingsSection[] = [
  {
    id: "account-settings",
    title: "Account Settings",
    subsections: [
      { id: "theme-settings", title: "Theme" },
      { id: "password-change", title: "Password" },
      { id: "delete-account", title: "Delete Account" }
    ]
  },
  {
    id: "device-configuration",
    title: "Device Configuration"
  },
  {
    id: "notification-settings", 
    title: "Notification Settings"
  }
];

export function SettingsNavigation() {
  const [activeSection, setActiveSection] = useState<string>("account-settings");

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: "smooth",
        block: "start",
        inline: "nearest"
      });
      setActiveSection(sectionId);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    settingsSections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
      
      section.subsections?.forEach((subsection) => {
        const subElement = document.getElementById(subsection.id);
        if (subElement) observer.observe(subElement);
      });
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-64 bg-card rounded-lg border p-4 h-fit sticky top-6">
      <h3 className="font-semibold text-sm mb-4 text-muted-foreground uppercase tracking-wider">
        Settings
      </h3>
      
      <nav className="space-y-1">
        {settingsSections.map((section) => (
          <div key={section.id}>
            <button
              onClick={() => scrollToSection(section.id)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                activeSection === section.id || section.subsections?.some(sub => activeSection === sub.id)
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {section.title}
            </button>
            
            {section.subsections && (
              <div className="ml-4 mt-1 space-y-1">
                {section.subsections.map((subsection) => (
                  <button
                    key={subsection.id}
                    onClick={() => scrollToSection(subsection.id)}
                    className={cn(
                      "w-full text-left px-3 py-1 text-xs rounded transition-colors",
                      activeSection === subsection.id
                        ? "bg-primary/20 text-primary"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {subsection.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
} 