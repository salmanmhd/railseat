"use client";

import { useState } from "react";
import { parse } from "date-fns";
import { parseCurlCommand } from "@/lib/curl-parser";
import { RailSearch, type FillFields, type SearchRequest } from "@/components/rail-search";
import type { SearchResultPayload } from "@/lib/irctc-engine";

const DEFAULT_SAMPLE_CURL = `curl --url 'https://www.irctc.co.in/eticketing/protected/mapps1/avlFarenquiry/13052/20261025/CDG/DLI/SL/GN/N' \\
  -H 'accept: application/json, text/plain, */*' \\
  -H 'accept-language: en-US,en;q=0.0' \\
  -H 'bmirak: webbm' \\
  -H 'content-language: en' \\
  -H 'content-type: application/json; charset=UTF-8' \\
  -b $'TS01aeac8e=01d83d9ce72b50de06c9b8309c1bcc3ab590bc73ce66e99c2d73cb00b41ead74d888b81cacf6182e1fe2045453566127bb97d088a6; ngetAppId=y0hsmyCxVaH7M-PxieyAqfXEuvEwtdCvHi42dx8ny0ELWtcrGU_3!597608025; PIM-SESSION-ID=HwkmP4ENc76bEk7X; et_appVIP1=1093160458.17183.0000; _ga=GA1.1.390380682.1792068783; TS018d84e5=01d83d9ce7cd358fbd45c383770b421f3536a8f839baab9d8866d67713ad473adb3ea14ec1e2db97ae8a83b5811b2ae6d31f939bac; bm_sz=1D6AC928FF8DA669478CFD8AC9642C83~YAAQ5QFAFzqViWWhAQAAkB+ZbAHpCZZem7etfzREpnEnviLJR/h2yvLgzmTx7BwSL0q6xizUa9Fa2BViIxj4QufcSVJaBQqr9FJSwxnNdCsUj2IZcAD9MD9J1sciuclodbLY1rXxxD5GqEASbxgruiNrMmO6X0sXqgFehEAQ8E2Ex1AAZAYV7GczMVb+vJqVolNCO826lSc0S/+LpYPlbIiUM7kxwtSdjmUJvddqbSOFvnroG8/5UGmMU5I2IVuYR88aSmdLIDtiho55DxPLY62HFn8XzqhcHCWaP6IPor7fUJfch6Wg2xrkGFCV1dBcQR2H1mBuReBIcOTiNnOVZ8GgKTMql1Ol9Qd8ix942DK2YKyCl3HdtKP+7dbFQeMNA/aI0AZkhjO/XBv8cMLHM5Yv~3225913~3487793; _abck=EB06DEEFAF8E9B0163C0FB28D3A1DF7E~-1~YAAQ5QFAF4h3imWhAQAAf0KcbBA/zjP+8paBIgu5EtAL+mGq6B7LF9A0A7lg2Lb1+bxhHEK3iY/iD7OVEtZawpKhExWNCSem3yDLoDQzv+cIQNvwosh59M307++75GO8t63tV35anAvaE2A2lI10ieStAiqeq/XVgWpYwhUGjZuV0HYVLt2HztUAhZb/3j8/RNNXriZszO1/3o7Kw0eaqvVkNcU4jT2tUkxl+OPeqYmjmem02X1J8RJF/4hb7YXJRK2+5aaFGMAjpgJYpyzhLIdV9uEZs7XqPTXBt+k8UDQW19QRA0IMnbBJ9f2R/nRot95kHqnzdUTVibwucAjcyPolgP8yXMSQi9Gu+knS+WLbIBjDZfQ0mS92fw3sYloYKUDXEQvuEYJEfBBMYrivCgx/1dDVrY3ZFmsdZuxVQwne0VG9ZhAUPFUZ10CVtxg8A5DIYPFCYgEslSGPfAu9ZWv2aDPdIfFnDfvUiRDbSOBNMqODLZpXv0PpJCwHWJDErMUTtF1xhdw/bDPqiQlBDoQy8BbJfUj7V9VxsST0nBVCaH4BgWBt1nlaBN3F3ByXafeKgBE8C3okkEF7cqFgmb7mVzV6WAyfzIDft83Pn/2Xo7gAj4b9xMmZhxVh/iMWkmxAFVwC7AljM73fCWF4G5CuJsIBIWHG+/si3dxoRLqVVBKFBNbU3hvW0vJb7LlcQaFfQ8N5FJWisQ==~-1~-1~1792826937~AAQAAAAG%2f%2f%2f%2f%2f0AnR6sxNuT%2fE8F%2foq+GGpwgyWhW1qdP+FQIlIJdU9lTC%2fYHIFzN9xfJ8Rn1+ENokRCIpr4ncWHCyYJiUwGW0fL4bH77wNIN1cx6~1792823602' \\
  -H 'greq: 1792823339143:ea49505c-a714-4233-a715-fe297699a86b' \\
  -H 'origin: https://www.irctc.co.in' \\
  -H 'referer: https://www.irctc.co.in/nget/booking/train-list' \\
  -H 'sec-ch-ua: "Microsoft Edge";v="155", "Chromium";v="155", "Not(A:Brand";v="24"' \\
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0' \\
  --data-raw '{"paymentFlag":"N","concessionBooking":false,"ftBooking":false,"loyaltyRedemptionBooking":false,"ticketType":"E","quotaCode":"GN","moreThanOneDay":true,"returnJourney":false,"trainNumber":"13052","fromStnCode":"CDG","toStnCode":"DLI","isLogedinReq":false,"journeyDate":"20261025","classCode":"SL"}'`;

export default function Home() {
  const [curlInput, setCurlInput] = useState(DEFAULT_SAMPLE_CURL);

  const search = async (req: SearchRequest): Promise<SearchResultPayload> => {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curlInput, ...req }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || "Failed to search train seats.");
    return json.data;
  };

  return (
    <RailSearch
      search={search}
      session={{
        label: "IRCTC session",
        render: (fill) => (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">IRCTC session</h2>
              <p className="text-sm text-muted-foreground">
                Paste a recent request copied from your browser&apos;s Network tab (Copy as cURL). Your route, date and
                class are filled in from it.
              </p>
            </div>
            <textarea
              rows={4}
              value={curlInput}
              onChange={(e) => {
                setCurlInput(e.target.value);
                fill(fieldsFromCurl(e.target.value));
              }}
              placeholder="curl --url 'https://www.irctc.co.in/...' -b '...'"
              className="w-full resize-none rounded-xl bg-muted px-4 py-3 font-mono text-xs text-foreground focus:bg-card focus:outline-2 focus:outline-primary"
            />
          </div>
        ),
      }}
    />
  );
}

function fieldsFromCurl(val: string): FillFields {
  try {
    const p = parseCurlCommand(val).detectedParams;
    const fields: FillFields = {
      source: p?.fromStnCode || undefined,
      destination: p?.toStnCode || undefined,
      classCode: p?.classCode || undefined,
    };
    if (p?.journeyDate && /^d{8}$/.test(p.journeyDate)) {
      const d = parse(p.journeyDate, "yyyyMMdd", new Date());
      if (!isNaN(d.getTime())) fields.date = d;
    }
    return fields;
  } catch {
    return {};
  }
}
