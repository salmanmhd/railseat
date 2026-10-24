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
      <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
    );
  }

  return (
    <div className="flex items-center p-0.5 rounded-full bg-neutral-200/60 dark:bg-neutral-800/80 border border-black/[0.04] dark:border-white/[0.06] backdrop-blur">
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Light mode"
        className={`p-1.5 rounded-full transition-all duration-200 ${
          theme === "light"
            ? "bg-white text-neutral-900 shadow-sm shadow-black/5"
            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
        }`}
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("system")}
        aria-label="System theme"
        className={`p-1.5 rounded-full transition-all duration-200 ${
          theme === "system"
            ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm shadow-black/5"
            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
        }`}
      >
        <Laptop className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Dark mode"
        className={`p-1.5 rounded-full transition-all duration-200 ${
          theme === "dark"
            ? "bg-neutral-700 text-white shadow-sm shadow-black/5"
            : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
        }`}
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
