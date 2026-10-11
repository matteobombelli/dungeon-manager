const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "3 days ago" for a millisecond timestamp. */
export function relativeTime(ms: number): string {
  const seconds = (ms - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    // Truncated, not rounded: 59 minutes 40 seconds is "59 minutes ago", never "60 minutes ago".
    if (Math.abs(seconds) >= size) return format.format(Math.trunc(seconds / size), unit);
  }
  return "just now";
}
