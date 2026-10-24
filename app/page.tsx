"use client";

import { useRef, useState } from "react";
import { format, parse } from "date-fns";
import { ArrowLeftRight, Calendar as CalendarIcon, ChevronDown, Train } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCurlCommand } from "@/lib/curl-parser";
import type { SearchResultPayload } from "@/lib/irctc-engine";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchResults } from "@/components/search-results";

const DEFAULT_SAMPLE_CURL = `curl --url 'https://www.irctc.co.in/eticketing/protected/mapps1/avlFarenquiry/13052/20261025/CDG/DLI/SL/GN/N' \\
  -H 'accept: application/json, text/plain, */*' \\
  -H 'accept-language: en-US,en;q=0.0' \\
  -H 'bmirak: webbm' \\
  -H 'content-language: en' \\
  -H 'content-type: application/json; charset=UTF-8' \\
  -b $'TS01aeac8e=01d83d9ce72b50de06c9b8309c1bcc3ab590bc73ce66e99c2d73cb00b41ead74d888b81cacf6182e1fe2045453566127bb97d088a6; ngetAppId=y0hsmyCxVaH7M-PxieyAqfXEuvEwtdCvHi42dx8ny0ELWtcrGU_3!597608025; PIM-SESSION-ID=HwkmP4ENc76bEk7X; et_appVIP1=1093160458.17183.0000; _ga=GA1.1.390380682.1792068783; TS018d84e5=01d83d9ce7cd358fbd45c383770b421f3536a8f839baab9d8866d67713ad473adb3ea14ec1e2db97ae8a83b5811b2ae6d31f939bac; bm_sz=1D6AC928FF8DA669478CFD8AC9642C83~YAAQ5QFAFzqViWWhAQAAkB+ZbAHpCZZem7etfzREpnEnviLJR/h2yvLgzmTx7BwSL0q6xizUa9Fa2BViIxj4QufcSVJaBQqr9FJSwxnNdCsUj2IZcAD9MD9J1sciuclodbLY1rXxxD5GqEASbxgruiNrMmO6X0sXqgFehEAQ8E2Ex1AAZAYV7GczMVb+vJqVolNCO826lSc0S/+LpYPlbIiUM7kxwtSdjmUJvddqbSOFvnroG8/5UGmMU5I2IVuYR88aSmdLIDtiho55DxPLY62HFn8XzqhcHCWaP6IPor7fUJfch6Wg2xrkGFCV1dBcQR2H1mBuReBIcOTiNnOVZ8GgKTMql1Ol9Qd8ix942DK2YKyCl3HdtKP+7dbFQeMNA/aI0AZkhjO/XBv8cMLHM5Yv~3225913~3487793; _abck=EB06DEEFAF8E9B0163C0FB28D3A1DF7E~-1~YAAQ5QFAF4h3imWhAQAAf0KcbBA/zjP+8paBIgu5EtAL+mGq6B7LF9A0A7lg2Lb1+bxhHEK3iY/iD7OVEtZawpKhExWNCSem3yDLoDQzv+cIQNvwosh59M307++75GO8t63tV35anAvaE2A2lI10ieStAiqeq/XVgWpYwhUGjZuV0HYVLt2HztUAhZb/3j8/RNNXriZszO1/3o7Kw0eaqvVkNcU4jT2tUkxl+OPeqYmjmem02X1J8RJF/4hb7YXJRK2+5aaFGMAjpgJYpyzhLIdV9uEZs7XqPTXBt+k8UDQW19QRA0IMnbBJ9f2R/nRot95kHqnzdUTVibwucAjcyPolgP8yXMSQi9Gu+knS+WLbIBjDZfQ0mS92fw3sYloYKUDXEQvuEYJEfBBMYrivCgx/1dDVrY3ZFmsdZuxVQwne0VG9ZhAUPFUZ10CVtxg8A5DIYPFCYgEslSGPfAu9ZWv2aDPdIfFnDfvUiRDbSOBNMqODLZpXv0PpJCwHWJDErMUTtF1xhdw/bDPqiQlBDoQy8BbJfUj7V9VxsST0nBVCaH4BgWBt1nlaBN3F3ByXafeKgBE8C3okkEF7cqFgmb7mVzV6WAyfzIDft83Pn/2Xo7gAj4b9xMmZhxVh/iMWkmxAFVwC7AljM73fCWF4G5CuJsIBIWHG+/si3dxoRLqVVBKFBNbU3hvW0vJb7LlcQaFfQ8N5FJWisQ==~-1~-1~1792826937~AAQAAAAG%2f%2f%2f%2f%2f0AnR6sxNuT%2fE8F%2foq+GGpwgyWhW1qdP+FQIlIJdU9lTC%2fYHIFzN9xfJ8Rn1+ENokRCIpr4ncWHCyYJiUwGW0fL4bH77wNIN1cx6~1792823602' \\
  -H 'greq: 1792823339143:ea49505c-a714-4233-a715-fe297699a86b' \\
  -H 'origin: https://www.irctc.co.in' \\
  -H 'referer: https://www.irctc.co.in/nget/booking/train-list' \\
  -H 'sec-ch-ua: "Microsoft Edge";v="155", "Chromium";v="155", "Not(A:Brand";v="24"' \\
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0' \\
  --data-raw '{"paymentFlag":"N","concessionBooking":false,"ftBooking":false,"loyaltyRedemptionBooking":false,"ticketType":"E","quotaCode":"GN","moreThanOneDay":true,"returnJourney":false,"trainNumber":"13052","fromStnCode":"CDG","toStnCode":"DLI","isLogedinReq":false,"journeyDate":"20261025","classCode":"SL"}'`;

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

export default function Home() {
  const [curlInput, setCurlInput] = useState(DEFAULT_SAMPLE_CURL);
  const [source, setSource] = useState("PNBE");
  const [destination, setDestination] = useState("NDLS");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(2026, 9, 24));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [classCode, setClassCode] = useState("SL");
  const [preferredTime, setPreferredTime] = useState("after 13:00");
  const [quotaCode] = useState("GN");
  const [minCoveragePct, setMinCoveragePct] = useState(35);
  const [allowStitch] = useState(true);

  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultPayload | null>(null);
  const [searchCount, setSearchCount] = useState(0);
  const [searchedRoute, setSearchedRoute] = useState("");
  const [showCurlDrawer, setShowCurlDrawer] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleCurlChange = (val: string) => {
    setCurlInput(val);
    try {
      const parsed = parseCurlCommand(val);
      if (parsed.detectedParams?.fromStnCode) setSource(parsed.detectedParams.fromStnCode);
      if (parsed.detectedParams?.toStnCode) setDestination(parsed.detectedParams.toStnCode);
      if (parsed.detectedParams?.journeyDate && /^\d{8}$/.test(parsed.detectedParams.journeyDate)) {
        const d = parse(parsed.detectedParams.journeyDate, "yyyyMMdd", new Date());
        if (!isNaN(d.getTime())) setSelectedDate(d);
      }
      if (parsed.detectedParams?.classCode) setClassCode(parsed.detectedParams.classCode);
    } catch {
      // ignore parse error
    }
  };

  const swapStations = () => {
    setSource(destination);
    setDestination(source);
  };

  const handleSearch = async () => {
    setIsSearching(true);
    setErrorMsg(null);
    setResults(null);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    const dateStr = selectedDate ? format(selectedDate, "yyyyMMdd") : "20261024";

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curlInput,
          source,
          destination,
          date: dateStr,
          classCode,
          preferredTime,
          quotaCode,
          minCoveragePct,
          allowStitch,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.message || "Failed to search train seats.");
      } else {
        setResults(json.data);
        setSearchCount((n) => n + 1);
        setSearchedRoute(
          `${source} to ${destination} · ${selectedDate ? format(selectedDate, "EEE, d MMM") : ""} · ${
            CLASSES.find((c) => c.code === classCode)?.name ?? classCode
          }`,
        );
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Network error contacting local search API.");
    } finally {
      setIsSearching(false);
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <Train className="h-4 w-4" aria-hidden />
            </div>
            <span className="text-base font-semibold tracking-tight">RailSeat</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCurlDrawer(!showCurlDrawer)}
              aria-expanded={showCurlDrawer}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              IRCTC session
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showCurlDrawer && "rotate-180")} aria-hidden />
            </button>
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

        {showCurlDrawer && (
          <div className="space-y-3 rounded-2xl bg-card p-5 animate-in fade-in-50 slide-in-from-top-2 duration-200">
            <div>
              <h2 className="text-base font-semibold">IRCTC session</h2>
              <p className="text-sm text-muted-foreground">
                Paste a recent request copied from your browser&apos;s Network tab (Copy as cURL). Your route, date and
                class are filled in from it.
              </p>
            </div>
            <textarea
              rows={4}
              value={curlInput}
              onChange={(e) => handleCurlChange(e.target.value)}
              placeholder="curl --url 'https://www.irctc.co.in/...' -b '...'"
              className={cn(fieldBase, "resize-none py-3 font-mono text-xs")}
            />
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
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
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
              className="mx-auto flex h-12 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeftRight className="h-4 w-4 rotate-90 md:rotate-0" aria-hidden />
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

          <div className="grid gap-3 sm:grid-cols-3">
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

            <SelectField id="class" label="Class" value={classCode} onChange={setClassCode}>
              {CLASSES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </SelectField>

            <SelectField id="time" label="Leaving" value={preferredTime} onChange={setPreferredTime}>
              {TIME_PRESETS.map((p) => (
                <option key={p.label} value={p.value}>
                  {p.label}
                </option>
              ))}
              {!TIME_PRESETS.some((p) => p.value === preferredTime) && (
                <option value={preferredTime}>{preferredTime}</option>
              )}
            </SelectField>
          </div>

          {showMore && (
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

          {isSearching && <ResultsSkeleton />}

          {results && (
            <>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {total === 0 ? "No seats found" : `${total} ${total === 1 ? "option" : "options"}`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {searchedRoute} · {results.trainsAnalyzed} trains checked
                </p>
              </div>
              <SearchResults
                key={searchCount}
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

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(fieldBase, "h-11 cursor-pointer appearance-none pr-10 text-sm")}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>
    </div>
  );
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
