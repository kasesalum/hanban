"use client";

import { Fragment } from "react";

type Segment =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string };

function safeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[),.!?;:]+$/g, "");
}

function linkifyBareUrls(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /https?:\/\/[^\s<>"'`]+/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const trimmed = trimTrailingPunctuation(match[0]);
    const href = safeHttpUrl(trimmed);
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (href) {
      segments.push({ type: "link", href, label: trimmed });
      lastIndex = match.index + trimmed.length;
      re.lastIndex = lastIndex;
    } else {
      segments.push({ type: "text", value: match[0] });
      lastIndex = match.index + match[0].length;
    }
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

export function parseDescription(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const href = safeHttpUrl(match[2]);
    if (!href) continue;
    if (match.index > lastIndex) {
      segments.push(...linkifyBareUrls(text.slice(lastIndex, match.index)));
    }
    segments.push({ type: "link", href, label: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(...linkifyBareUrls(text.slice(lastIndex)));
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

const linkClass =
  "text-blue-400 underline underline-offset-2 hover:text-blue-300 break-all";

export default function DescriptionText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {parseDescription(text).map((segment, index) =>
        segment.type === "link" ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
            onClick={(event) => event.stopPropagation()}
          >
            {segment.label}
          </a>
        ) : (
          <Fragment key={index}>{segment.value}</Fragment>
        )
      )}
    </span>
  );
}
