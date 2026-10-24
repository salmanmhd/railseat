export interface ParsedCurl {
  url: string;
  method: string;
  headers: Record<string, string>;
  cookie?: string;
  body?: string;
  detectedParams?: {
    trainNumber?: string;
    fromStnCode?: string;
    toStnCode?: string;
    journeyDate?: string;
    classCode?: string;
    quotaCode?: string;
  };
}

export function parseCurlCommand(raw: string): ParsedCurl {
  const result: ParsedCurl = {
    url: "",
    method: "GET",
    headers: {},
  };

  if (!raw || typeof raw !== "string") return result;

  // 1. Normalize line continuations (Unix \, Windows ^, PowerShell `)
  const cleaned = raw
    .replace(/\^\r?\n/g, " ")
    .replace(/\\\r?\n/g, " ")
    .replace(/`\r?\n/g, " ");

  // 2. Extract URL
  const urlMatch =
    cleaned.match(/(?:--url\s+|curl(?:\.exe)?\s+)(?:\^?["']|\$["'])(https?:\/\/[^\s'"^`]+)/i) ||
    cleaned.match(/(https?:\/\/www\.irctc\.co\.in[^\s'"^`]+)/i);
  if (urlMatch) {
    result.url = urlMatch[1].replace(/[\^'"\\]/g, "");
  }

  // 3. Extract Cookie:
  // A: From -b or --cookie
  const cookieFlagMatch = cleaned.match(/(?:-b|--cookie)\s+(?:\$?'([^']+)'|"([^"]+)"|\^"([^^]+)\^")/i);
  if (cookieFlagMatch) {
    const rawVal = cookieFlagMatch[1] || cookieFlagMatch[2] || cookieFlagMatch[3] || "";
    const cleanCookie = rawVal.replace(/\\u0021/g, "!").replace(/\\'/g, "'").replace(/\^/g, "");
    result.cookie = cleanCookie;
    result.headers["Cookie"] = cleanCookie;
  }

  // B: From -H or --header
  const headerRegex = /(?:-H|--header)\s+(?:'([^']+)'|"((?:[^"\\]|\\.)*)"|\^"([^^]+)\^")/gi;
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(cleaned)) !== null) {
    const headerStr = (m[1] || m[2] || m[3] || "").trim();
    const colonIdx = headerStr.indexOf(":");
    if (colonIdx !== -1) {
      const key = headerStr.slice(0, colonIdx).trim();
      let val = headerStr.slice(colonIdx + 1).trim();
      val = val.replace(/\\"/g, '"').replace(/\^"/g, '"').replace(/\^/g, "").replace(/\\u0021/g, "!");
      result.headers[key] = val;
      if (key.toLowerCase() === "cookie") {
        result.cookie = val;
      }
    }
  }

  // 4. Extract Body (--data-raw, --data, --data-binary, -d)
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    result.method = "POST";
    const rawJsonCandidate = cleaned.slice(firstBrace, lastBrace + 1);
    const cleanJson = rawJsonCandidate
      .replace(/\\\^"/g, '"')
      .replace(/\^\\"/g, '"')
      .replace(/\^"/g, '"')
      .replace(/\\"/g, '"')
      .replace(/`"/g, '"')
      .replace(/\^/g, "")
      .replace(/\\u0021/g, "!");

    result.body = cleanJson;
    try {
      const parsedBody = JSON.parse(cleanJson);
      result.detectedParams = {
        trainNumber: parsedBody.trainNumber,
        fromStnCode: (parsedBody.fromStnCode || parsedBody.srcStn || "").toUpperCase(),
        toStnCode: (parsedBody.toStnCode || parsedBody.destStn || "").toUpperCase(),
        journeyDate: parsedBody.journeyDate || parsedBody.jrnyDate,
        classCode: (parsedBody.classCode || parsedBody.jrnyClass || "").toUpperCase(),
        quotaCode: (parsedBody.quotaCode || "").toUpperCase(),
      };
    } catch {
      // Regex fallback for non-standard JSON
      const srcMatch = cleanJson.match(/"(?:srcStn|fromStnCode)"\s*:\s*"([A-Za-z0-9]+)"/i);
      const dstMatch = cleanJson.match(/"(?:destStn|toStnCode)"\s*:\s*"([A-Za-z0-9]+)"/i);
      const dateMatch = cleanJson.match(/"(?:journeyDate|jrnyDate)"\s*:\s*"([0-9]{8})"/i);
      const classMatch = cleanJson.match(/"(?:classCode|jrnyClass)"\s*:\s*"([A-Za-z0-9]{1,3})"/i);
      const quotaMatch = cleanJson.match(/"(?:quotaCode)"\s*:\s*"([A-Za-z0-9]{1,3})"/i);
      const trainMatch = cleanJson.match(/"(?:trainNumber)"\s*:\s*"([A-Za-z0-9]{1,6})"/i);

      if (srcMatch || dstMatch || dateMatch) {
        result.detectedParams = {
          trainNumber: trainMatch?.[1],
          fromStnCode: srcMatch?.[1]?.toUpperCase(),
          toStnCode: dstMatch?.[1]?.toUpperCase(),
          journeyDate: dateMatch?.[1],
          classCode: classMatch?.[1]?.toUpperCase(),
          quotaCode: quotaMatch?.[1]?.toUpperCase(),
        };
      }
    }
  }

  // 5. URL fallback parameter extraction
  if (result.url) {
    const parts = result.url.split("/");
    const avlIdx = parts.indexOf("avlFarenquiry");
    if (avlIdx !== -1 && parts.length > avlIdx + 6) {
      result.detectedParams = {
        ...result.detectedParams,
        trainNumber: result.detectedParams?.trainNumber || parts[avlIdx + 1],
        journeyDate: result.detectedParams?.journeyDate || parts[avlIdx + 2],
        fromStnCode: result.detectedParams?.fromStnCode || parts[avlIdx + 3]?.toUpperCase(),
        toStnCode: result.detectedParams?.toStnCode || parts[avlIdx + 4]?.toUpperCase(),
        classCode: result.detectedParams?.classCode || parts[avlIdx + 5]?.toUpperCase(),
        quotaCode: result.detectedParams?.quotaCode || parts[avlIdx + 6]?.toUpperCase(),
      };
    }
  }

  // 6. Direct Cookie string fallback if user pasted raw cookie
  if (!result.cookie) {
    const directCookieMatch = raw.match(/(?:TS01[a-z0-9]+=|\bngetAppId=|\b_abck=)[^\r\n]+/i);
    if (directCookieMatch) {
      const c = directCookieMatch[0].trim().replace(/^['"]|['"]$/g, "");
      result.cookie = c;
      result.headers["Cookie"] = c;
    }
  }

  return result;
}
