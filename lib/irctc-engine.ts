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
  legs?: {
    trainNo: string;
    from: string;
    to: string;
    status: string;
    fare: string;
    depTime: string;
  }[];
}

export interface SearchResultPayload {
  matchesTime: SearchOption[];
  outsideTime: SearchOption[];
  worstCase: SearchOption[];
  totalApiCalls: number;
  trainsAnalyzed: number;
  preferredTimeWindow?: string;
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
  private availabilityCache = new Map<string, { status: string; fare: string }>();

  constructor(
    headers: Record<string, string>,
    private readonly doFetch: typeof fetch = (input, init) => fetch(input, init)
  ) {
    this.headers = { ...headers };
  }

  public getCallsCount() {
    return this.apiCallsCount;
  }

  private async sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
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
    cls = ""
  ): Promise<IRCTCTrainItem[]> {
    this.apiCallsCount++;
    const url = "https://www.irctc.co.in/eticketing/protected/mapps1/altAvlEnq/TC";
    const body = {
      concessionBooking: false,
      srcStn: src,
      destStn: dest,
      jrnyClass: cls || "",
      jrnyDate: date,
      quotaCode: "GN",
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
      return (data.trainBtwnStnsList || []) as IRCTCTrainItem[];
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith("AUTH_BLOCKED")) throw err;
      console.error("fetchTrainsBetweenStations failed:", err);
      return [];
    }
  }

  public async fetchSchedule(trainNo: string): Promise<TrainSchedule> {
    if (this.scheduleCache.has(trainNo)) {
      return this.scheduleCache.get(trainNo)!;
    }

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
    return schedule;
  }

  public async fetchAvailability(
    trainNo: string,
    from: string,
    to: string,
    date: string,
    cls = "SL",
    quota = "GN"
  ): Promise<{ status: string; fare: string }> {
    const key = `${trainNo}|${from}|${to}|${date}|${cls}|${quota}`;
    if (this.availabilityCache.has(key)) {
      return this.availabilityCache.get(key)!;
    }

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
    const result = {
      status: data.avlDayList?.[0]?.availablityStatus || data.errorMessage || "Unavailable",
      fare: data.totalCollectibleAmount || data.totalFare || "-",
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

  public async search(params: SearchParams): Promise<SearchResultPayload> {
    const {
      source,
      destination,
      classCode,
      preferredTime,
      quotaCode = "GN",
      minCoveragePct = 40,
      allowStitch = true,
    } = params;

    const date = this.normalizeDate(params.date);

    // 1. Fetch live train list dynamically for this route
    let liveTrains = await this.fetchTrainsBetweenStations(source, destination, date, classCode);

    let candidateTrains: { trainNo: string; name: string; from: string; dest: string; depTime?: string }[] = [];

    if (liveTrains && liveTrains.length > 0) {
      // Filter for class if available
      if (classCode) {
        const matchingClass = liveTrains.filter(t => !t.avlClasses || t.avlClasses.includes(classCode));
        if (matchingClass.length > 0) liveTrains = matchingClass;
      }

      // Check current time if journey is today
      const now = new Date();
      const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const isToday = date === todayStr;
      const currentMins = now.getHours() * 60 + now.getMinutes();

      let validTrains = liveTrains;
      if (isToday) {
        const upcoming = liveTrains.filter(t => {
          if (!t.departureTime || !t.departureTime.includes(":")) return true;
          const [h, m] = t.departureTime.split(":").map(Number);
          return (h * 60 + m) >= (currentMins - 15);
        });
        if (upcoming.length > 0) validTrains = upcoming;
      }

      // Separate into in-window and out-of-window
      const inWindowTrains = validTrains.filter(t => this.isInWindow(t.departureTime, preferredTime));
      const outWindowTrains = validTrains.filter(t => !this.isInWindow(t.departureTime, preferredTime));

      // Select top candidates (up to 6 in-window, up to 4 out-window)
      const selected = [...inWindowTrains.slice(0, 6), ...outWindowTrains.slice(0, 4)];

      candidateTrains = selected.map(t => ({
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

    const matchesTime: SearchOption[] = [];
    const outsideTime: SearchOption[] = [];
    const worstCase: SearchOption[] = [];

    // Parallel search per train
    const trainPromises = candidateTrains.map(async (t) => {
      try {
        const sched = await this.fetchSchedule(t.trainNo);
        const stns = sched.stationList;
        if (!stns || stns.length === 0) return;

        // Find source: match exact source station or satellite train starting station
        let srcIdx = stns.findIndex(s => s.stationCode === source);
        if (srcIdx === -1) {
          srcIdx = stns.findIndex(s => s.stationCode === t.from);
        }

        // Find destination: match destination or target terminus
        let dstIdx = stns.findIndex(s => s.stationCode === destination);
        if (dstIdx === -1) {
          dstIdx = stns.findIndex(s => s.stationCode === t.dest);
        }

        if (srcIdx === -1 || dstIdx === -1 || srcIdx >= dstIdx) return;

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

        // Phase 1: Full Direct Journey
        const fullAvail = await this.fetchAvailability(t.trainNo, effectiveSource, effectiveDest, date, classCode, quotaCode);
        if (this.isBookable(fullAvail.status)) {
          const opt: SearchOption = {
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
          };

          if (inWindow) matchesTime.push(opt);
          else outsideTime.push(opt);
          return; // 100% direct found, no partial search needed
        }

        // Phase 4: Upstream Starting Station check
        if (srcIdx > 0) {
          const startStn = stns[0].stationCode;
          const startAvail = await this.fetchAvailability(t.trainNo, startStn, effectiveDest, date, classCode, quotaCode);
          if (this.isBookable(startAvail.status)) {
            const opt: SearchOption = {
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
            };

            if (inWindow) matchesTime.push(opt);
            else outsideTime.push(opt);
            return; // 100% upstream confirmed found
          }
        }

        // Phase 2: Frontier search on intermediate commercial stops (descending)
        let candidateIntermediates = stns.slice(srcIdx + 1, dstIdx).filter(s => {
          if (MAJOR_CORRIDOR_STATIONS.has(s.stationCode)) return true;
          const haltParts = (s.haltTime || "").split(":");
          const haltMins = parseInt(haltParts[0] || "0", 10) * 60 + parseInt(haltParts[1] || "0", 10);
          return haltMins >= 2;
        });

        // Limit intermediate checks to top 8 stops to keep latency ultra-low
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
            const opt: SearchOption = {
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
            };

            if (covPct >= minCoveragePct) {
              if (inWindow) matchesTime.push(opt);
              else outsideTime.push(opt);
            } else {
              worstCase.push(opt);
            }
            foundFrontier = true;
            break; // Highest confirmed coverage for this train found
          }
        }

        // Phase 3: Stitching / split ticket fallback for key transfer hubs
        if (allowStitch && !foundFrontier) {
          const keyHubs = candidateIntermediates.filter(s =>
            ["PRYJ", "CNB", "DDU", "UMB", "PNP", "BXR"].includes(s.stationCode)
          );
          for (const hub of keyHubs) {
            const tailAvail = await this.fetchAvailability(t.trainNo, hub.stationCode, effectiveDest, date, classCode, quotaCode);
            if (this.isBookable(tailAvail.status)) {
              const coveredDist = dstDist - parseFloat(hub.distance);
              const covPct = Math.round((coveredDist / totalDist) * 100);
              const uncovKm = Math.round(totalDist - coveredDist);
              const unresDur = this.computeDuration(depTime, stns[srcIdx].dayCount, hub.departureTime, hub.dayCount).text;
              const resDur = this.computeDuration(hub.departureTime, hub.dayCount, stns[dstIdx].arrivalTime, stns[dstIdx].dayCount).text;
              const opt: SearchOption = {
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
              };

              if (covPct >= minCoveragePct) {
                if (this.isInWindow(hub.departureTime, preferredTime)) matchesTime.push(opt);
                else outsideTime.push(opt);
              } else {
                worstCase.push(opt);
              }
              break;
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message.startsWith("AUTH_BLOCKED")) throw err;
        console.error(`Error processing train ${t.trainNo}:`, err);
      }
    });

    await Promise.all(trainPromises);

    // Sort by coverage descending, then departure time
    matchesTime.sort((a, b) => b.coveragePct - a.coveragePct);
    outsideTime.sort((a, b) => b.coveragePct - a.coveragePct);
    worstCase.sort((a, b) => b.coveragePct - a.coveragePct);

    return {
      matchesTime,
      outsideTime,
      worstCase,
      totalApiCalls: this.apiCallsCount,
      trainsAnalyzed: candidateTrains.length,
      preferredTimeWindow: preferredTime,
    };
  }
}
