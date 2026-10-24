"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, parse } from "date-fns";
import { ArrowRight, Check, ChevronDown, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchOption, SearchResultPayload } from "@/lib/irctc-engine";
import { waitlistOdds } from "@/lib/waitlist-odds";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TabKey = "window" | "other" | "partial" | "waitlist";
type SortKey = "best" | "cheapest" | "fastest" | "earliest";

type Tone = "good" | "warn" | "muted";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "best", label: "Best match" },
  { key: "cheapest", label: "Cheapest" },
  { key: "fastest", label: "Fastest" },
  { key: "earliest", label: "Earliest departure" },
];

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

const optionKey = (o: SearchOption) => `${o.journeyDate}-${o.trainNo}-${o.boardStn}-${o.alightStn}-${o.boardTime}-${o.classCode}`;

// ---- sorting helpers ----

/** Adds up every rupee amount in a fare string ("₹695", "₹300 + ₹410"). */
function fareValue(fare: string): number {
  const nums = fare.match(/\d[\d,]*(?:\.\d+)?/g)?.map((n) => parseFloat(n.replace(/,/g, "")));
  return nums && nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : Number.POSITIVE_INFINITY;
}

function durationValue(text: string): number {
  const h = text.match(/(\d+)\s*h/i);
  const m = text.match(/(\d+)\s*m/i);
  return h || m ? parseInt(h?.[1] ?? "0", 10) * 60 + parseInt(m?.[1] ?? "0", 10) : Number.POSITIVE_INFINITY;
}

function sortOptions(items: SearchOption[], sort: SortKey, isWaitlist: boolean): SearchOption[] {
  const list = [...items];
  switch (sort) {
    case "cheapest":
      return list.sort((a, b) => fareValue(a.fare) - fareValue(b.fare));
    case "fastest":
      return list.sort((a, b) => durationValue(a.totalDuration) - durationValue(b.totalDuration));
    case "earliest":
      return list.sort((a, b) => (a.journeyDate + a.boardTime).localeCompare(b.journeyDate + b.boardTime));
    default:
      return isWaitlist
        ? list.sort(
            (a, b) =>
              waitlistOdds(b.status, b.prediction).score - waitlistOdds(a.status, a.prediction).score ||
              fareValue(a.fare) - fareValue(b.fare),
          )
        : list;
  }
}

function dayLabel(ymd: string) {
  const d = parse(ymd, "yyyyMMdd", new Date());
  return isNaN(d.getTime()) ? ymd : format(d, "EEE, d MMM");
}

export function SearchResults({
  results,
  windowLabel,
  minCoveragePct,
}: {
  results: SearchResultPayload;
  windowLabel: string;
  minCoveragePct: number;
}) {
  const tabs = useMemo(() => {
    const waitlist = results.waitlist ?? [];
    const list: { key: TabKey; label: string; items: SearchOption[]; hint: string; empty: string }[] = [
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
    if (waitlist.length > 0) {
      list.push({
        key: "waitlist",
        label: "Waitlist",
        items: waitlist,
        hint: "Not confirmed yet. The chance shown is a rough estimate, so treat it as a guide only.",
        empty: "No waitlisted trains.",
      });
      // Four tabs need shorter labels to fit a narrow panel.
      list[1].label = "Other";
      list[2].label = "Partial";
    }
    return list;
  }, [results, windowLabel, minCoveragePct]);

  const firstWithItems = tabs.find((t) => t.items.length > 0)?.key ?? "window";
  const [active, setActive] = useState<TabKey>(firstWithItems);
  const [sort, setSort] = useState<SortKey>("best");
  const userPicked = useRef(false);

  // While results stream in, follow the first tab that has something, until the user picks one.
  const activeIsEmpty = tabs.find((t) => t.key === active)?.items.length === 0;
  useEffect(() => {
    if (!userPicked.current && activeIsEmpty) setActive(firstWithItems);
  }, [activeIsEmpty, firstWithItems]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  const items = useMemo(() => sortOptions(current.items, sort, current.key === "waitlist"), [current, sort]);

  // Show the date on every row once results cover more than one day.
  const showDate = useMemo(() => {
    const dates = new Set<string>();
    for (const t of tabs) for (const o of t.items) dates.add(o.journeyDate);
    return dates.size > 1;
  }, [tabs]);

  const copy = (o: SearchOption) => {
    navigator.clipboard.writeText(o.trainNo.replace(" + ", ", "));
    setCopiedKey(optionKey(o));
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <section aria-label="Search results" className="space-y-4">
      <div
        role="tablist"
        aria-label="Result groups"
        className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active === t.key}
            onClick={() => {
              userPicked.current = true;
              setActive(t.key);
            }}
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

      <div className="flex items-start justify-between gap-3 px-1">
        <p className="text-sm text-muted-foreground">{current.hint}</p>
        {current.items.length > 1 && <SortPicker value={sort} onChange={setSort} />}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {current.empty}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
          {items.map((o) => (
            <li key={optionKey(o)}>
              <ResultRow option={o} showDate={showDate} copied={copiedKey === optionKey(o)} onCopy={() => copy(o)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SortPicker({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const label = SORTS.find((s) => s.key === value)?.label ?? "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Sort: ${label}`}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {label}
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as SortKey)}>
          {SORTS.map((s) => (
            <DropdownMenuRadioItem key={s.key} value={s.key}>
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ResultRow({
  option: o,
  showDate,
  copied,
  onCopy,
}: {
  option: SearchOption;
  showDate: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const status = describeStatus(o.status);
  const isWaitlisted = !o.isStitched && status.tone === "warn";
  const odds = isWaitlisted ? waitlistOdds(o.status, o.prediction) : null;
  const fullyUnreserved = !o.unreservedDuration || o.unreservedDuration.startsWith("0m");
  const reservedWidth = Math.max(0, Math.min(o.coveragePct, 100));

  return (
    <article className="space-y-4 p-5 sm:p-6">
      {showDate && <p className="text-sm font-medium text-muted-foreground">{dayLabel(o.journeyDate)}</p>}

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
          <p className="text-xl font-semibold tabular-nums">{/d/.test(o.fare) ? o.fare : "—"}</p>
          <p className={cn("text-sm font-medium", toneClass[status.tone])}>{status.label}</p>
        </div>
      </div>

      {/* Train */}
      <p className="text-sm text-muted-foreground">
        {o.isStitched ? (
          <>
            <span className="font-medium text-foreground">One change</span> · {o.classCode}
          </>
        ) : (
          <>
            <span className="font-medium text-foreground">{o.trainName}</span>
            <span className="tabular-nums"> · {o.trainNo}</span> · {o.classCode}
          </>
        )}
      </p>

      {/* Seat coverage, one-change summary or waitlist chance */}
      {odds ? (
        <p className="text-sm">
          <span className="font-medium">Chance of confirming: {odds.label}</span>
          <span className="text-muted-foreground"> · {odds.detail}</span>
        </p>
      ) : o.isStitched ? (
        <p className="text-sm">
          <span className="font-medium">Confirmed seats on both trains</span>
          <span className="text-muted-foreground"> · {o.totalDuration} in total</span>
        </p>
      ) : (
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
      )}

      {o.legs && o.legs.length > 0 && (
        <ol className="divide-y divide-border rounded-xl bg-muted/60 text-sm">
          {o.legs.map((leg, i) => {
            const legStatus = describeStatus(leg.status);
            return (
              <li key={i} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="font-medium">{leg.trainName ?? leg.trainNo}</span>
                    <span className="tabular-nums text-muted-foreground"> · {leg.trainNo}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {leg.from} {leg.depTime} to {leg.to}
                    {leg.arrTime ? ` ${leg.arrTime}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular-nums">{leg.fare}</p>
                  <p className={cn(toneClass[legStatus.tone])}>{legStatus.label}</p>
                </div>
              </li>
            );
          })}
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
