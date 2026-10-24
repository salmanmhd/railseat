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

  // Normalize Windows line continuations ^ and unix \
  const cleaned = raw.replace(/\^\r?\n/g, " ").replace(/\\\r?\n/g, " ");

  // Extract URL
  const urlMatch = cleaned.match(/(?:--url\s+['"^]?|curl\s+['"^]?)(https?:\/\/[^\s'"^]+)/i);
  if (urlMatch) {
    result.url = urlMatch[1].replace(/['"^]/g, "");
  }

  // Extract Cookie from -b or --cookie
  const cookieMatch = cleaned.match(/(?:-b|--cookie)\s+\$?'([^']+)'/i) ||
                      cleaned.match(/(?:-b|--cookie)\s+["']([^"']+)["']/i);
  if (cookieMatch) {
    result.cookie = cookieMatch[1];
    result.headers["Cookie"] = cookieMatch[1];
  }

  // Extract Headers (-H "key: value" or -H 'key: value')
  const headerRegex = /-H\s+(?:'([^']+)'|"((?:[^"\\]|\\.)*)"|\^"([^^]+)\^")/g;
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(cleaned)) !== null) {
    const headerStr = (m[1] || m[2] || m[3] || "").trim();
    const colonIdx = headerStr.indexOf(":");
    if (colonIdx !== -1) {
      const key = headerStr.slice(0, colonIdx).trim();
      let val = headerStr.slice(colonIdx + 1).trim();
      val = val.replace(/\\"/g, '"');
      result.headers[key] = val;
      if (key.toLowerCase() === "cookie") {
        result.cookie = val;
      }
    }
  }

  // Extract Data body (--data-raw, --data, -d)
  const dataMatch = cleaned.match(/(?:--data-raw|--data|-d)\s+\^?"?(\{[\s\S]+?\})\^?"?(?:\s|$)/) ||
                    cleaned.match(/(?:--data-raw|--data|-d)\s+["'](\{[\s\S]+\})["']/);
  if (dataMatch) {
    try {
      const rawJson = dataMatch[1].replace(/\\\^"/g, '"').replace(/\^"/g, '"');
      result.body = rawJson;
      result.method = "POST";
      const parsedBody = JSON.parse(rawJson);
      result.detectedParams = {
        trainNumber: parsedBody.trainNumber,
        fromStnCode: parsedBody.fromStnCode || parsedBody.srcStn,
        toStnCode: parsedBody.toStnCode || parsedBody.destStn,
        journeyDate: parsedBody.journeyDate || parsedBody.jrnyDate,
        classCode: parsedBody.classCode || parsedBody.jrnyClass,
        quotaCode: parsedBody.quotaCode,
      };
    } catch {
      // Body not strict JSON
    }
  }

  // URL fallback parameter extraction
  if (result.url) {
    const parts = result.url.split("/");
    const avlIdx = parts.indexOf("avlFarenquiry");
    if (avlIdx !== -1 && parts.length > avlIdx + 6) {
      result.detectedParams = {
        ...result.detectedParams,
        trainNumber: parts[avlIdx + 1],
        journeyDate: parts[avlIdx + 2],
        fromStnCode: parts[avlIdx + 3],
        toStnCode: parts[avlIdx + 4],
        classCode: parts[avlIdx + 5],
        quotaCode: parts[avlIdx + 6],
      };
    }
  }

  return result;
}
