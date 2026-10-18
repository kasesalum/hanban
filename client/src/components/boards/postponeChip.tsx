"use client";

import { slipTone } from "@/lib/ticketTimeline";

export function PostponeChip({
  days,
  className = "",
}: {
  days?: number;
  className?: string;
}) {
  if (!days || days <= 0) return null;
  const tone = slipTone(days);
  const color =
    tone === "red"
      ? "border-red-500 text-red-300 bg-red-500/25"
      : "border-amber-400/60 text-amber-200 bg-amber-500/20";
  return (
    <span className={`inline-block rounded border ${color} ${className}`}>
      Postponed {days}d
    </span>
  );
}
