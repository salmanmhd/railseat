import type { TabResponse } from "./irctc-tab";

type RawFetch = (url: string, method: string, headers: Record<string, string>, body?: string) => Promise<TabResponse>;

const MIN_GAP_MS = 500;
const MAX_GAP_MS = 8_000;
const JITTER_MS = 250;
const MAX_RETRIES = 4;

const THROTTLE_TEXT = /too many|rate limit|try again|temporarily/i;

function isThrottled(r: TabResponse) {
  return r.status === 429 || r.status === 503 || (r.status >= 400 && THROTTLE_TEXT.test(r.body.slice(0, 500)));
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

/**
 * Wraps the raw tab fetch in a polite, adaptive queue: one request at a time,
 * a short randomised gap between requests, and exponential backoff when IRCTC
 * pushes back. The gap widens after each push-back and relaxes after a run of
 * clean responses, so a search settles at whatever pace IRCTC tolerates.
 */
export function createLimitedFetch(
  raw: RawFetch,
  onNotice: (message: string | null) => void,
  signal?: AbortSignal,
): typeof fetch {
  let gap = MIN_GAP_MS;
  let cleanStreak = 0;
  let lastRequestAt = 0;
  let queue: Promise<unknown> = Promise.resolve();

  const run = async (url: string, method: string, headers: Record<string, string>, body?: string) => {
    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw new Error("SEARCH_CANCELLED");
      const wait = lastRequestAt + gap + Math.random() * JITTER_MS - Date.now();
      if (wait > 0) await sleep(wait, signal);
      if (signal?.aborted) throw new Error("SEARCH_CANCELLED");

      const res = await raw(url, method, headers, body);
      lastRequestAt = Date.now();

      const retryable = isThrottled(res) || (res.status === 403 && attempt === 0);
      if (!retryable || attempt >= MAX_RETRIES) {
        if (!retryable) {
          cleanStreak++;
          if (cleanStreak >= 8) {
            gap = Math.max(MIN_GAP_MS, gap * 0.75);
            cleanStreak = 0;
          }
          onNotice(null);
        }
        return res;
      }

      cleanStreak = 0;
      gap = Math.min(MAX_GAP_MS, gap * 1.8);
      const retryAfterMs = res.retryAfter ? Number(res.retryAfter) * 1000 : NaN;
      const backoff = Number.isFinite(retryAfterMs) ? retryAfterMs : gap * 2 ** attempt;
      const seconds = Math.ceil(backoff / 1000);
      onNotice(`IRCTC asked us to slow down. Waiting ${seconds}s before continuing…`);
      await sleep(backoff, signal);
    }
  };

  return (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;

    const result = queue.then(() => run(url, method, headers, body));
    queue = result.catch(() => undefined);

    return result.then((r) => new Response(r.body, { status: r.status }));
  };
}
