export const IRCTC_ORIGIN = "https://www.irctc.co.in";
const IRCTC_HOME = `${IRCTC_ORIGIN}/nget/train-search`;

export interface TabResponse {
  status: number;
  retryAfter: string | null;
  body: string;
}

export async function findIrctcTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ url: `${IRCTC_ORIGIN}/*` });
  return tabs.find((t) => t.status === "complete") ?? tabs[0];
}

async function waitForLoad(tabId: number, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("IRCTC took too long to load. Check your connection and try again.");
}

/** Returns the id of an IRCTC tab, opening one in the background if none exists. */
export async function ensureIrctcTab(onNotice: (message: string | null) => void): Promise<number> {
  const existing = await findIrctcTab();
  if (existing?.id !== undefined) {
    await waitForLoad(existing.id);
    return existing.id;
  }

  onNotice("Opening IRCTC in a background tab…");
  const tab = await chrome.tabs.create({ url: IRCTC_HOME, active: false });
  await waitForLoad(tab.id!);
  // Let IRCTC's own scripts finish setting their session cookies.
  await new Promise((r) => setTimeout(r, 2500));
  onNotice(null);
  return tab.id!;
}

/**
 * Runs a fetch inside the IRCTC tab, so it carries the page's real origin,
 * cookies and browser fingerprint. Only plain headers are forwarded; the
 * browser fills in the rest.
 */
export async function tabFetch(
  tabId: number,
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
): Promise<TabResponse> {
  let results: chrome.scripting.InjectionResult<TabResponse | { error: string }>[];
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      args: [url, method, headers, body ?? null],
      func: async (u: string, m: string, h: Record<string, string>, b: string | null) => {
        try {
          const blocked = new Set(["cookie", "user-agent", "accept-language", "origin", "referer", "host"]);
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(h)) {
            if (!blocked.has(k.toLowerCase())) out[k] = v;
          }
          const names = Object.keys(out).map((k) => k.toLowerCase());
          if (!names.includes("bmirak")) out["bmirak"] = "webbm";
          if (!names.includes("greq")) out["greq"] = `${Date.now()}:${crypto.randomUUID()}`;

          const res = await fetch(u, { method: m, headers: out, body: b ?? undefined, credentials: "include" });
          return { status: res.status, retryAfter: res.headers.get("retry-after"), body: await res.text() };
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    });
  } catch {
    throw new Error("Lost the IRCTC tab. Keep an IRCTC tab open and try again.");
  }

  const result = results[0]?.result;
  if (!result) throw new Error("Lost the IRCTC tab. Keep an IRCTC tab open and try again.");
  if ("error" in result) throw new Error(`Request from the IRCTC tab failed: ${result.error}`);
  return result;
}
