"use client";

import { ThemeToggle } from "@/components/theme-toggle";

export function ContentHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="flex h-12 items-center justify-between px-6">
        <div className="flex items-baseline gap-3">
          <span className="text-base font-semibold tracking-tight">
            Taking Stock
          </span>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Data Explorer
          </span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
