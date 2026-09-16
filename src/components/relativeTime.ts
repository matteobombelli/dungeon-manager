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
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
