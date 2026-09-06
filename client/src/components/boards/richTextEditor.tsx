"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bold, Image as ImageIcon, Italic, Link, Underline } from "lucide-react";

export type RichAttachment = { url: string; path: string };

export function looksLikeHtml(text: string) {
  return /<\/?[a-z][\s\S]*>/i.test(String(text || ""));
}

export function htmlToPlain(html: string) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function isEmptyHtml(html: string) {
  return !htmlToPlain(html);
}

export function RichTextHtml({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={`rich-text ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function runCommand(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function saveSelection(editor: HTMLElement | null): Range | null {
  const selection = window.getSelection();
  if (!editor || !selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return null;
  return range.cloneRange();
}

function restoreSelection(editor: HTMLElement | null, range: Range | null) {
  if (!editor) return;
  editor.focus();
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  if (range) selection.addRange(range);
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      className="p-1.5 rounded-md text-gray-300 hover:text-white hover:bg-border-hover"
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  uploadImage,
  autoFocus,
  minHeightClass = "min-h-24",
  disabled,
}: {
  value: string;
  onChange?: (html: string, attachments: RichAttachment[]) => void;
  onBlur?: (html: string, attachments: RichAttachment[]) => void;
  placeholder?: string;
  uploadImage?: (file: File) => Promise<RichAttachment | null>;
  autoFocus?: boolean;
  minHeightClass?: string;
  disabled?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<RichAttachment[]>([]);
  const pickingFileRef = useRef(false);
  const savedRangeRef = useRef<Range | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [html, setHtml] = useState(value || "");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  useEffect(() => {
    const el = editorRef.current;
    if (!el || linkOpen) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== (value || "")) {
      el.innerHTML = value || "";
    }
    setHtml(value || "");
  }, [value, linkOpen]);

  useEffect(() => {
    if (autoFocus) {
      const frame = requestAnimationFrame(() => editorRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!linkOpen) return;
    const frame = requestAnimationFrame(() => linkInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [linkOpen]);

  function emit(handler?: (html: string, attachments: RichAttachment[]) => void) {
    const next = editorRef.current?.innerHTML || "";
    setHtml(next);
    handler?.(next, attachmentsRef.current);
  }

  function openLinkBar() {
    savedRangeRef.current = saveSelection(editorRef.current);
    setLinkUrl("");
    setLinkOpen(true);
  }

  function applyLink() {
    const href = normalizeLinkUrl(linkUrl);
    if (!href) return;
    const editor = editorRef.current;
    const range = savedRangeRef.current;
    restoreSelection(editor, range);
    const selection = window.getSelection();
    const selected = selection?.toString().trim();
    if (selected) {
      runCommand("createLink", href);
    } else if (range) {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = href;
      range.deleteContents();
      range.insertNode(anchor);
      range.setStartAfter(anchor);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      runCommand(
        "insertHTML",
        `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`
      );
    }
    editor?.querySelectorAll("a[href]").forEach((node) => {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    });
    setLinkOpen(false);
    setLinkUrl("");
    savedRangeRef.current = null;
    emit(onChange);
  }

  async function onPickImage(file: File | undefined) {
    try {
      if (!file || !uploadImage) return;
      const uploaded = await uploadImage(file);
      if (!uploaded) return;
      attachmentsRef.current = [...attachmentsRef.current, uploaded];
      editorRef.current?.focus();
      runCommand("insertHTML", `<img src="${uploaded.url}" alt="">`);
      emit(onChange);
    } finally {
      pickingFileRef.current = false;
    }
  }

  const empty = isEmptyHtml(html);

  return (
    <div
      className={`rounded-md border border-border bg-background-alt ${
        disabled ? "opacity-60 pointer-events-none" : ""
      }`}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        const wrapper = event.currentTarget;
        window.setTimeout(() => {
          if (pickingFileRef.current) return;
          if (wrapper.contains(document.activeElement)) return;
          emit(onBlur);
        }, 200);
      }}
    >
      <div className="flex items-center gap-0.5 px-1 py-1 border-b border-border">
        <ToolbarButton label="Bold" onClick={() => { runCommand("bold"); emit(onChange); }}>
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => { runCommand("italic"); emit(onChange); }}>
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          onClick={() => {
            runCommand("underline");
            emit(onChange);
          }}
        >
          <Underline className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Link" onClick={openLinkBar}>
          <Link className="w-3.5 h-3.5" />
        </ToolbarButton>
        {uploadImage && (
          <>
            <ToolbarButton
              label="Image"
              onClick={() => {
                pickingFileRef.current = true;
                fileRef.current?.click();
              }}
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </ToolbarButton>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) {
                  pickingFileRef.current = false;
                  return;
                }
                onPickImage(file);
              }}
            />
          </>
        )}
      </div>
      {linkOpen && (
        <form
          className="flex items-center gap-2 px-2 py-1.5 border-b border-border"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <input
            ref={linkInputRef}
            type="text"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://example.com"
            className="flex-1 min-w-0 px-2 py-1 rounded-md bg-background border border-border text-sm text-gray-100"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setLinkOpen(false);
                restoreSelection(editorRef.current, savedRangeRef.current);
              }
            }}
          />
          <button
            type="submit"
            disabled={!normalizeLinkUrl(linkUrl)}
            className="px-2 py-1 rounded-md bg-accent hover:bg-accent/80 text-xs disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setLinkOpen(false);
              restoreSelection(editorRef.current, savedRangeRef.current);
            }}
            className="px-2 py-1 rounded-md text-xs text-gray-300 hover:bg-border-hover"
          >
            Cancel
          </button>
        </form>
      )}
      <div className="relative">
        {empty && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-gray-500">
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          role="textbox"
          aria-multiline="true"
          data-placeholder={placeholder}
          className={`rich-text relative z-[1] w-full px-3 py-2 text-sm text-gray-100 focus:outline-none ${minHeightClass}`}
          onInput={() => emit(onChange)}
        />
      </div>
    </div>
  );
}
