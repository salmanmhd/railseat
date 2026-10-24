"use client";

import React, { useState, useEffect } from "react";
import { format, parse } from "date-fns";
import {
  Train,
  Clock,
  Calendar as CalendarIcon,
  ArrowRight,
  ArrowLeftRight,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  Sliders,
  ChevronDown,
  ChevronUp,
  MapPin,
  Ticket,
  ExternalLink,
  Search,
  RotateCcw,
  Armchair,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCurlCommand } from "@/lib/curl-parser";
import { SearchOption, SearchResultPayload } from "@/lib/irctc-engine";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

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

const POPULAR_ORIGINS = ["PNBE", "CDG", "NDLS", "DDU", "UMB", "HWH"];
const POPULAR_DESTINATIONS = ["NDLS", "DLI", "ANVT", "PNBE", "CDG", "PRYJ"];

const TIME_PRESETS = [
  { label: "Any Time", value: "" },
  { label: "Morning (06–12)", value: "06:00-12:00" },
  { label: "Afternoon (12–18)", value: "after 12:00" },
  { label: "Post 13:00", value: "after 13:00" },
  { label: "Evening (18–24)", value: "after 18:00" },
];

const CLASSES = [
  { code: "SL", name: "Sleeper" },
  { code: "3A", name: "3 Tier AC" },
  { code: "3E", name: "AC Economy" },
  { code: "2A", name: "2 Tier AC" },
  { code: "1A", name: "1st Class AC" },
  { code: "CC", name: "Chair Car" },
  { code: "2S", name: "2nd Sitting" },
];

export default function Home() {
  const [curlInput, setCurlInput] = useState(DEFAULT_SAMPLE_CURL);
  const [source, setSource] = useState("PNBE");
  const [destination, setDestination] = useState("NDLS");

  // Default to today
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(2026, 9, 24));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [classCode, setClassCode] = useState("SL");
  const [preferredTime, setPreferredTime] = useState("after 13:00");
  const [quotaCode, setQuotaCode] = useState("GN");
  const [minCoveragePct, setMinCoveragePct] = useState(35);
  const [allowStitch, setAllowStitch] = useState(true);

  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultPayload | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCurlDrawer, setShowCurlDrawer] = useState(false);
  const [cookieActive, setCookieActive] = useState(true);

  // Auto-parse on cURL change
  const handleCurlChange = (val: string) => {
    setCurlInput(val);
    try {
      const parsed = parseCurlCommand(val);
      if (parsed.cookie) {
        setCookieActive(true);
      }
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
    const temp = source;
    setSource(destination);
    setDestination(temp);
  };

  const handleSearch = async () => {
    setIsSearching(true);
    setErrorMsg(null);

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
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Network error contacting local search API.");
    } finally {
      setIsSearching(false);
    }
  };

  const copyTrainNumber = (opt: SearchOption) => {
    navigator.clipboard.writeText(opt.trainNo);
    setCopiedId(`${opt.trainNo}-${opt.boardStn}-${opt.alightStn}`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black text-neutral-900 dark:text-neutral-50 transition-colors duration-300 font-sans selection:bg-blue-600 selection:text-white pb-28">
      {/* Apple-style Frosted Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-2xl bg-white/75 dark:bg-black/75 border-b border-black/[0.06] dark:border-white/[0.08] transition-colors">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          {/* Logo / Product Name */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Train className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight text-neutral-900 dark:text-white">
                  RailSeat
                </span>
                <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-normal">
                Intelligent IRCTC Frontier Seat Discovery
              </p>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCurlDrawer(!showCurlDrawer)}
              className="text-xs font-medium px-3 py-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-white/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>IRCTC Session</span>
              <ChevronDown className={`h-3 w-3 text-neutral-400 transition-transform ${showCurlDrawer ? "rotate-180" : ""}`} />
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-8 pt-8 space-y-6">
        {/* Collapsible Session Drawer */}
        {showCurlDrawer && (
          <div className="rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl p-5 shadow-sm space-y-3 transition-all animate-in fade-in-50 slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Active cURL & Session Cookies
                </span>
              </div>
              <span className="text-[11px] text-neutral-400">Paste your latest DevTools request</span>
            </div>
            <textarea
              rows={4}
              value={curlInput}
              onChange={(e) => handleCurlChange(e.target.value)}
              placeholder="curl --url 'https://www.irctc.co.in/...' -b '...'"
              className="w-full rounded-2xl bg-neutral-100/80 dark:bg-neutral-950/80 border border-black/[0.05] dark:border-white/[0.08] p-3 text-xs font-mono text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none transition-all"
            />
          </div>
        )}

        {/* Main Apple Search Console Card */}
        <div className="rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] space-y-6">
          {/* Station Inputs Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            {/* Origin Station */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-500" />
                Origin Station
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value.toUpperCase())}
                  placeholder="e.g. PNBE, CDG, NDLS"
                  className="w-full bg-neutral-100/80 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 focus:bg-white dark:focus:bg-neutral-800 rounded-2xl px-4 py-3 text-lg font-bold text-neutral-900 dark:text-white uppercase tracking-wider border border-transparent focus:border-blue-500/30 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {POPULAR_ORIGINS.map((stn) => (
                  <button
                    key={stn}
                    type="button"
                    onClick={() => setSource(stn)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-all ${
                      source === stn
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {stn}
                  </button>
                ))}
              </div>
            </div>

            {/* Station Swap Button (Desktop Centered) */}
            <div className="hidden md:flex absolute left-1/2 top-9 -translate-x-1/2 z-10">
              <button
                type="button"
                onClick={swapStations}
                title="Swap stations"
                className="h-9 w-9 rounded-full bg-white dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.1] shadow-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-blue-600 hover:scale-105 active:scale-95 transition-all"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Destination Station */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                Destination Station
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value.toUpperCase())}
                  placeholder="e.g. NDLS, DLI, ANVT"
                  className="w-full bg-neutral-100/80 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 focus:bg-white dark:focus:bg-neutral-800 rounded-2xl px-4 py-3 text-lg font-bold text-neutral-900 dark:text-white uppercase tracking-wider border border-transparent focus:border-blue-500/30 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {POPULAR_DESTINATIONS.map((stn) => (
                  <button
                    key={stn}
                    type="button"
                    onClick={() => setDestination(stn)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-all ${
                      destination === stn
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {stn}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Secondary Controls: Date, Class, Departure Time Window */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* Journey Date Picker */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-emerald-500" />
                Journey Date
              </label>
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-neutral-900 shadow-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                    </span>
                  </Button>
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

            {/* Travel Class Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5 text-amber-500" />
                Travel Class
              </label>
              <div className="relative">
                <select
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  className="w-full appearance-none bg-neutral-100/80 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 rounded-2xl px-4 py-2.5 font-medium text-sm text-neutral-900 dark:text-white transition-all border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer pr-10"
                >
                  {CLASSES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4 text-neutral-400 absolute right-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Departure Preference */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                Departure Window
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  placeholder="e.g. after 13:00"
                  className="w-full bg-neutral-100/80 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 focus:bg-white dark:focus:bg-neutral-800 rounded-2xl px-4 py-2.5 font-medium text-sm text-neutral-900 dark:text-white border border-transparent focus:border-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Quick Departure Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="text-[11px] mr-1">Time presets:</span>
            {TIME_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPreferredTime(p.value)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                  preferredTime === p.value
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Coverage Slider & Action Trigger */}
          <div className="pt-4 border-t border-black/[0.04] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            {/* Slider */}
            <div className="space-y-2 flex-1 max-w-md">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-neutral-600 dark:text-neutral-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Sliders className="h-3 w-3 text-neutral-400" />
                  Min Distance Coverage
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs">
                  {minCoveragePct}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={90}
                step={5}
                value={minCoveragePct}
                onChange={(e) => setMinCoveragePct(Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>20% (Short transfers)</span>
                <span>50% (Half journey)</span>
                <span>80% (Near direct)</span>
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-7 py-2.5 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              {isSearching ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Scanning IRCTC...</span>
                </>
              ) : (
                <span>Find Available Seats</span>
              )}
            </button>
          </div>
        </div>

        {/* Error Alert Card */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-600 dark:text-red-400 text-sm flex items-start gap-3 animate-in fade-in-50">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-xs tracking-wide uppercase">Enquiry Notice</p>
              <p className="text-xs leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Results Presentation */}
        {results && (
          <div className="space-y-8 animate-in fade-in-50 duration-300">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-black/[0.05] dark:border-white/[0.06] bg-white/60 dark:bg-neutral-900/60 p-4 backdrop-blur shadow-xs">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  In-Window Confirmed
                </span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {results.matchesTime.length}
                </p>
              </div>

              <div className="rounded-2xl border border-black/[0.05] dark:border-white/[0.06] bg-white/60 dark:bg-neutral-900/60 p-4 backdrop-blur shadow-xs">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Outside Window
                </span>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {results.outsideTime.length}
                </p>
              </div>

              <div className="rounded-2xl border border-black/[0.05] dark:border-white/[0.06] bg-white/60 dark:bg-neutral-900/60 p-4 backdrop-blur shadow-xs">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Transfer Fallbacks
                </span>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {results.worstCase.length}
                </p>
              </div>

              <div className="rounded-2xl border border-black/[0.05] dark:border-white/[0.06] bg-white/60 dark:bg-neutral-900/60 p-4 backdrop-blur shadow-xs">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  IRCTC API Calls
                </span>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                  {results.totalApiCalls}
                </p>
              </div>
            </div>

            {/* Section 1: In-Window Matches */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Matches Your Preferred Departure {preferredTime ? `(${preferredTime})` : "(Any Time)"}
                  </h2>
                </div>
                <span className="text-xs text-neutral-400 font-medium">
                  &gt;{minCoveragePct}% Route Coverage
                </span>
              </div>

              {results.matchesTime.length === 0 ? (
                <div className="rounded-2xl border border-black/[0.05] dark:border-white/[0.06] bg-white/60 dark:bg-neutral-900/60 p-5 text-sm text-neutral-500 dark:text-neutral-400 space-y-1">
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                    No confirmed ticket met the &gt;{minCoveragePct}% threshold departing inside your window.
                  </p>
                  <p className="text-xs text-neutral-400">
                    Direct trains are waitlisted. Lower your distance coverage slider to 30% or explore confirmed options below.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {results.matchesTime.map((opt, i) => (
                    <AppleOptionCard
                      key={i}
                      opt={opt}
                      onCopy={() => copyTrainNumber(opt)}
                      isCopied={copiedId === `${opt.trainNo}-${opt.boardStn}-${opt.alightStn}`}
                      badgeVariant="emerald"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Outside Preferred Time */}
            {results.outsideTime.length > 0 && (
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Alternative Departure Times
                  </h2>
                  <span className="text-xs text-neutral-400 font-normal">
                    (Confirmed high-coverage options)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  {results.outsideTime.map((opt, i) => (
                    <AppleOptionCard
                      key={i}
                      opt={opt}
                      onCopy={() => copyTrainNumber(opt)}
                      isCopied={copiedId === `${opt.trainNo}-${opt.boardStn}-${opt.alightStn}`}
                      badgeVariant="blue"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Section 3: Worst-Case Fallbacks */}
            {results.worstCase.length > 0 && (
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-amber-500" />
                  <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Transfer & Fallback Connections
                  </h2>
                  <span className="text-xs text-neutral-400 font-normal">
                    (&lt;{minCoveragePct}% partial segments)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {results.worstCase.map((opt, i) => (
                    <AppleOptionCard
                      key={i}
                      opt={opt}
                      compact
                      onCopy={() => copyTrainNumber(opt)}
                      isCopied={copiedId === `${opt.trainNo}-${opt.boardStn}-${opt.alightStn}`}
                      badgeVariant="amber"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function AppleOptionCard({
  opt,
  onCopy,
  isCopied,
  badgeVariant,
  compact = false,
}: {
  opt: SearchOption;
  onCopy: () => void;
  isCopied: boolean;
  badgeVariant: "emerald" | "blue" | "amber";
  compact?: boolean;
}) {
  const isAvailable = opt.status.startsWith("AVAILABLE") || opt.status.startsWith("CURR_AVBL");

  return (
    <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl p-5 hover:border-black/[0.12] dark:hover:border-white/[0.16] shadow-xs hover:shadow-md transition-all duration-200 space-y-4">
      {/* Header: Train Number, Name, Class & Price */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-neutral-900 dark:text-white">
              {opt.trainNo}
            </span>
            <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {opt.trainName}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
              {opt.classCode}
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Boarding Departure: <strong className="text-neutral-800 dark:text-neutral-200">{opt.boardTime}</strong>
          </p>
        </div>

        {/* Status & Fare */}
        <div className="text-right">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              isAvailable
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            }`}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-current" />
            {opt.status}
          </div>
          <p className="text-base font-bold text-neutral-900 dark:text-white mt-1">
            {opt.fare}
          </p>
        </div>
      </div>

      {/* Visual Journey Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-blue-500" />
            {opt.boardStn}
          </span>
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
            {opt.coveragePct}% Covered ({opt.coveredDist} / {opt.totalDist} km)
          </span>
          <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
            {opt.alightStn}
            <MapPin className="h-3 w-3 text-emerald-500" />
          </span>
        </div>

        {/* Progress Track */}
        <div className="h-2 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${Math.min(opt.coveragePct, 100)}%` }}
            className={`h-full rounded-full transition-all duration-500 ${
              badgeVariant === "emerald"
                ? "bg-emerald-500"
                : badgeVariant === "blue"
                ? "bg-blue-600"
                : "bg-amber-500"
            }`}
          />
        </div>
      </div>

      {/* Journey Duration Split: Reserved Seat vs Unreserved Travel */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        {/* Reserved Seat Duration */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12] border border-emerald-500/20">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Armchair className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Reserved Seat
            </p>
            <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
              {opt.reservedDuration || "—"}
            </p>
          </div>
        </div>

        {/* Unreserved Travel Duration */}
        <div
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${
            opt.unreservedDuration?.startsWith("0m")
              ? "bg-neutral-100/60 dark:bg-neutral-800/40 border-neutral-200/60 dark:border-neutral-800/60 text-neutral-500"
              : "bg-amber-500/[0.08] dark:bg-amber-500/[0.12] border-amber-500/20"
          }`}
        >
          <div
            className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
              opt.unreservedDuration?.startsWith("0m")
                ? "bg-neutral-200/60 dark:bg-neutral-700/50"
                : "bg-amber-500/20"
            }`}
          >
            <Clock
              className={`h-4 w-4 ${
                opt.unreservedDuration?.startsWith("0m")
                  ? "text-neutral-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            />
          </div>
          <div className="min-w-0">
            <p
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                opt.unreservedDuration?.startsWith("0m")
                  ? "text-neutral-500 dark:text-neutral-400"
                  : "text-amber-700 dark:text-amber-300"
              }`}
            >
              Unreserved Travel
            </p>
            <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
              {opt.unreservedDuration?.startsWith("0m") ? "0m (Full Journey)" : opt.unreservedDuration}
            </p>
          </div>
        </div>
      </div>

      {/* Note & Action Footer */}
      <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <p className="text-neutral-600 dark:text-neutral-400 font-normal leading-relaxed">
          {opt.note}
        </p>

        <button
          onClick={onCopy}
          title={`Copy Train #${opt.trainNo}`}
          className="shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
        >
          {isCopied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Copied #{opt.trainNo}
              </span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 text-neutral-400" />
              <span>Copy #{opt.trainNo}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
