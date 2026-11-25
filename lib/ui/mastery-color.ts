/** Diverging scale around the 50% "weak" line: red arm below, grey midpoint, blue arm above. */
export const MASTERY_BINS: { max: number; bg: string; fg: string; label: string }[] = [
  { max: 20, bg: "#b83a3a", fg: "#fff", label: "<20" },
  { max: 35, bg: "#dd7b74", fg: "#1f1f1f", label: "20–34" },
  { max: 45, bg: "#efb3ab", fg: "#1f1f1f", label: "35–44" },
  { max: 50, bg: "#f6dbd6", fg: "#1f1f1f", label: "45–49" },
  { max: 60, bg: "#f0efec", fg: "#1f1f1f", label: "50–59" },
  { max: 70, bg: "#cde2fb", fg: "#1f1f1f", label: "60–69" },
  { max: 80, bg: "#9ec5f4", fg: "#1f1f1f", label: "70–79" },
  { max: 90, bg: "#5598e7", fg: "#fff", label: "80–89" },
  { max: 101, bg: "#256abf", fg: "#fff", label: "90+" },
];

export function masteryColor(v: number) {
  return MASTERY_BINS.find((b) => v < b.max) ?? MASTERY_BINS[MASTERY_BINS.length - 1];
}
