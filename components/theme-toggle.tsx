"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Laptop } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-8 w-8 rounded-lg bg-muted" />
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Light mode"
        className={`rounded-md p-1.5 transition-colors ${
          theme === "light"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("system")}
        aria-label="System theme"
        className={`rounded-md p-1.5 transition-colors ${
          theme === "system"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Laptop className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Dark mode"
        className={`rounded-md p-1.5 transition-colors ${
          theme === "dark"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
