"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function tomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toISODate(date);
}

export function isDeadlineOverdue(deadline?: string, listId?: string) {
  if (!deadline || listId === "done") return false;
  return deadline < todayISO();
}

function parseISO(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatLabel(value: string) {
  if (!value) return "Pick a date";
  return parseISO(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface DeadlinePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  allowClear?: boolean;
}

type Box = { left: number; right: number; top: number; bottom: number };

const POPUP_WIDTH = 288;
const POPUP_GAP = 8;

export function calendarPosition({
  button,
  popup,
  bounds,
  viewport,
}: {
  button: Box;
  popup: { width: number; height: number };
  bounds: { left: number; right: number } | null;
  viewport: { width: number; height: number };
}) {
  const width = popup.width || POPUP_WIDTH;
  const height = popup.height;
  const limitLeft = Math.max(POPUP_GAP, bounds?.left ?? POPUP_GAP);
  const limitRight = Math.min(
    viewport.width - POPUP_GAP,
    (bounds?.right ?? viewport.width) - POPUP_GAP
  );
  const limitTop = POPUP_GAP;
  const limitBottom = viewport.height - POPUP_GAP;

  let left = button.left;
  if (left + width > limitRight) left = button.right - width;
  if (left < limitLeft) left = limitLeft;
  if (left + width > limitRight) {
    left = Math.max(limitLeft, limitRight - width);
  }

  let top = button.bottom + POPUP_GAP;
  if (top + height > limitBottom && button.top - POPUP_GAP - height >= limitTop) {
    top = button.top - POPUP_GAP - height;
  }
  return { top, left };
}

function columnBounds(node: HTMLElement) {
  let current = node.parentElement;
  while (current && current !== document.body) {
    const style = getComputedStyle(current);
    const clips = (value: string) =>
      value === "auto" || value === "scroll" || value === "hidden" || value === "clip";
    if (clips(style.overflowX) || clips(style.overflowY)) {
      const rect = current.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    }
    current = current.parentElement;
  }
  return null;
}

export default function DeadlinePicker({
  value,
  onChange,
  className,
  allowClear,
}: DeadlinePickerProps) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() =>
    value ? parseISO(value) : parseISO(tomorrowISO())
  );
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setCursor(parseISO(value));
  }, [value]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popupRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPopupPos(null);
      return;
    }
    const place = () => {
      const button = buttonRef.current;
      const popup = popupRef.current;
      if (!button || !popup) return;
      setPopupPos(
        calendarPosition({
          button: button.getBoundingClientRect(),
          popup: {
            width: popup.offsetWidth || POPUP_WIDTH,
            height: popup.offsetHeight,
          },
          bounds: columnBounds(button),
          viewport: { width: window.innerWidth, height: window.innerHeight },
        })
      );
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, value, allowClear, cursor]);

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const start = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { iso: string; inMonth: boolean; day: number }[] = [];

    for (let i = 0; i < start; i++) {
      const date = new Date(year, month, i - start + 1);
      cells.push({
        iso: toISODate(date),
        inMonth: false,
        day: date.getDate(),
      });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      cells.push({ iso: toISODate(date), inMonth: true, day });
    }
    while (cells.length % 7 !== 0) {
      const date = new Date(year, month + 1, cells.length - start - daysInMonth + 1);
      cells.push({
        iso: toISODate(date),
        inMonth: false,
        day: date.getDate(),
      });
    }
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={
          className ||
          "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-background border border-border text-gray-100"
        }
      >
        <span>{formatLabel(value)}</span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-[200] w-72 rounded-lg border border-border bg-background-alt p-3 shadow-xl"
            style={{
              top: popupPos?.top ?? 0,
              left: popupPos?.left ?? 0,
              visibility: popupPos ? "visible" : "hidden",
            }}
          >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
              className="p-1 rounded-md hover:bg-border-hover"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium">{monthLabel}</span>
            <button
              type="button"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              className="p-1 rounded-md hover:bg-border-hover"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-[11px] text-gray-400 text-center">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((cell) => {
              const selected = cell.iso === value;
              return (
                <button
                  key={cell.iso + String(cell.inMonth)}
                  type="button"
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                  className={`h-8 rounded text-sm ${
                    selected
                      ? "bg-indigo-500 text-white"
                      : cell.inMonth
                        ? "text-gray-100 hover:bg-border-hover"
                        : "text-gray-500 hover:bg-border-hover"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          {allowClear && value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-2 w-full text-xs text-gray-400 hover:text-white"
            >
              Remove due date
            </button>
          )}
          </div>,
          document.body
        )}
    </div>
  );
}
