# RailSeat extension

A side panel that searches IRCTC for confirmed seats from your own browser. No cURL needed.

## Install (Chrome or Edge, version 116 or newer)

1. Get the `rail` folder (the one containing `manifest.json`) onto the PC and keep it there. The browser loads it from that location.
2. Open the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Turn on **Developer mode** (top right in Chrome, left sidebar in Edge).
4. Click **Load unpacked** and select the `rail` folder.
5. Pin the RailSeat icon from the puzzle-piece menu, then click it to open the side panel.

## Use

1. Sign in to IRCTC in any tab. If no IRCTC tab is open, one opens in the background on your first search.
2. Enter From, To, date and class (up to two), then press **Search**.
3. If a search says IRCTC blocked the request, reload the IRCTC tab, sign in if asked, and search again.

## Update

Replace the files in the folder, then click the reload icon on the extension's card.

## Build from source

```bash
npm install
npm run ext:build   # writes extension/dist
```
