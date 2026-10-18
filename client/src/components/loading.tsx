import { Loader2 } from "lucide-react";

const sizeClass = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
} as const;

export default function Loading({
  label = "Loading",
  size = "md",
  layout = "inline",
  className = "",
}: {
  label?: string;
  size?: keyof typeof sizeClass;
  layout?: "inline" | "page";
  className?: string;
}) {
  const indicator = (
    <div
      role="status"
      className={`flex items-center gap-2 text-gray-400 ${className}`}
    >
      <Loader2 className={`animate-spin shrink-0 ${sizeClass[size]}`} aria-hidden />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  );

  if (layout === "page") {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[12rem] py-16">
        {indicator}
      </div>
    );
  }

  return indicator;
}
