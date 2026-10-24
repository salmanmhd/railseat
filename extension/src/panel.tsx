import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { IRCTCSearchEngine, type SearchResultPayload } from "@/lib/irctc-engine";
import { RailSearch, type SearchRequest } from "@/components/rail-search";
import { ThemeProvider } from "@/components/theme-provider";
import { ensureIrctcTab, findIrctcTab, IRCTC_ORIGIN, tabFetch } from "./irctc-tab";
import { createLimitedFetch } from "./limited-fetch";

async function search(
  req: SearchRequest,
  onNotice: (message: string | null) => void,
): Promise<SearchResultPayload> {
  const tabId = await ensureIrctcTab(onNotice);
  const limited = createLimitedFetch((url, method, headers, body) => tabFetch(tabId, url, method, headers, body), onNotice);
  const engine = new IRCTCSearchEngine({}, limited);

  try {
    return await engine.search({ headers: {}, ...req });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("AUTH_BLOCKED")) {
      throw new Error(
        "IRCTC blocked the request. Open the IRCTC tab, reload the page (sign in if asked), then search again.",
      );
    }
    throw err;
  }
}

function SessionStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    findIrctcTab().then((t) => setConnected(Boolean(t)));
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">IRCTC session</h2>
        <p className="text-sm text-muted-foreground">
          Searches run in your own browser using your IRCTC tab, so there is nothing to copy or paste.
        </p>
      </div>
      <p className="text-sm">
        {connected === null
          ? "Checking…"
          : connected
            ? "IRCTC tab found. You're ready to search."
            : "No IRCTC tab open. One will open in the background when you search."}
      </p>
      <button
        type="button"
        onClick={() => chrome.tabs.create({ url: IRCTC_ORIGIN })}
        className="text-sm font-medium text-primary hover:opacity-80"
      >
        Open IRCTC
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <RailSearch search={search} session={{ label: "Session", render: () => <SessionStatus /> }} />
  </ThemeProvider>,
);
