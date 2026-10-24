export interface StationStop {
  stationCode: string;
  stationName: string;
  arrivalTime: string;
  departureTime: string;
  haltTime: string;
  distance: string;
  dayCount: string;
  stnSerialNumber: string;
}

export interface TrainSchedule {
  trainNumber: string;
  trainName: string;
  stationList: StationStop[];
}

export interface SearchOption {
  trainNo: string;
  trainName: string;
  journeyDate: string;
  boardStn: string;
  alightStn: string;
  boardTime: string;
  alightTime: string;
  reservedDuration: string;
  unreservedDuration: string;
  totalDuration: string;
  coveragePct: number;
  coveredDist: number;
  totalDist: number;
  uncovered: string;
  classCode: string;
  quotaCode: string;
  status: string;
  fare: string;
  note: string;
  isStitched?: boolean;
  /** IRCTC's own confirmation chance (0-100) for waitlisted tickets, when provided. */
  prediction?: number;
  legs?: {
    trainNo: string;
    from: string;
    to: string;
    status: string;
    fare: string;
    depTime: string;
    trainName?: string;
    arrTime?: string;
  }[];
}

export interface SearchResultPayload {
  matchesTime: SearchOption[];
  outsideTime: SearchOption[];
  worstCase: SearchOption[];
  totalApiCalls: number;
  trainsAnalyzed: number;
  preferredTimeWindow?: string;
  /** Direct trains that are waitlisted or RAC (only when requested). */
  waitlist?: SearchOption[];
  /** Stopped early because the request budget ran out. */
  truncated?: boolean;
  /** Stopped early because the search was cancelled. */
  cancelled?: boolean;
}

export interface ScheduleStore {
  get(trainNo: string): Promise<TrainSchedule | undefined>;
  set(trainNo: string, schedule: TrainSchedule): Promise<void>;
}

export interface SearchProgress {
  phase: "direct" | "deep" | "connections";
  done: number;
  total: number;
  calls: number;
  partial: SearchResultPayload;
}

export interface EngineOptions {
  /** Persistent schedule cache; schedules rarely change. */
  scheduleStore?: ScheduleStore;
  signal?: AbortSignal;
  onProgress?: (progress: SearchProgress) => void;
}

export interface SearchParams {
  headers: Record<string, string>;
  source: string;
  destination: string;
  date: string; // YYYYMMDD or DD-MM-YYYY
  classCode: string;
  preferredTime?: string; // "after 13:00", "before 10:00", "13:00-18:00"
  quotaCode?: string;
  minCoveragePct?: number;
  allowStitch?: boolean;
  /** Also look for journeys with one change. */
  connections?: boolean;
  /** Also report direct trains that are waitlisted or RAC. */
  includeWaitlist?: boolean;
  /** Upper bound on IRCTC requests for this search. */
  maxCalls?: number;
}

export interface IRCTCTrainItem {
  trainNumber: string;
  trainName: string;
  fromStnCode: string;
  toStnCode: string;
  departureTime: string;
  arrivalTime: string;
  duration?: string;
  avlClasses?: string[];
}

const MAJOR_CORRIDOR_STATIONS = new Set([
  // Delhi cluster
  "NDLS", "DLI", "DEC", "ANVT", "NZM", "GZB",
  // Punjab / Haryana / Northern corridor
  "UMB", "KKDE", "KUN", "PNP", "SNP", "CDG", "LDH", "ASR", "JAT", "SRE", "RK", "HW",
  // Eastern / UP / Bihar corridor
  "PNBE", "DNR", "PPTA", "RJPB", "ARA", "BXR", "DDU", "MZP", "PRYJ", "SFG", "CNB", "GOY", "TDL", "ALJN", "BGP", "KIUL", "MKA", "GAYA"
]);

export class IRCTCSearchEngine {
  private headers: Record<string, string>;
  private apiCallsCount = 0;
  private scheduleCache = new Map<string, TrainSchedule>();
  private availabilityCache = new Map<string, { status: string; fare: string; prediction?: number }>();
  private trainListCache = new Map<string, IRCTCTrainItem[]>();
  private callLimit = Infinity;

  constructor(
    headers: Record<string, string>,
    private readonly doFetch: typeof fetch = (input, init) => fetch(input, init),
    private readonly options: EngineOptions = {}
  ) {
    this.headers = { ...headers };
  }

  public getCallsCount() {
    return this.apiCallsCount;
  }

  private async sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  /** Throws if the search was cancelled or the request budget is used up. */
  private guardCall() {
    if (this.options.signal?.aborted) throw new Error("SEARCH_CANCELLED");
    if (this.apiCallsCount >= this.callLimit) throw new Error("BUDGET_EXHAUSTED");
  }

  // Normalize date to YYYYMMDD
  private normalizeDate(dateStr: string): string {
    const cleaned = dateStr.replace(/-/g, "");
    if (/^\d{8}$/.test(cleaned)) {
      if (parseInt(cleaned.slice(0, 2), 10) <= 31 && parseInt(cleaned.slice(4), 10) > 2000) {
        const dd = cleaned.slice(0, 2);
        const mm = cleaned.slice(2, 4);
        const yyyy = cleaned.slice(4);
        return `${yyyy}${mm}${dd}`;
      }
      return cleaned;
    }
    return dateStr;
  }

  public async fetchTrainsBetweenStations(
    src: string,
    dest: string,
    date: string,
    cls = "",
    quota = "GN"
  ): Promise<IRCTCTrainItem[]> {
    const listKey = `${src}|${dest}|${date}|${cls}|${quota}`;
    const cachedList = this.trainListCache.get(listKey);
    if (cachedList) return cachedList;

    this.guardCall();
    this.apiCallsCount++;
    const url = "https://www.irctc.co.in/eticketing/protected/mapps1/altAvlEnq/TC";
    const body = {
      concessionBooking: false,
      srcStn: src,
      destStn: dest,
      jrnyClass: cls || "",
      jrnyDate: date,
      quotaCode: quota,
      currentBooking: "false",
      flexiFlag: false,
      handicapFlag: false,
      ticketType: "E",
      loyaltyRedemptionBooking: false,
      ftBooking: false,
    };

    const postHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.headers)) {
      if (k.toLowerCase() === "content-type" || k.toLowerCase() === "accept") continue;
      postHeaders[k] = v;
    }
    postHeaders["Accept"] = "application/json, text/plain, */*";
    postHeaders["Content-Type"] = "application/json; charset=UTF-8";

    try {
      const res = await this.doFetch(url, {
        method: "POST",
        headers: postHeaders,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) throw new Error(`AUTH_BLOCKED_${res.status}`);
        return [];
      }

      const data = await res.json();
      const list = (data.trainBtwnStnsList || []) as IRCTCTrainItem[];
      this.trainListCache.set(listKey, list);
      return list;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith("AUTH_BLOCKED")) throw err;
      if (this.options.signal?.aborted) throw new Error("SEARCH_CANCELLED");
      console.error("fetchTrainsBetweenStations failed:", err);
      return [];
    }
  }

  public async fetchSchedule(trainNo: string): Promise<TrainSchedule> {
    if (this.scheduleCache.has(trainNo)) {
      return this.scheduleCache.get(trainNo)!;
    }

    const stored = await this.options.scheduleStore?.get(trainNo);
    if (stored) {
      this.scheduleCache.set(trainNo, stored);
      return stored;
    }

    this.guardCall();
    this.apiCallsCount++;
    const url = `https://www.irctc.co.in/eticketing/protected/mapps1/trnscheduleenquiry/${trainNo}`;
    const getHeaders: Record<string, string> = {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": this.headers["Accept-Language"] || this.headers["accept-language"] || "en-US,en;q=0.0",
      "User-Agent": this.headers["User-Agent"] || this.headers["user-agent"] || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0",
    };
    if (this.headers["Cookie"] || this.headers["cookie"]) {
      getHeaders["Cookie"] = this.headers["Cookie"] || this.headers["cookie"];
    }
    if (this.headers["bmirak"]) getHeaders["bmirak"] = this.headers["bmirak"];
    if (this.headers["greq"]) getHeaders["greq"] = this.headers["greq"];
    if (this.headers["bmiyek"]) getHeaders["bmiyek"] = this.headers["bmiyek"];
    if (this.headers["sec-ch-ua"]) getHeaders["sec-ch-ua"] = this.headers["sec-ch-ua"];
    if (this.headers["sec-ch-ua-mobile"]) getHeaders["sec-ch-ua-mobile"] = this.headers["sec-ch-ua-mobile"];
    if (this.headers["sec-ch-ua-platform"]) getHeaders["sec-ch-ua-platform"] = this.headers["sec-ch-ua-platform"];

    const res = await this.doFetch(url, { headers: getHeaders });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error(`AUTH_BLOCKED_${res.status}`);
      throw new Error(`Schedule fetch failed: HTTP ${res.status}`);
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`Non-JSON response for schedule ${trainNo}:`, text.slice(0, 150));
      throw new Error(`Failed to parse schedule JSON for train ${trainNo}`);
    }

    const schedule: TrainSchedule = {
      trainNumber: data.trainNumber || trainNo,
      trainName: data.trainName || `Train ${trainNo}`,
      stationList: data.stationList || [],
    };
    this.scheduleCache.set(trainNo, schedule);
    if (schedule.stationList.length > 0) await this.options.scheduleStore?.set(trainNo, schedule);
    return schedule;
  }

  public async fetchAvailability(
    trainNo: string,
    from: string,
    to: string,
    date: string,
    cls = "SL",
    quota = "GN"
  ): Promise<{ status: string; fare: string; prediction?: number }> {
    const key = `${trainNo}|${from}|${to}|${date}|${cls}|${quota}`;
    if (this.availabilityCache.has(key)) {
      return this.availabilityCache.get(key)!;
    }

    this.guardCall();
    this.apiCallsCount++;
    const url = `https://www.irctc.co.in/eticketing/protected/mapps1/avlFarenquiry/${trainNo}/${date}/${from}/${to}/${cls}/${quota}/N`;
    const body = {
      paymentFlag: "N",
      concessionBooking: false,
      ftBooking: false,
      loyaltyRedemptionBooking: false,
      ticketType: "E",
      quotaCode: quota,
      moreThanOneDay: true,
      returnJourney: false,
      trainNumber: trainNo,
      fromStnCode: from,
      toStnCode: to,
      isLogedinReq: false,
      journeyDate: date,
      classCode: cls,
    };

    // Clean headers to avoid duplicate casings (e.g. Content-Type vs content-type)
    const postHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.headers)) {
      if (k.toLowerCase() === "content-type" || k.toLowerCase() === "accept") continue;
      postHeaders[k] = v;
    }
    postHeaders["Accept"] = "application/json, text/plain, */*";
    postHeaders["Content-Type"] = "application/json; charset=UTF-8";

    const res = await this.doFetch(url, {
      method: "POST",
      headers: postHeaders,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error(`AUTH_BLOCKED_${res.status}`);
      return { status: `HTTP ${res.status}`, fare: "-" };
    }

    const data = await res.json();
    const prediction = parseFloat(data.avlDayList?.[0]?.predictionPercentage);
    const result = {
      status: data.avlDayList?.[0]?.availablityStatus || data.errorMessage || "Unavailable",
      fare: data.totalCollectibleAmount || data.totalFare || "-",
      prediction: Number.isFinite(prediction) ? prediction : undefined,
    };
    this.availabilityCache.set(key, result);
    return result;
  }

  private isInWindow(depTime: string, prefTime?: string): boolean {
    if (!prefTime) return true;
    if (!depTime || !depTime.includes(":")) return true;

    const [h, m] = depTime.split(":").map(Number);
    const depMins = h * 60 + m;

    const lower = prefTime.toLowerCase().trim();
    if (lower.startsWith("after")) {
      const match = lower.match(/after\s+(\d{1,2}):?(\d{2})?/);
      if (match) {
        const threshold = parseInt(match[1], 10) * 60 + (parseInt(match[2] || "0", 10));
        return depMins >= threshold;
      }
    } else if (lower.startsWith("before")) {
      const match = lower.match(/before\s+(\d{1,2}):?(\d{2})?/);
      if (match) {
        const threshold = parseInt(match[1], 10) * 60 + (parseInt(match[2] || "0", 10));
        return depMins <= threshold;
      }
    } else if (lower.includes("-")) {
      const [start, end] = lower.split("-").map(s => s.trim());
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const startMins = sh * 60 + (sm || 0);
      const endMins = eh * 60 + (em || 0);
      return depMins >= startMins && depMins <= endMins;
    }

    return true;
  }

  private isBookable(status: string): boolean {
    return status.startsWith("AVAILABLE") || status.startsWith("CURR_AVBL");
  }

  private computeDuration(
    depTime: string,
    depDayStr: string,
    arrTime: string,
    arrDayStr: string
  ): { text: string; totalMins: number } {
    if (!depTime || !arrTime || !depTime.includes(":") || !arrTime.includes(":")) {
      return { text: "--", totalMins: 0 };
    }
    const [dh, dm] = depTime.split(":").map(Number);
    const [ah, am] = arrTime.split(":").map(Number);
    const dDay = parseInt(depDayStr || "1", 10);
    const aDay = parseInt(arrDayStr || "1", 10);

    const startMins = dDay * 1440 + dh * 60 + dm;
    const endMins = aDay * 1440 + ah * 60 + am;
    let diff = endMins - startMins;
    if (diff < 0) diff += 1440;

    const h = Math.floor(diff / 60);
    const m = diff % 60;
    const text = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
    return { text, totalMins: diff };
  }

  // ---- time helpers (all in IST wall-clock minutes, offset-free) ----

  private absMins(ymd: string, hhmm: string): number {
    const [h, m] = (hhmm || "00:00").split(":").map(Number);
    const days = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) / 60000;
    return days + (h || 0) * 60 + (m || 0);
  }

  private ymdFromAbs(abs: number): string {
    const d = new Date(abs * 60000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  }

  private parseDurationMins(s?: string): number | undefined {
    if (!s) return undefined;
    const colon = s.match(/^(\d+):(\d{2})$/);
    if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);
    const hm = s.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i);
    if (hm && (hm[1] || hm[2])) return parseInt(hm[1] || "0", 10) * 60 + parseInt(hm[2] || "0", 10);
    return undefined;
  }

  private formatMins(total: number): string {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  }

  private seatsIn(status: string): number {
    const n = parseInt(status.match(/-\s*(\d+)/)?.[1] ?? "", 10);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  }

  private async runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>, stop: () => boolean) {
    let next = 0;
    const worker = async () => {
      while (next < items.length && !stop()) {
        await fn(items[next++]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  }

  /**
   * Picks the intermediate stations most likely to make a good change point:
   * stops shared by many direct trains, weighted towards the middle of the route.
   */
  private rankHubs(
    trains: { trainNo: string; from: string; dest: string }[],
    source: string,
    destination: string,
    limit: number
  ): { code: string; name: string }[] {
    const scores = new Map<string, { score: number; name: string }>();

    for (const t of trains) {
      const stns = this.scheduleCache.get(t.trainNo)?.stationList;
      if (!stns) continue;
      let si = stns.findIndex((s) => s.stationCode === source);
      if (si === -1) si = stns.findIndex((s) => s.stationCode === t.from);
      let di = stns.findIndex((s) => s.stationCode === destination);
      if (di === -1) di = stns.findIndex((s) => s.stationCode === t.dest);
      if (si === -1 || di <= si) continue;

      const base = parseFloat(stns[si].distance);
      const total = parseFloat(stns[di].distance) - base;
      if (!(total > 0)) continue;

      for (const s of stns.slice(si + 1, di)) {
        const pos = (parseFloat(s.distance) - base) / total;
        const fit = Math.max(0.1, 1 - Math.abs(pos - 0.5) * 1.6);
        const weight = MAJOR_CORRIDOR_STATIONS.has(s.stationCode) ? 1.5 : 1;
        const prev = scores.get(s.stationCode);
        scores.set(s.stationCode, {
          score: (prev?.score ?? 0) + fit * weight,
          name: prev?.name ?? s.stationName,
        });
      }
    }

    return [...scores.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit)
      .map(([code, v]) => ({ code, name: v.name }));
  }

  /**
   * One-change journeys: train 1 from the source to a hub, train 2 from the hub
   * to the destination, with a workable layover. Candidates are ranked by total
   * travel time and only the best ones get their seat availability checked.
   */
  private async findConnections(
    ctx: {
      source: string;
      destination: string;
      date: string;
      classCode: string;
      quotaCode: string;
      hubs: { code: string; name: string }[];
      onHub: (done: number, total: number) => void;
      onFound: (opt: SearchOption, firstDeparture: string) => void;
    }
  ): Promise<void> {
    const { source, destination, date, classCode, quotaCode, hubs } = ctx;
    const MIN_LAYOVER = 60;
    const MAX_LAYOVER = 12 * 60;
    const MAX_FIRST_LEGS = 8;
    const MAX_CHECKS = 24;
    const MAX_FOUND = 10;

    interface Combo {
      hub: { code: string; name: string };
      t1: IRCTCTrainItem;
      t2: IRCTCTrainItem;
      date2: string;
      layover: number;
      total: number;
    }
    const combos: Combo[] = [];

    for (let i = 0; i < hubs.length; i++) {
      const hub = hubs[i];
      ctx.onHub(i, hubs.length);

      const first = (await this.fetchTrainsBetweenStations(source, hub.code, date, classCode, quotaCode))
        .filter((t) => t.departureTime?.includes(":"))
        .slice(0, MAX_FIRST_LEGS);
      if (first.length === 0) continue;

      const arrivals = new Map<IRCTCTrainItem, { dep: number; arr: number }>();
      for (const t1 of first) {
        const dep = this.absMins(date, t1.departureTime);
        let dur = this.parseDurationMins(t1.duration);
        if (dur === undefined) {
          const stns = (await this.fetchSchedule(t1.trainNumber)).stationList;
          const a = stns.find((s) => s.stationCode === source);
          const b = stns.find((s) => s.stationCode === hub.code);
          if (!a || !b) continue;
          dur = this.computeDuration(a.departureTime, a.dayCount, b.arrivalTime, b.dayCount).totalMins;
        }
        arrivals.set(t1, { dep, arr: dep + dur });
      }
      if (arrivals.size === 0) continue;

      // Dates on which the onward train could leave the hub.
      const dates = new Set<string>();
      for (const { arr } of arrivals.values()) {
        dates.add(this.ymdFromAbs(arr + MIN_LAYOVER));
        dates.add(this.ymdFromAbs(arr + MAX_LAYOVER));
      }

      for (const date2 of dates) {
        const second = (await this.fetchTrainsBetweenStations(hub.code, destination, date2, classCode, quotaCode)).filter(
          (t) => t.departureTime?.includes(":")
        );
        for (const t2 of second) {
          const dep2 = this.absMins(date2, t2.departureTime);
          const dur2 = this.parseDurationMins(t2.duration);
          for (const [t1, { dep, arr }] of arrivals) {
            if (t1.trainNumber === t2.trainNumber) continue;
            const layover = dep2 - arr;
            if (layover < MIN_LAYOVER || layover > MAX_LAYOVER) continue;
            combos.push({
              hub,
              t1,
              t2,
              date2,
              layover,
              total: dur2 === undefined ? Number.MAX_SAFE_INTEGER : dep2 + dur2 - dep,
            });
          }
        }
      }
    }
    ctx.onHub(hubs.length, hubs.length);

    combos.sort((a, b) => a.total - b.total || a.layover - b.layover);

    let checked = 0;
    let found = 0;
    for (const c of combos) {
      if (checked >= MAX_CHECKS || found >= MAX_FOUND) break;
      checked++;

      const leg1 = await this.fetchAvailability(c.t1.trainNumber, source, c.hub.code, date, classCode, quotaCode);
      if (!this.isBookable(leg1.status)) continue;
      const leg2 = await this.fetchAvailability(c.t2.trainNumber, c.hub.code, destination, c.date2, classCode, quotaCode);
      if (!this.isBookable(leg2.status)) continue;

      found++;
      const f1 = parseFloat(String(leg1.fare));
      const f2 = parseFloat(String(leg2.fare));
      const fare = Number.isFinite(f1) && Number.isFinite(f2) ? `₹${f1 + f2}` : `₹${leg1.fare} + ₹${leg2.fare}`;
      const totalText = c.total === Number.MAX_SAFE_INTEGER ? "--" : this.formatMins(c.total);

      ctx.onFound(
        {
          trainNo: `${c.t1.trainNumber} + ${c.t2.trainNumber}`,
          trainName: `${c.t1.trainName} → ${c.t2.trainName}`,
          journeyDate: date,
          boardStn: source,
          alightStn: destination,
          boardTime: c.t1.departureTime,
          alightTime: c.t2.arrivalTime,
          reservedDuration: totalText,
          unreservedDuration: "0m (None)",
          totalDuration: totalText,
          coveragePct: 100,
          coveredDist: 0,
          totalDist: 0,
          uncovered: "None",
          classCode,
          quotaCode,
          status: this.seatsIn(leg1.status) <= this.seatsIn(leg2.status) ? leg1.status : leg2.status,
          fare,
          note: `Change at ${c.hub.name} (${c.hub.code}) · ${this.formatMins(c.layover)} wait`,
          isStitched: true,
          legs: [
            {
              trainNo: c.t1.trainNumber,
              trainName: c.t1.trainName,
              from: source,
              to: c.hub.code,
              status: leg1.status,
              fare: `₹${leg1.fare}`,
              depTime: c.t1.departureTime,
              arrTime: c.t1.arrivalTime,
            },
            {
              trainNo: c.t2.trainNumber,
              trainName: c.t2.trainName,
              from: c.hub.code,
              to: destination,
              status: leg2.status,
              fare: `₹${leg2.fare}`,
              depTime: c.t2.departureTime,
              arrTime: c.t2.arrivalTime,
            },
          ],
        },
        c.t1.departureTime
      );
    }
  }

  public async search(params: SearchParams): Promise<SearchResultPayload> {
    const {
      source,
      destination,
      classCode,
      preferredTime,
      quotaCode = "GN",
      minCoveragePct = 40,
      allowStitch = true,
      connections = false,
      includeWaitlist = false,
      maxCalls = 150,
    } = params;

    const date = this.normalizeDate(params.date);

    const matchesTime: SearchOption[] = [];
    const outsideTime: SearchOption[] = [];
    const worstCase: SearchOption[] = [];
    const waitlist: SearchOption[] = [];
    let truncated = false;
    let cancelled = false;
    let trainsAnalyzed = 0;

    const byCoverage = (a: SearchOption, b: SearchOption) => b.coveragePct - a.coveragePct;
    const snapshot = (): SearchResultPayload => ({
      matchesTime: [...matchesTime].sort(byCoverage),
      outsideTime: [...outsideTime].sort(byCoverage),
      worstCase: [...worstCase].sort(byCoverage),
      waitlist: [...waitlist],
      totalApiCalls: this.apiCallsCount,
      trainsAnalyzed,
      preferredTimeWindow: preferredTime,
      truncated,
      cancelled,
    });
    const emit = (phase: SearchProgress["phase"], done: number, total: number) =>
      this.options.onProgress?.({ phase, done, total, calls: this.apiCallsCount, partial: snapshot() });

    // Direct and partial scans may use most of the budget; the rest is kept for changes.
    this.callLimit = connections ? Math.floor(maxCalls * 0.65) : maxCalls;

    try {
      // 1. Fetch live train list dynamically for this route
      let liveTrains = await this.fetchTrainsBetweenStations(source, destination, date, classCode, quotaCode);

      let candidateTrains: { trainNo: string; name: string; from: string; dest: string; depTime?: string }[] = [];

      if (liveTrains && liveTrains.length > 0) {
        if (classCode) {
          const matchingClass = liveTrains.filter((t) => !t.avlClasses || t.avlClasses.includes(classCode));
          if (matchingClass.length > 0) liveTrains = matchingClass;
        }

        // Check current time if journey is today
        const now = new Date();
        const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        const isToday = date === todayStr;
        const currentMins = now.getHours() * 60 + now.getMinutes();

        let validTrains = liveTrains;
        if (isToday) {
          const upcoming = liveTrains.filter((t) => {
            if (!t.departureTime || !t.departureTime.includes(":")) return true;
            const [h, m] = t.departureTime.split(":").map(Number);
            return h * 60 + m >= currentMins - 15;
          });
          if (upcoming.length > 0) validTrains = upcoming;
        }

        // Every train is checked; trains in the preferred window go first.
        const inWindowTrains = validTrains.filter((t) => this.isInWindow(t.departureTime, preferredTime));
        const outWindowTrains = validTrains.filter((t) => !this.isInWindow(t.departureTime, preferredTime));

        candidateTrains = [...inWindowTrains, ...outWindowTrains].map((t) => ({
          trainNo: t.trainNumber,
          name: t.trainName,
          from: t.fromStnCode || source,
          dest: t.toStnCode || destination,
          depTime: t.departureTime,
        }));
      }

      // Fallback if no live trains returned
      if (candidateTrains.length === 0) {
        if (source === "CDG") {
          candidateTrains = [
            { trainNo: "14218", name: "UNCHAHAR EXP", from: "CDG", dest: "DLI" },
            { trainNo: "22456", name: "S NGR SHIRDI EX", from: "CDG", dest: "NDLS" },
            { trainNo: "12926", name: "PASCHIM EXPRESS", from: "CDG", dest: "NDLS" },
            { trainNo: "22452", name: "CDG BDTS EXP", from: "CDG", dest: "DEC" },
            { trainNo: "11906", name: "HSX AGC EXP", from: "CDG", dest: "NDLS" },
            { trainNo: "13052", name: "NETAJI EXPRESS", from: "CDG", dest: "DLI" },
          ];
        }
      }

      const place = (opt: SearchOption, inWindow: boolean, covPct = 100) => {
        if (covPct < minCoveragePct) worstCase.push(opt);
        else if (inWindow) matchesTime.push(opt);
        else outsideTime.push(opt);
      };

      /**
       * Checks one train. The first pass looks for a full seat (direct or booked
       * from an earlier station) and returns true once the train is settled. The
       * deep pass looks for partial rides on trains that had nothing confirmed.
       */
      const scanTrain = async (t: (typeof candidateTrains)[number], deep: boolean): Promise<boolean> => {
        const sched = await this.fetchSchedule(t.trainNo);
        const stns = sched.stationList;
        if (!stns || stns.length === 0) return true;

        // Find source: match exact source station or satellite train starting station
        let srcIdx = stns.findIndex((s) => s.stationCode === source);
        if (srcIdx === -1) srcIdx = stns.findIndex((s) => s.stationCode === t.from);

        // Find destination: match destination or target terminus
        let dstIdx = stns.findIndex((s) => s.stationCode === destination);
        if (dstIdx === -1) dstIdx = stns.findIndex((s) => s.stationCode === t.dest);

        if (srcIdx === -1 || dstIdx === -1 || srcIdx >= dstIdx) return true;

        const effectiveSource = stns[srcIdx].stationCode;
        const effectiveDest = stns[dstIdx].stationCode;
        const depTime = stns[srcIdx].departureTime;
        const inWindow = this.isInWindow(depTime, preferredTime);
        const srcDist = parseFloat(stns[srcIdx].distance);
        const dstDist = parseFloat(stns[dstIdx].distance);
        const totalDist = dstDist - srcDist;
        const totalDuration = this.computeDuration(
          depTime,
          stns[srcIdx].dayCount,
          stns[dstIdx].arrivalTime,
          stns[dstIdx].dayCount
        ).text;

        if (!deep) {
          // Full direct journey
          const fullAvail = await this.fetchAvailability(t.trainNo, effectiveSource, effectiveDest, date, classCode, quotaCode);
          const fullOpt: SearchOption = {
                trainNo: t.trainNo,
                trainName: sched.trainName,
                journeyDate: date,
                boardStn: effectiveSource === source ? source : `${effectiveSource} (Board at ${effectiveSource})`,
                alightStn: effectiveDest,
                boardTime: depTime,
                alightTime: stns[dstIdx].arrivalTime,
                reservedDuration: totalDuration,
                unreservedDuration: "0m (None)",
                totalDuration: totalDuration,
                coveragePct: 100,
                coveredDist: totalDist,
                totalDist,
                uncovered: "None",
                classCode,
                quotaCode,
                status: fullAvail.status,
                fare: `₹${fullAvail.fare}`,
                note: "Full direct confirmed ticket",
                prediction: fullAvail.prediction,
          };
          if (this.isBookable(fullAvail.status)) {
            place(fullOpt, inWindow);
            return true;
          }

          // Upstream starting station check
          if (srcIdx > 0) {
            const startStn = stns[0].stationCode;
            const startAvail = await this.fetchAvailability(t.trainNo, startStn, effectiveDest, date, classCode, quotaCode);
            if (this.isBookable(startAvail.status)) {
              place(
                {
                  trainNo: t.trainNo,
                  trainName: sched.trainName,
                  journeyDate: date,
                  boardStn: `${startStn} (Board at ${effectiveSource})`,
                  alightStn: effectiveDest,
                  boardTime: depTime,
                  alightTime: stns[dstIdx].arrivalTime,
                  reservedDuration: totalDuration,
                  unreservedDuration: "0m (None)",
                  totalDuration: totalDuration,
                  coveragePct: 100,
                  coveredDist: totalDist,
                  totalDist,
                  uncovered: "None (upstream booking)",
                  classCode,
                  quotaCode,
                  status: startAvail.status,
                  fare: `₹${startAvail.fare}`,
                  note: `Book from ${startStn}, board directly at ${effectiveSource}`,
                },
                inWindow
              );
              return true;
            }
          }
          if (includeWaitlist && /RAC|WL/i.test(fullAvail.status)) {
            waitlist.push({ ...fullOpt, note: "Not confirmed yet. Your seat depends on cancellations." });
          }
          return false;
        }

        // Frontier search on intermediate commercial stops (descending)
        let candidateIntermediates = stns.slice(srcIdx + 1, dstIdx).filter((s) => {
          if (MAJOR_CORRIDOR_STATIONS.has(s.stationCode)) return true;
          const haltParts = (s.haltTime || "").split(":");
          const haltMins = parseInt(haltParts[0] || "0", 10) * 60 + parseInt(haltParts[1] || "0", 10);
          return haltMins >= 2;
        });

        // Limit intermediate checks to 8 stops per train
        if (candidateIntermediates.length > 8) {
          const step = Math.ceil(candidateIntermediates.length / 8);
          candidateIntermediates = candidateIntermediates.filter((_, idx) => idx % step === 0 || idx === candidateIntermediates.length - 1);
        }

        let foundFrontier = false;
        for (let i = candidateIntermediates.length - 1; i >= 0; i--) {
          const midStn = candidateIntermediates[i];
          const coveredDist = parseFloat(midStn.distance) - srcDist;
          const covPct = Math.round((coveredDist / totalDist) * 100);

          const partAvail = await this.fetchAvailability(t.trainNo, effectiveSource, midStn.stationCode, date, classCode, quotaCode);
          if (this.isBookable(partAvail.status)) {
            const uncovKm = Math.round(totalDist - coveredDist);
            const resDur = this.computeDuration(depTime, stns[srcIdx].dayCount, midStn.arrivalTime, midStn.dayCount).text;
            const unresDur = this.computeDuration(midStn.arrivalTime, midStn.dayCount, stns[dstIdx].arrivalTime, stns[dstIdx].dayCount).text;
            place(
              {
                trainNo: t.trainNo,
                trainName: sched.trainName,
                journeyDate: date,
                boardStn: effectiveSource === source ? source : `${effectiveSource} (Board at ${effectiveSource})`,
                alightStn: midStn.stationCode,
                boardTime: depTime,
                alightTime: midStn.arrivalTime,
                reservedDuration: resDur,
                unreservedDuration: unresDur,
                totalDuration: totalDuration,
                coveragePct: covPct,
                coveredDist: Math.round(coveredDist),
                totalDist,
                uncovered: `${midStn.stationCode} -> ${effectiveDest} (~${uncovKm} km)`,
                classCode,
                quotaCode,
                status: partAvail.status,
                fare: `₹${partAvail.fare}`,
                note: `Ride confirmed to ${midStn.stationCode}, take connecting bus/train to ${effectiveDest}`,
              },
              inWindow,
              covPct
            );
            foundFrontier = true;
            break; // Highest confirmed coverage for this train found
          }
        }

        // Stitching / split ticket fallback for key transfer hubs
        if (allowStitch && !foundFrontier) {
          const keyHubs = candidateIntermediates.filter((s) => ["PRYJ", "CNB", "DDU", "UMB", "PNP", "BXR"].includes(s.stationCode));
          for (const hub of keyHubs) {
            const tailAvail = await this.fetchAvailability(t.trainNo, hub.stationCode, effectiveDest, date, classCode, quotaCode);
            if (this.isBookable(tailAvail.status)) {
              const coveredDist = dstDist - parseFloat(hub.distance);
              const covPct = Math.round((coveredDist / totalDist) * 100);
              const uncovKm = Math.round(totalDist - coveredDist);
              const unresDur = this.computeDuration(depTime, stns[srcIdx].dayCount, hub.departureTime, hub.dayCount).text;
              const resDur = this.computeDuration(hub.departureTime, hub.dayCount, stns[dstIdx].arrivalTime, stns[dstIdx].dayCount).text;
              place(
                {
                  trainNo: t.trainNo,
                  trainName: sched.trainName,
                  journeyDate: date,
                  boardStn: hub.stationCode,
                  alightStn: effectiveDest,
                  boardTime: hub.departureTime,
                  alightTime: stns[dstIdx].arrivalTime,
                  reservedDuration: resDur,
                  unreservedDuration: unresDur,
                  totalDuration: totalDuration,
                  coveragePct: covPct,
                  coveredDist: Math.round(coveredDist),
                  totalDist,
                  uncovered: `${effectiveSource} -> ${hub.stationCode} (~${uncovKm} km)`,
                  classCode,
                  quotaCode,
                  status: tailAvail.status,
                  fare: `₹${tailAvail.fare}`,
                  note: `Travel to ${hub.stationCode} via earlier local/bus, board confirmed here to ${effectiveDest}`,
                },
                this.isInWindow(hub.departureTime, preferredTime),
                covPct
              );
              break;
            }
          }
        }
        return true;
      };

      let budgetHit = false;
      const guarded = async (fn: () => Promise<void>) => {
        try {
          await fn();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "";
          if (msg === "BUDGET_EXHAUSTED") {
            budgetHit = true;
            truncated = true;
            return;
          }
          if (msg.startsWith("AUTH_BLOCKED") || msg === "SEARCH_CANCELLED") throw err;
          console.error("Train scan failed:", err);
        }
      };

      // Pass 1: every train, looking for a full seat.
      const unresolved: typeof candidateTrains = [];
      let done = 0;
      await this.runPool(
        candidateTrains,
        3,
        (t) =>
          guarded(async () => {
            if (!(await scanTrain(t, false))) unresolved.push(t);
            trainsAnalyzed++;
            emit("direct", ++done, candidateTrains.length);
          }),
        () => budgetHit
      );

      // Pass 2: partial rides on trains with nothing confirmed.
      if (!budgetHit) {
        let deepDone = 0;
        await this.runPool(
          unresolved,
          3,
          (t) =>
            guarded(async () => {
              await scanTrain(t, true);
              emit("deep", ++deepDone, unresolved.length);
            }),
          () => budgetHit
        );
      }

      // Pass 3: one-change journeys through likely hubs.
      if (connections) {
        budgetHit = false;
        this.callLimit = maxCalls;
        const hubs = this.rankHubs(candidateTrains, source, destination, 6);
        await guarded(() =>
          this.findConnections({
            source,
            destination,
            date,
            classCode,
            quotaCode,
            hubs,
            onHub: (d, total) => emit("connections", d, total),
            onFound: (opt, firstDeparture) => {
              place(opt, this.isInWindow(firstDeparture, preferredTime));
              emit("connections", hubs.length, hubs.length);
            },
          })
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "SEARCH_CANCELLED") cancelled = true;
      else throw err;
    }

    return snapshot();
  }
}
