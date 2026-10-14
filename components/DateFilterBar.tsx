"use client";

import { CalendarDays } from "lucide-react";
import { useSearch } from "@/context/SearchContext";
import { DATE_PRESETS, toDateKey } from "@/lib/date-filter";

/** Date presets shown on the gradient header of the dashboard and organizer. */
export default function DateFilterBar() {
  const { dateFilter, setDateFilter } = useSearch();
  const today = toDateKey(new Date());

  const customRangeText =
    dateFilter.preset === "custom"
      ? dateFilter.from && dateFilter.to
        ? dateFilter.from === dateFilter.to
          ? dateFilter.from
          : `${dateFilter.from} → ${dateFilter.to}`
        : dateFilter.from
          ? `From ${dateFilter.from}`
          : dateFilter.to
            ? `Until ${dateFilter.to}`
            : "Custom range"
      : dateFilter.preset === "7d"
        ? "Last 7 days"
        : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1 ring-1 ring-inset ring-white/20 shadow-inner shadow-slate-950/10 backdrop-blur-sm">
        <CalendarDays className="ml-2 mr-1 hidden h-4 w-4 text-white/70 sm:block" />
        {DATE_PRESETS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={dateFilter.preset === value}
            onClick={() =>
              setDateFilter({
                preset: value,
                from: value === "custom" ? dateFilter.from || today : dateFilter.from,
                to: value === "custom" ? dateFilter.to || today : dateFilter.to,
              })
            }
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
              dateFilter.preset === value
                ? "bg-white text-ink-900 shadow-sm ring-1 ring-white/60"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {dateFilter.preset === "custom" && customRangeText && (
        <div className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/85 shadow-sm backdrop-blur-sm">
          {customRangeText}
        </div>
      )}

      {dateFilter.preset === "custom" && (
        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-2 py-1.5 text-sm text-white/80 backdrop-blur-sm">
          <input
            type="date"
            aria-label="From date"
            value={dateFilter.from}
            max={dateFilter.to || undefined}
            onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
            className="h-8 rounded-md border-0 bg-white px-2 text-sm text-ink-900 focus:outline-none focus:ring-4 focus:ring-white/25"
          />
          <span>to</span>
          <input
            type="date"
            aria-label="To date"
            value={dateFilter.to}
            min={dateFilter.from || undefined}
            onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
            className="h-8 rounded-md border-0 bg-white px-2 text-sm text-ink-900 focus:outline-none focus:ring-4 focus:ring-white/25"
          />
        </div>
      )}
    </div>
  );
}
