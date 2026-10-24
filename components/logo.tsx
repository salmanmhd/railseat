import { cn } from "@/lib/utils";

/** Two rails running to the horizon: the journey, simplified. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="RailSeat" className={cn("shrink-0", className)}>
      <rect width="64" height="64" rx="15" fill="var(--primary)" />
      <g stroke="#fff" strokeLinecap="round" fill="none">
        <path d="M22 54 29 12M42 54 35 12" strokeWidth="4" />
        <path d="M19.7 44h24.6" strokeWidth="3" />
        <path d="M21.7 32h20.6" strokeWidth="3" opacity=".75" />
        <path d="M24.7 20h14.6" strokeWidth="3" opacity=".5" />
      </g>
    </svg>
  );
}
