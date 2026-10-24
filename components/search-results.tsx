"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchOption, SearchResultPayload } from "@/lib/irctc-engine";

type TabKey = "window" | "other" | "partial";

type Tone = "good" | "warn" | "muted";

function describeStatus(raw: string): { label: string; tone: Tone } {
  const upper = raw.toUpperCase();
  if (upper.startsWith("AVAILABLE") || upper.startsWith("CURR_AVBL")) {
    const seats = parseInt(raw.match(/-\s*(\d+)/)?.[1] ?? "", 10);
    return { label: seats > 0 ? `${seats} seats available` : "Available", tone: "good" };
  }
  if (upper.includes("RAC")) return { label: raw, tone: "warn" };
  if (upper.includes("WL")) return { label: `Waitlist · ${raw}`, tone: "warn" };
  return { label: raw, tone: "muted" };
}

const toneClass: Record<Tone, string> = {
  good: "text-success",
  warn: "text-warning",
  muted: "text-muted-foreground",
};

const optionKey = (o: SearchOption) => `${o.trainNo}-${o.boardStn}-${o.alightStn}-${o.boardTime}`;

export function SearchResults({
  results,
  windowLabel,
  minCoveragePct,
}: {
  results: SearchResultPayload;
  windowLabel: string;
  minCoveragePct: number;
}) {
  const tabs: { key: TabKey; label: string; items: SearchOption[]; hint: string; empty: string }[] = [
    {
      key: "window",
      label: windowLabel,
      items: results.matchesTime,
      hint: `Seats that are confirmed on trains leaving ${windowLabel.toLowerCase()}, covering more than ${minCoveragePct}% of your trip.`,
      empty: `No confirmed seat found ${windowLabel.toLowerCase()}. Try another departure time, or lower the minimum trip coverage.`,
    },
    {
      key: "other",
      label: "Other times",
      items: results.outsideTime,
      hint: "Confirmed seats on trains that leave outside your preferred time.",
      empty: "No confirmed seats at other times.",
    },
    {
      key: "partial",
      label: "Partial rides",
      items: results.worstCase,
      hint: `Confirmed seats for part of the trip (under ${minCoveragePct}%). You would need to continue another way.`,
      empty: "No partial rides found.",
    },
  ];

  const firstWithItems = tabs.find((t) => t.items.length > 0)?.key ?? "window";
  const [active, setActive] = useState<TabKey>(firstWithItems);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  const copy = (o: SearchOption) => {
    navigator.clipboard.writeText(o.trainNo);
    setCopiedKey(optionKey(o));
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <section aria-label="Search results" className="space-y-4">
      <div
        role="tablist"
        aria-label="Result groups"
        className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              "flex min-w-0 flex-col items-center rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:flex-row sm:justify-center sm:gap-2",
              active === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="max-w-full truncate">{t.label}</span>
            <span className="tabular-nums text-muted-foreground">{t.items.length}</span>
          </button>
        ))}
      </div>

      <p className="px-1 text-sm text-muted-foreground">{current.hint}</p>

      {current.items.length === 0 ? (
        <div className="rounded-2xl bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {current.empty}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
          {current.items.map((o) => (
            <li key={optionKey(o)}>
              <ResultRow option={o} copied={copiedKey === optionKey(o)} onCopy={() => copy(o)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResultRow({
  option: o,
  copied,
  onCopy,
}: {
  option: SearchOption;
  copied: boolean;
  onCopy: () => void;
}) {
  const status = describeStatus(o.status);
  const fullyUnreserved = !o.unreservedDuration || o.unreservedDuration.startsWith("0m");
  const reservedWidth = Math.max(0, Math.min(o.coveragePct, 100));

  return (
    <article className="space-y-4 p-5 sm:p-6">
      {/* Times and price */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <TimeStop time={o.boardTime} station={o.boardStn} />
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <span className="text-xs tabular-nums">{o.totalDuration}</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </div>
          <TimeStop time={o.alightTime} station={o.alightStn} />
        </div>

        <div className="text-right">
          <p className="text-xl font-semibold tabular-nums">{o.fare}</p>
          <p className={cn("text-sm font-medium", toneClass[status.tone])}>{status.label}</p>
        </div>
      </div>

      {/* Train */}
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{o.trainName}</span>
        <span className="tabular-nums"> · {o.trainNo}</span> · {o.classCode}
      </p>

      {/* Seat coverage */}
      <div className="space-y-2">
        <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
          <div className="h-full rounded-sm bg-primary" style={{ width: `${reservedWidth}%` }} />
        </div>
        <p className="text-sm">
          {fullyUnreserved ? (
            <>
              <span className="font-medium">Reserved seat for the whole trip</span>
              <span className="text-muted-foreground"> · {o.reservedDuration}</span>
            </>
          ) : (
            <>
              <span className="font-medium">Reserved seat for {o.reservedDuration}</span>
              <span className="text-muted-foreground">
                {" "}
                · then {o.unreservedDuration} without one ({o.coveragePct}% of trip covered)
              </span>
            </>
          )}
        </p>
      </div>

      {o.legs && o.legs.length > 0 && (
        <ol className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
          {o.legs.map((leg, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span>
                <span className="tabular-nums">{leg.trainNo}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {leg.from} to {leg.to} · {leg.depTime}
                </span>
              </span>
              <span className="text-muted-foreground">
                {leg.fare} · {leg.status}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Note and action */}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-muted-foreground">{o.note}</p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? "Copied" : "Copy train no."}
        </button>
      </div>
    </article>
  );
}

function TimeStop({ time, station }: { time: string; station: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold leading-none tabular-nums tracking-tight">{time}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">{station}</p>
    </div>
  );
}
