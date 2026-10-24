import { NextRequest, NextResponse } from "next/server";
import { parseCurlCommand } from "@/lib/curl-parser";
import { IRCTCSearchEngine } from "@/lib/irctc-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      curlInput,
      source = "CDG",
      destination = "NDLS",
      date = "20261025",
      classCode = "SL",
      preferredTime = "after 13:00",
      quotaCode = "GN",
      minCoveragePct = 50,
      allowStitch = true,
      connections = false,
      includeWaitlist = false,
      maxCalls,
      customHeaders,
    } = body;

    let headers: Record<string, string> = {};

    if (curlInput && typeof curlInput === "string") {
      const parsed = parseCurlCommand(curlInput);
      headers = { ...parsed.headers };
    }

    if (customHeaders && typeof customHeaders === "object") {
      headers = { ...headers, ...customHeaders };
    }

    if (!headers["Cookie"] && !headers["cookie"]) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_COOKIE",
          message: "A valid Cookie header is required to authenticate with IRCTC. Please paste a cURL from DevTools containing your session cookie.",
        },
        { status: 400 }
      );
    }

    const engine = new IRCTCSearchEngine(headers);

    const result = await engine.search({
      headers,
      source: source.toUpperCase().trim(),
      destination: destination.toUpperCase().trim(),
      date,
      classCode: classCode.toUpperCase().trim(),
      preferredTime: preferredTime?.trim(),
      quotaCode: quotaCode.toUpperCase().trim(),
      minCoveragePct: Number(minCoveragePct) || 50,
      allowStitch: Boolean(allowStitch),
      connections: Boolean(connections),
      includeWaitlist: Boolean(includeWaitlist),
      ...(Number(maxCalls) > 0 ? { maxCalls: Number(maxCalls) } : {}),
    });

    console.log(`[API /api/search] Search done: ${result.matchesTime.length} in-window, ${result.outsideTime.length} out-window, ${result.worstCase.length} fallback. Calls: ${result.totalApiCalls}`);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    console.error("API Search Error:", err);
    if (err instanceof Error && err.message.startsWith("AUTH_BLOCKED")) {
      return NextResponse.json(
        {
          success: false,
          error: "AUTH_EXPIRED",
          message: "IRCTC / Akamai rejected the session (HTTP 401/403). Please copy a fresh cURL from your browser Network tab.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "An unexpected error occurred during search.",
      },
      { status: 500 }
    );
  }
}
