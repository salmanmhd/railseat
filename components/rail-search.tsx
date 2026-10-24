"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowLeftRight, Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchProgress, SearchResultPayload } from "@/lib/irctc-engine";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Logo } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchResults } from "@/components/search-results";

export interface SearchRequest {
  source: string;
  destination: string;
  /** YYYYMMDD */
  date: string;
  classCode: string;
  preferredTime: string;
  quotaCode: string;
  minCoveragePct: number;
  allowStitch: boolean;
  /** Also look for journeys with one change. */
  connections: boolean;
}

export interface SearchContext {
  onNotice: (message: string | null) => void;
  onProgress: (progress: SearchProgress) => void;
  signal: AbortSignal;
}

export interface FillFields {
  source?: string;
  destination?: string;
  date?: Date;
  classCode?: string;
}

export interface SessionConfig {
  /** Short label shown in the header, e.g. "IRCTC session". */
  label: string;
  /** Content of the panel that opens under the header. */
  render: (fill: (fields: FillFields) => void) => React.ReactNode;
}

interface RailSearchProps {
  /** Runs the search. Throw an Error with a readable message on failure. */
  search: (req: SearchRequest, ctx: SearchContext) => Promise<SearchResultPayload>;
  session?: SessionConfig;
}

const STATION_SUGGESTIONS = [
  ["PNBE", "Patna Junction"],
  ["CDG", "Chandigarh"],
  ["NDLS", "New Delhi"],
  ["DLI", "Delhi Junction"],
  ["ANVT", "Anand Vihar Terminal"],
  ["DDU", "Pt. Deen Dayal Upadhyaya Jn"],
  ["PRYJ", "Prayagraj Junction"],
  ["UMB", "Ambala Cantt"],
  ["HWH", "Howrah Junction"],
];

const TIME_PRESETS = [
  { label: "Any time", value: "" },
  { label: "Morning, 6 am to 12 pm", value: "06:00-12:00" },
  { label: "Afternoon, 12 pm to 6 pm", value: "12:00-18:00" },
  { label: "After 1 pm", value: "after 13:00" },
  { label: "Evening, 6 pm to midnight", value: "18:00-24:00" },
];

const CLASSES = [
  { code: "SL", name: "Sleeper" },
  { code: "3A", name: "3 Tier AC" },
  { code: "3E", name: "3 Tier AC Economy" },
  { code: "2A", name: "2 Tier AC" },
  { code: "1A", name: "First Class AC" },
  { code: "CC", name: "Chair Car" },
  { code: "2S", name: "Second Sitting" },
];

const fieldLabel = "mb-1.5 block text-sm font-medium text-muted-foreground";
const fieldBase =
  "w-full rounded-xl bg-muted px-4 text-foreground transition-colors placeholder:text-muted-foreground/70 hover:bg-muted/70 focus:bg-card focus:outline-2 focus:outline-primary";

export function RailSearch({ search, session }: RailSearchProps) {
  const [source, setSource] = useState("PNBE");
  const [destination, setDestination] = useState("NDLS");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(2026, 9, 24));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [classCodes, setClassCodes] = useState<string[]>(["SL"]);
  const [preferredTime, setPreferredTime] = useState("");
  const [quotaCode] = useState("GN");
  const [minCoveragePct, setMinCoveragePct] = useState(35);
  const [allowStitch] = useState(true);

  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultPayload | null>(null);
  const [runId, setRunId] = useState(0);
  const [connections, setConnections] = useState(true);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [searchedRoute, setSearchedRoute] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [showSession, setShowSession] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const fill = (f: FillFields) => {
    if (f.source) setSource(f.source);
    if (f.destination) setDestination(f.destination);
    if (f.date) setSelectedDate(f.date);
    if (f.classCode) setClassCodes([f.classCode]);
  };

  const swapStations = () => {
    setSource(destination);
    setDestination(source);
  };

  const handleSearch = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);
    setErrorMsg(null);
    setResults(null);
    setProgress(null);
    setRunId((n) => n + 1);
    setSearchedRoute(
      `${source} to ${destination} · ${selectedDate ? format(selectedDate, "EEE, d MMM") : ""} · ${classCodes
        .map((code) => CLASSES.find((c) => c.code === code)?.name ?? code)
        .join(" & ")}`,
    );
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    const dateStr = selectedDate ? format(selectedDate, "yyyyMMdd") : "20261024";

    try {
      const parts: SearchResultPayload[] = [];
      for (const classCode of classCodes) {
        const className = CLASSES.find((c) => c.code === classCode)?.name ?? classCode;
        const prefix = classCodes.length > 1 ? `${className}: ` : "";
        const res = await search(
          {
            source,
            destination,
            date: dateStr,
            classCode,
            preferredTime,
            quotaCode,
            minCoveragePct,
            allowStitch,
            connections,
          },
          {
            onNotice: setNotice,
            signal: controller.signal,
            onProgress: (p) => {
              setProgress({ label: prefix + PHASE_LABELS[p.phase], done: p.done, total: p.total });
              setResults(mergeResults([...parts, p.partial]));
            },
          },
        );
        parts.push(res);
        setResults(mergeResults(parts));
        if (res.cancelled) break;
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong while searching.");
    } finally {
      setIsSearching(false);
      setNotice(null);
      setProgress(null);
      abortRef.current = null;
    }
  };

  const windowLabel =
    TIME_PRESETS.find((p) => p.value === preferredTime)?.label.split(",")[0] ??
    (preferredTime || "Any time");
  const total = results ? results.matchesTime.length + results.outsideTime.length + results.worstCase.length : 0;

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground selection:bg-primary selection:text-white">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="text-base font-semibold tracking-tight">RailSeat</span>
          </div>

          <div className="flex items-center gap-2">
            {session && (
              <button
                type="button"
                onClick={() => setShowSession(!showSession)}
                aria-expanded={showSession}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {session.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showSession && "rotate-180")} aria-hidden />
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-5 pt-8 sm:pt-14">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Find a confirmed seat.</h1>
          <p className="text-lg text-muted-foreground">
            Pick your route and date. We check every train and show where a seat is confirmed.
          </p>
        </div>

        {session && showSession && (
          <div className="rounded-2xl bg-card p-5 animate-in fade-in-50 slide-in-from-top-2 duration-200">
            {session.render(fill)}
          </div>
        )}

        {/* Search form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isSearching) handleSearch();
          }}
          className="space-y-5 rounded-2xl bg-card p-5 sm:p-6"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-1.5 sm:gap-3">
            <div>
              <label htmlFor="from" className={fieldLabel}>
                From
              </label>
              <input
                id="from"
                list="stations"
                value={source}
                onChange={(e) => setSource(e.target.value.toUpperCase())}
                placeholder="Station code"
                autoComplete="off"
                className={cn(fieldBase, "h-12 text-lg font-semibold")}
              />
            </div>

            <button
              type="button"
              onClick={swapStations}
              aria-label="Swap stations"
              className="flex h-12 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
            </button>

            <div>
              <label htmlFor="to" className={fieldLabel}>
                To
              </label>
              <input
                id="to"
                list="stations"
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                placeholder="Station code"
                autoComplete="off"
                className={cn(fieldBase, "h-12 text-lg font-semibold")}
              />
            </div>
            <datalist id="stations">
              {STATION_SUGGESTIONS.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </datalist>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={fieldLabel}>Date</span>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className={cn(fieldBase, "flex h-11 items-center gap-2 text-left text-sm")}>
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {selectedDate ? format(selectedDate, "EEE, d MMM yyyy") : "Pick a date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => {
                      if (d) {
                        setSelectedDate(d);
                        setIsCalendarOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <ClassPicker value={classCodes} onChange={setClassCodes} />

            <TimePicker value={preferredTime} onChange={setPreferredTime} />
          </div>

          {showMore && (
            <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted/60 p-4">
              <input
                type="checkbox"
                checked={connections}
                onChange={(e) => setConnections(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">Include journeys with one change</span>
                <span className="block text-sm text-muted-foreground">
                  Finds two trains with seats confirmed on both. Uses more requests, so searches take longer.
                </span>
              </span>
            </label>
            <div className="rounded-xl bg-muted/60 p-4">
              <div className="flex items-baseline justify-between gap-4">
                <label htmlFor="coverage" className="text-sm font-medium">
                  Minimum trip covered
                </label>
                <span className="text-sm font-semibold tabular-nums">{minCoveragePct}%</span>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                Hide rides that cover less than this share of your journey. Lower it to see more partial options.
              </p>
              <input
                id="coverage"
                type="range"
                min={20}
                max={90}
                step={5}
                value={minCoveragePct}
                onChange={(e) => setMinCoveragePct(Number(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-sm bg-border accent-primary"
              />
            </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setShowMore(!showMore)}
              aria-expanded={showMore}
              className="flex items-center gap-1 rounded-lg py-1.5 text-sm font-medium text-primary hover:opacity-80"
            >
              {showMore ? "Fewer options" : "More options"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")} aria-hidden />
            </button>

            <button
              type="submit"
              disabled={isSearching || !source || !destination}
              className="flex h-11 min-w-36 items-center justify-center rounded-xl bg-primary px-6 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSearching ? "Searching…" : "Search"}
            </button>
          </div>
        </form>

        <div ref={resultsRef} className="scroll-mt-20 space-y-6 empty:hidden">
          {errorMsg && (
            <div role="alert" className="rounded-2xl bg-card p-5">
              <h2 className="text-base font-semibold text-destructive">We couldn&apos;t complete the search</h2>
              <p className="mt-1 text-sm text-muted-foreground">{errorMsg}</p>
            </div>
          )}

          {isSearching && (
            <div className="space-y-2" role="status">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">
                  {notice ??
                    (progress
                      ? `${progress.label}${progress.total > 0 ? ` · ${progress.done} of ${progress.total}` : ""}`
                      : "Starting…")}
                </span>
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="shrink-0 rounded-lg px-2 py-1 font-medium text-primary hover:bg-primary/10"
                >
                  Stop
                </button>
              </div>
              <div className="h-1 overflow-hidden rounded-sm bg-muted">
                <div
                  className="h-full rounded-sm bg-primary transition-[width] duration-300"
                  style={{ width: `${progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 4}%` }}
                />
              </div>
            </div>
          )}

          {isSearching && !results && <ResultsSkeleton />}

          {results && (
            <>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {total === 0
                    ? isSearching
                      ? "Searching…"
                      : "No seats found"
                    : `${total} ${total === 1 ? "option" : "options"}${isSearching ? " so far" : ""}`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {searchedRoute} · {results.trainsAnalyzed} {results.trainsAnalyzed === 1 ? "train" : "trains"} checked
                </p>
                {!isSearching && results.truncated && (
                  <p className="mt-1 text-sm text-warning">
                    Stopped at the request limit to avoid overloading IRCTC, so some trains were not fully checked.
                  </p>
                )}
                {!isSearching && results.cancelled && (
                  <p className="mt-1 text-sm text-muted-foreground">Search stopped. Showing what was found so far.</p>
                )}
              </div>
              <SearchResults
                key={runId}
                results={results}
                windowLabel={windowLabel}
                minCoveragePct={minCoveragePct}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const MAX_CLASSES = 2;

const PHASE_LABELS: Record<SearchProgress["phase"], string> = {
  direct: "Checking trains",
  deep: "Looking for partial rides",
  connections: "Looking for journeys with one change",
};

function PickerTrigger({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <DropdownMenuTrigger asChild>
        <button id={id} type="button" className={cn(fieldBase, "flex h-11 items-center justify-between gap-2 text-left text-sm")}>
          <span className="truncate">{children}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
    </div>
  );
}

function ClassPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const full = value.length >= MAX_CLASSES;
  const summary = value.map((code) => CLASSES.find((c) => c.code === code)?.name ?? code).join(", ");

  return (
    <DropdownMenu>
      <PickerTrigger id="class" label="Class">
        {summary}
      </PickerTrigger>
      <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
        <DropdownMenuLabel>Choose up to {MAX_CLASSES}</DropdownMenuLabel>
        {CLASSES.map((c) => {
          const checked = value.includes(c.code);
          return (
            <DropdownMenuCheckboxItem
              key={c.code}
              checked={checked}
              disabled={!checked && full}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(on) => {
                if (on) onChange([...value, c.code]);
                else if (value.length > 1) onChange(value.filter((v) => v !== c.code));
              }}
            >
              {c.name} ({c.code})
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const current = TIME_PRESETS.find((p) => p.value === value)?.label ?? value;

  return (
    <DropdownMenu>
      <PickerTrigger id="time" label="Leaving">
        {current}
      </PickerTrigger>
      <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {TIME_PRESETS.map((p) => (
            <DropdownMenuRadioItem key={p.label} value={p.value}>
              {p.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function mergeResults(parts: SearchResultPayload[]): SearchResultPayload {
  return {
    matchesTime: parts.flatMap((p) => p.matchesTime),
    outsideTime: parts.flatMap((p) => p.outsideTime),
    worstCase: parts.flatMap((p) => p.worstCase),
    totalApiCalls: parts.reduce((n, p) => n + p.totalApiCalls, 0),
    trainsAnalyzed: parts.reduce((n, p) => n + p.trainsAnalyzed, 0),
    preferredTimeWindow: parts[0]?.preferredTimeWindow,
    truncated: parts.some((p) => p.truncated),
    cancelled: parts.some((p) => p.cancelled),
  };
}

function ResultsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Searching">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-4 p-6">
            <div className="flex justify-between">
              <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
              <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
            <div className="h-1.5 w-full animate-pulse rounded-sm bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
