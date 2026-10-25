import type { HistorySource } from "@/lib/settingsHistory";

/**
 * Who is saving settings: explicit `X-MilkWise-Source: mobile|web` header wins,
 * else a React Native / native HTTP user agent (okhttp, CFNetwork, Expo) means mobile.
 */
export function sourceFromHeaders(headers: Headers): HistorySource {
  const h = headers.get("x-milkwise-source")?.toLowerCase();
  if (h === "mobile" || h === "web") return h;
  const ua = headers.get("user-agent") ?? "";
  if (/okhttp|CFNetwork|Expo|MilkWise\//i.test(ua)) return "mobile";
  return "web";
}
