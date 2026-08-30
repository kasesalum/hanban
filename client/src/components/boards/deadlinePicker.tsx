"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function tomorrowISO() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toISODate(date);
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
}

export default function DeadlinePicker({ value, onChange }: DeadlinePickerProps) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() =>
    value ? parseISO(value) : parseISO(tomorrowISO())
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setCursor(parseISO(value));
  }, [value]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-background border border-border text-gray-100"
      >
        <span>{formatLabel(value)}</span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border border-border bg-background-alt p-3 shadow-xl">
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
          <div className="grid grid-cols-7 gap-1 mb-1 text-[10px] text-gray-400 text-center">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
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
                  className={`h-7 rounded text-xs ${
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
        </div>
      )}
    </div>
  );
}
