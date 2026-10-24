# RailSeat roadmap

RailSeat finds confirmed IRCTC seats. It runs as a Next.js site and as a Chrome/Edge side-panel extension that searches from your own browser session. Both share the same UI (`components/rail-search.tsx`, `components/search-results.tsx`) and search engine (`lib/irctc-engine.ts`).

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Full-train scan, request budget, schedule cache, live progress and Stop | Done |
| 2 | One-change journeys through ranked hubs | Done |
| 3 | Sorting, nearby dates, quotas, waitlist chances | Done |
| 4 | Saved searches, watching and notifications, history | Planned |

## What phases 1 to 3 do

- **Every train is checked**, with trains in your time window first. A search stops at its request budget (150 by default) and says so.
- **Schedules are cached** for 7 days in the extension, so repeat searches skip them.
- **One-change journeys** pick up to six likely hubs from the direct trains' routes, look for a first and second train with a 1 to 12 hour layover, rank by total time, and check seats on the best 24 combinations.
- **Sorting**: best match, cheapest, fastest, earliest departure.
- **Nearby dates**: the chosen date plus one day either side. The extra days get a lighter scan (60 requests, no changes).
- **Quotas**: General, Tatkal, Premium Tatkal, Ladies, Senior citizen. The quota is sent to IRCTC for train lists and seat checks.
- **Waitlist chances**: with "Include waitlisted trains", direct trains that are RAC or waitlisted get their own tab. The chance comes from IRCTC's own percentage when the response has one, otherwise from the current waitlist position (see `lib/waitlist-odds.ts`). It is a rough guide only.
- **Classes**: up to two at a time, searched one after the other and merged.

## Phase 4: keep watching

**Goal:** tell the user when a seat appears on a route, and show how seats on a route tend to behave.

### Saved searches and watching

- A **Watch this search** button on the results saves the route, date, class, quota, time window and the trains already seen.
- Watches live in `chrome.storage.local` with an id, created time, last checked time and last result summary.
- A background check runs from the service worker using `chrome.alarms` (every 15 to 30 minutes, never less than 1 minute). The engine needs bundling into `background.js` for this.
- Each check is cheap: one availability request per known train and nothing else, with schedules coming from the cache. A full re-scan only runs once a day.
- When a train that was not bookable becomes bookable, or a waitlist number drops under a threshold, send a notification (`chrome.notifications`) and set the toolbar badge.
- Needs the `alarms` and `notifications` permissions.
- A **Watches** view in the panel lists each watch with its last status, and lets the user pause or delete it.
- Stop a watch automatically after the journey date, and pause all watches when IRCTC blocks a request or the session has expired.

**Limits to design around**

- Checks only run while the browser is open.
- Background requests still count against IRCTC's rate limits, so keep a global cap across all watches and reuse the same limiter.
- An IRCTC tab must exist to run requests. Reuse or open one in the background as the search does.

### History

- Record each check as (route, date, class, quota, train, status, time) in IndexedDB.
- Show a small chart per train: seats or waitlist position against days before departure.
- Use it to make the waitlist chance better than the position-only rule, once there is enough local data.
- Keep it local only, and cap its size (for example 90 days or 50 MB), with a clear-history button.

**Done when:** a saved search notifies within one check interval of a seat appearing, survives a browser restart, and the panel shows the last 30 days for a route.

## Other ideas, not scheduled

- **Two-change journeys.** Same method as one change, with a tighter budget. Probably only worth it when no direct or one-change option is confirmed.
- **All-classes mode.** Today it is up to two classes. A mode that checks every class on the cheapest trains first would help when the class does not matter.
- **Wider date range.** More than one day either side, with a clear estimate of the request cost shown before running.
- **Learn the rate limit.** Persist the gap the rate limiter settles on and start from it next time, per session.
- **Schedule data set.** A bundled timetable would speed up hub ranking, but live seat availability still has to come from IRCTC.
- **Chrome Web Store / Edge Add-ons.** Needs a privacy policy, a justification for the IRCTC host permission, and screenshots. Until then the extension is loaded unpacked.
- **Booking.** Out of scope. The tool finds seats and the user books on IRCTC. Automating booking carries much more risk and would need a separate decision.

## Known assumptions and risks

- **Train list fields.** One-change search assumes IRCTC's "trains between stations" response gives departure, arrival and duration for the stations asked about, not for the train's whole route. If layovers look wrong on real data, check this first.
- **Predictions.** The `predictionPercentage` field on the availability response is read if present. It has not been confirmed against live responses.
- **Request volume.** A full search is many requests. The rate limiter, budget and caches exist to keep this polite, but IRCTC can still throttle or block a session.
- **Session.** Requests rely on an IRCTC tab in the same browser. If IRCTC blocks a request, reload that tab (sign in if asked) and search again.
- **Website route.** `/api/search` supports the same options but does not stream results and has no rate limiter, and server requests are more likely to be blocked.

## Housekeeping

- `components/theme-toggle.tsx` has a lint error (`setState` in an effect) that predates these phases.
- The engine has no committed tests. A mock IRCTC network used during development checked the scan, budget, cancel, schedule cache, connections, quota and waitlist logic. It would be worth adding to the repo before Phase 4.
